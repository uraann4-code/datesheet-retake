import { addDays, isWeekend, format } from 'date-fns';

export interface TimeSlot {
  date: Date;
  session: number;
}

export interface Course {
  matchId: string;
  courseCode: string;
  subject: string;
  students: Set<string>;
  teacherName: string;
  isMS?: boolean;
}

export interface ScheduledCourse extends Course {
  timeSlot?: TimeSlot;
}

export type ExamType = 'mid' | 'final';

export interface ScheduleResult {
  datesheet: any[];
  scheduledCourses: ScheduledCourse[];
  totalClashes: number;
  totalCourses: number;
  totalStudents: number;
  unresolvedConflicts: { student: string; course1: string; course2: string }[];
  examType?: ExamType;
}

export function generateSchedule(
  records: any[],
  startDate: Date,
  numDays: number,
  sessionsPerDay: number,
  skipWeekends: boolean = true,
  previousResult: ScheduleResult | null = null,
  examType: ExamType = 'final',
  bufferDateInput?: Date
): ScheduleResult {
  // 1. Identify columns globally
  const allKeys = new Set<string>();
  records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const keys = Array.from(allKeys);

  const findKey = (searchTerms: string[]) => {
    return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
  };

  const enrollmentKey = findKey(['enrollment', 'registration', 'studentid', 'regno', 'rollno', 'reg#', 'reg', 'roll', 'student', 'id']);
  const subjectKey = findKey(['subject', 'coursename', 'coursetitle', 'course', 'sub', 'paper', 'title']);
  const courseCodeKey = findKey(['coursecode', 'subjectcode', 'code', 'ccode']);
  const teacherKey = findKey(['teacher', 'instructor', 'faculty']);
  const programKey = findKey(['program', 'degree', 'class', 'department']);

  // 2. Extract unique courses and their students
  const coursesMap = new Map<string, Course>();
  const studentCourses = new Map<string, Set<string>>();

  // Standardize records
  const standardizedRecords = records.map(record => {
    const enrollment = enrollmentKey ? String(record[enrollmentKey] || '').trim() : '';
    const subject = subjectKey ? String(record[subjectKey] || '').trim() : '';
    let courseCode = courseCodeKey ? String(record[courseCodeKey] || '').trim() : '';
    const teacherName = teacherKey ? String(record[teacherKey] || '').trim() : '';
    const program = programKey ? String(record[programKey] || '').trim() : '';

    // If we have a subject but no explicit course code, use subject as code
    // Normalize string: remove extra spaces, special chars, and uppercase
    const cleanSubject = subject.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const cleanCode = courseCode.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

    // Primary grouping key: strictly by subject name if requested, but include code for more specificity
    const primaryId = cleanSubject || cleanCode || 'UNKNOWN';
    const normalizedPrimaryId = primaryId;
    
    const isMS = /\b(MS|MBA|MPhil|Masters?)\b/i.test(program) || /MS\s*\(/.test(program);

    return {
      original: record,
      enrollment,
      matchId: normalizedPrimaryId,
      displayCourseCode: courseCode || normalizedPrimaryId,
      subject: subject || courseCode,
      teacherName,
      isMS
    };
  });

  standardizedRecords.forEach((record) => {
    if (!record.enrollment || !record.matchId) return;

    if (!coursesMap.has(record.matchId)) {
      coursesMap.set(record.matchId, {
        matchId: record.matchId,
        courseCode: record.displayCourseCode,
        subject: record.subject,
        students: new Set(),
        teacherName: record.teacherName,
        isMS: record.isMS,
      });
    } else if (record.isMS) {
      coursesMap.get(record.matchId)!.isMS = true;
    }
    coursesMap.get(record.matchId)!.students.add(record.enrollment);

    if (!studentCourses.has(record.enrollment)) {
      studentCourses.set(record.enrollment, new Set());
    }
    studentCourses.get(record.enrollment)!.add(record.matchId);
  });

  const courses = Array.from(coursesMap.values());

  // 3. Build conflict graph
  const conflicts = new Map<string, Set<string>>();
  courses.forEach((c) => conflicts.set(c.matchId, new Set()));

  studentCourses.forEach((enrolledCourses) => {
    const courseArray = Array.from(enrolledCourses);
    for (let i = 0; i < courseArray.length; i++) {
        for (let j = i + 1; j < courseArray.length; j++) {
          conflicts.get(courseArray[i])!.add(courseArray[j]);
          conflicts.get(courseArray[j])!.add(courseArray[i]);
        }
    }
  });

  // 4. Generate time slots
  const timeSlots: TimeSlot[] = [];
  let currentDate = new Date(startDate);
  let daysAdded = 0;
  let iterations = 0;

  while (daysAdded < numDays && iterations < 1000) {
    iterations++;
    if (skipWeekends && isWeekend(currentDate)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    for (let s = 1; s <= sessionsPerDay; s++) {
      timeSlots.push({
        date: new Date(currentDate),
        session: s,
      });
    }

    currentDate = addDays(currentDate, 1);
    daysAdded++;
  }

  // Create an "Extra Buffer Day" for leftover clashes
  // If user provided a date, use it. Otherwise calculate next working day.
  let bufferDate: Date;
  if (bufferDateInput) {
    bufferDate = new Date(bufferDateInput);
  } else {
    bufferDate = new Date(currentDate);
    while (skipWeekends && isWeekend(bufferDate)) {
      bufferDate = addDays(bufferDate, 1);
    }
  }
  
  const bufferSlot: TimeSlot = {
    date: bufferDate,
    session: 1 // Always first session of buffer day
  };

  const allSlots = [...timeSlots];
  // Note: We don't push bufferSlot to allSlots yet because we only want to use it as a 
  // last resort, not during the regular Welsh-Powell assignment.
  
  // 5. Graph Coloring (Welsh-Powell Algorithm)
  // Extract previous assignments if available (either from previousResult or inferred from records)
  const previousAssignments = new Map<string, number>();
  
  if (previousResult) {
    previousResult.scheduledCourses.forEach(sc => {
      if (sc.timeSlot) {
        const slotIndex = timeSlots.findIndex(ts => 
          ts.date.getTime() === sc.timeSlot!.date.getTime() && 
          ts.session === sc.timeSlot!.session
        );
        if (slotIndex !== -1) {
          previousAssignments.set(sc.matchId, slotIndex);
        }
      }
    });
  } else {
    // Inferred assignments: Look at standardizedRecords to see if they already have Date/Session
    standardizedRecords.forEach(std => {
      const dateVal = std.original['Date'];
      const sessionVal = std.original['Session'];
      if (dateVal && sessionVal) {
        // Find matching slotIndex in timeSlots
        const slotIndex = timeSlots.findIndex(ts => {
          const formattedDate = format(ts.date, 'dd-MMM-yy');
          const formattedSession = `Session ${ts.session}`;
          return formattedDate === dateVal && formattedSession === sessionVal;
        });
        if (slotIndex !== -1) {
          previousAssignments.set(std.matchId, slotIndex);
        }
      }
    });
  }

  // Sort courses: Previously scheduled courses first, then by degree (number of conflicts) descending
  courses.sort((a, b) => {
    const aHasPrev = previousAssignments.has(a.matchId);
    const bHasPrev = previousAssignments.has(b.matchId);
    
    if (aHasPrev && !bHasPrev) return -1;
    if (!aHasPrev && bHasPrev) return 1;
    
    return (conflicts.get(b.matchId)?.size || 0) - (conflicts.get(a.matchId)?.size || 0);
  });

  const scheduledCourses: ScheduledCourse[] = [];
  const slotAssignments = new Map<string, number>(); // matchId -> slotIndex (-1 for buffer day)
  const slotStudentCounts = new Array(timeSlots.length).fill(0); // For balancing Mid-term

  let totalClashes = 0;
  const unresolvedConflicts: { student: string; course1: string; course2: string }[] = [];

  courses.forEach((course) => {
    let assignedSlot = -1;

    // 1. Force keep previous assignment for consistency in late registrations
    const prevSlotIndex = previousAssignments.get(course.matchId);
    if (prevSlotIndex !== undefined) {
      // In late registration mode, we MUST NOT change existing dates for existing subjects
      assignedSlot = prevSlotIndex;
    }

    // 2. Find the best available slot for NEW subjects
    if (assignedSlot === -1) {
      let preferredIndices: number[] = [];
      if (course.isMS) {
        for (let i = 0; i < timeSlots.length; i++) if (timeSlots[i].session === 2) preferredIndices.push(i);
        for (let i = 0; i < timeSlots.length; i++) if (timeSlots[i].session !== 2) preferredIndices.push(i);
      } else {
        for (let i = 0; i < timeSlots.length; i++) preferredIndices.push(i);
      }

      // Find slot with ZERO conflicts first
      for (const i of preferredIndices) {
        let hasConflict = false;
        const neighbors = conflicts.get(course.matchId)!;
        neighbors.forEach((neighbor) => {
          if (slotAssignments.get(neighbor) === i) hasConflict = true;
        });

        if (!hasConflict) {
          assignedSlot = i;
          break;
        }
      }
    }

    if (assignedSlot !== -1) {
      slotAssignments.set(course.matchId, assignedSlot);
      slotStudentCounts[assignedSlot] += course.students.size;
      scheduledCourses.push({
        ...course,
        timeSlot: timeSlots[assignedSlot],
      });
    } else {
      // LAST RESORT: Move to Buffer Day!
      // This course has conflicts in all regular slots
      scheduledCourses.push({
        ...course,
        timeSlot: bufferSlot,
        _isForced: true,
        _isBufferDay: true // Mark as buffer day
      } as any);
      
      slotAssignments.set(course.matchId, -99); // Use special index for buffer day
      
      // Note: We don't increment totalClashes here because moving to a new day 
      // resolves the conflict for the regular schedule.
    }
  });

  // 6. Map back to original records
  const finalDatesheet = standardizedRecords.map((stdRecord) => {
    const scheduled = scheduledCourses.find((c) => c.matchId === stdRecord.matchId);
    const isForced = (scheduled as any)?._isForced || false;
    const isBufferDay = (scheduled as any)?._isBufferDay || false;

    const newRecord: any = {};
    if (scheduled?.timeSlot) {
      newRecord['Date'] = format(scheduled.timeSlot.date, 'dd-MMM-yy');
      newRecord['Session'] = isBufferDay ? 'Extra Session' : `Session ${scheduled.timeSlot.session}`;
    } else {
      newRecord['Date'] = 'Unscheduled';
      newRecord['Session'] = 'Unscheduled';
    }

    newRecord['_isForced'] = isForced;
    newRecord['_isBufferDay'] = isBufferDay;

    // Copy original properties
    Object.keys(stdRecord.original).forEach(key => {
      if (key.toLowerCase() !== 'date' && key.toLowerCase() !== 'session') {
        let val = stdRecord.original[key];
        if (isBufferDay && (key.toLowerCase() === 'subject' || key.toLowerCase().includes('course'))) {
          val = `[EXTRA DAY] ${val}`;
        }
        newRecord[key] = val;
      }
    });

    return newRecord;
  });

  // Sort datesheet by Date and Session
  finalDatesheet.sort((a, b) => {
    if (a.Date === 'Unscheduled') return 1;
    if (b.Date === 'Unscheduled') return -1;
    
    const dateA = new Date(a.Date).getTime();
    const dateB = new Date(b.Date).getTime();
    
    if (dateA !== dateB) return dateA - dateB;
    
    return String(a.Session).localeCompare(String(b.Session));
  });

  return {
    datesheet: finalDatesheet,
    scheduledCourses,
    totalClashes,
    totalCourses: courses.length,
    totalStudents: studentCourses.size,
    unresolvedConflicts,
    examType
  };
}
