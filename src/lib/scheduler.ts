import { addDays, isWeekend, format } from 'date-fns';

export interface TimeSlot {
  date: Date;
  session: number;
}

export interface Course {
  courseCode: string;
  subject: string;
  students: Set<string>;
  teacherName: string;
}

export interface ScheduledCourse extends Course {
  timeSlot?: TimeSlot;
}

export interface ScheduleResult {
  datesheet: any[];
  scheduledCourses: ScheduledCourse[];
  totalClashes: number;
  totalCourses: number;
  totalStudents: number;
  unresolvedConflicts: { student: string; course1: string; course2: string }[];
}

export function generateSchedule(
  records: any[],
  startDate: Date,
  numDays: number,
  sessionsPerDay: number,
  skipWeekends: boolean = true
): ScheduleResult {
  // 1. Identify columns globally
  const allKeys = new Set<string>();
  records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const keys = Array.from(allKeys);

  const findKey = (searchTerms: string[]) => {
    return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
  };

  const enrollmentKey = findKey(['enrollment', 'registration', 'studentid', 'regno', 'rollno']);
  const courseCodeKey = findKey(['coursecode', 'subjectcode']) || findKey(['course']);
  const subjectKey = findKey(['subject', 'coursename', 'coursetitle']);
  const teacherKey = findKey(['teacher', 'instructor', 'faculty']);

  // 2. Extract unique courses and their students
  const coursesMap = new Map<string, Course>();
  const studentCourses = new Map<string, Set<string>>();

  // Standardize records
  const standardizedRecords = records.map(record => {
    const enrollment = enrollmentKey ? String(record[enrollmentKey] || '').trim() : '';
    let courseCode = courseCodeKey ? String(record[courseCodeKey] || '').trim() : '';
    const subject = subjectKey ? String(record[subjectKey] || '').trim() : '';
    const teacherName = teacherKey ? String(record[teacherKey] || '').trim() : '';

    if (!courseCode && subject) {
      courseCode = subject;
    }

    const normalizedCourseCode = courseCode.toUpperCase();

    return {
      original: record,
      enrollment,
      courseCode: normalizedCourseCode,
      originalCourseCode: courseCode,
      subject,
      teacherName
    };
  });

  standardizedRecords.forEach((record) => {
    if (!record.enrollment || !record.courseCode) return;

    if (!coursesMap.has(record.courseCode)) {
      coursesMap.set(record.courseCode, {
        courseCode: record.courseCode,
        subject: record.subject || record.originalCourseCode,
        students: new Set(),
        teacherName: record.teacherName,
      });
    }
    coursesMap.get(record.courseCode)!.students.add(record.enrollment);

    if (!studentCourses.has(record.enrollment)) {
      studentCourses.set(record.enrollment, new Set());
    }
    studentCourses.get(record.enrollment)!.add(record.courseCode);
  });

  const courses = Array.from(coursesMap.values());

  // 3. Build conflict graph
  const conflicts = new Map<string, Set<string>>();
  courses.forEach((c) => conflicts.set(c.courseCode, new Set()));

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

  // 5. Graph Coloring (Welsh-Powell Algorithm)
  // Sort courses by degree (number of conflicts) descending
  courses.sort((a, b) => conflicts.get(b.courseCode)!.size - conflicts.get(a.courseCode)!.size);

  const scheduledCourses: ScheduledCourse[] = [];
  const slotAssignments = new Map<string, number>(); // courseCode -> slotIndex

  let totalClashes = 0;
  const unresolvedConflicts: { student: string; course1: string; course2: string }[] = [];

  courses.forEach((course) => {
    let assignedSlot = -1;
    let minConflictSlot = -1;
    let minConflicts = Infinity;

    for (let i = 0; i < timeSlots.length; i++) {
      let hasConflict = false;
      let currentSlotConflicts = 0;

      const neighbors = conflicts.get(course.courseCode)!;
      neighbors.forEach((neighbor) => {
        if (slotAssignments.get(neighbor) === i) {
          hasConflict = true;
          currentSlotConflicts++;
        }
      });

      if (!hasConflict) {
        assignedSlot = i;
        break;
      }

      if (currentSlotConflicts < minConflicts) {
        minConflicts = currentSlotConflicts;
        minConflictSlot = i;
      }
    }

    if (assignedSlot !== -1) {
      slotAssignments.set(course.courseCode, assignedSlot);
      scheduledCourses.push({
        ...course,
        timeSlot: timeSlots[assignedSlot],
      });
    } else if (minConflictSlot !== -1) {
      // If no slot without conflict is found, assign the one with minimum conflicts
      slotAssignments.set(course.courseCode, minConflictSlot);
      scheduledCourses.push({
        ...course,
        timeSlot: timeSlots[minConflictSlot],
      });
      totalClashes += minConflicts;
      
      // Record the specific conflicts
      const neighbors = conflicts.get(course.courseCode)!;
      neighbors.forEach((neighbor) => {
        if (slotAssignments.get(neighbor) === minConflictSlot) {
          // Find students taking both courses
          const studentsInCourse = course.students;
          const studentsInNeighbor = coursesMap.get(neighbor)!.students;
          studentsInCourse.forEach(student => {
            if (studentsInNeighbor.has(student)) {
              unresolvedConflicts.push({
                student,
                course1: course.courseCode,
                course2: neighbor
              });
            }
          });
        }
      });
    } else {
      scheduledCourses.push({
        ...course,
      });
    }
  });

  // 6. Map back to original records
  const finalDatesheet = standardizedRecords.map((stdRecord) => {
    const scheduled = scheduledCourses.find((c) => c.courseCode === stdRecord.courseCode);

    // Create a new object with Date and Session at the beginning
    const newRecord: any = {};
    if (scheduled?.timeSlot) {
      newRecord['Date'] = format(scheduled.timeSlot.date, 'dd-MMM-yy');
      newRecord['Session'] = `Session ${scheduled.timeSlot.session}`;
    } else {
      newRecord['Date'] = 'Unscheduled';
      newRecord['Session'] = 'Unscheduled';
    }

    // Copy original properties
    Object.keys(stdRecord.original).forEach(key => {
      // Don't overwrite if the original record already had Date/Session but we want to use our generated ones
      if (key.toLowerCase() !== 'date' && key.toLowerCase() !== 'session') {
        newRecord[key] = stdRecord.original[key];
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
    unresolvedConflicts
  };
}
