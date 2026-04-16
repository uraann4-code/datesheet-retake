import React from 'react';
import { Download, AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Building2, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ApprovableRecord } from './ApprovalPanel';

interface ResultsTableProps {
  data: any[];
  records: ApprovableRecord[];
  totalClashes: number;
  totalCourses: number;
  totalStudents: number;
  unresolvedConflicts: { student: string; course1: string; course2: string }[];
}

export function ResultsTable({
  data,
  records,
  totalClashes,
  totalCourses,
  totalStudents,
  unresolvedConflicts,
}: ResultsTableProps) {
  const handleExportDatesheet = () => {
    if (!data || data.length === 0) return;

    // Find keys from the data
    const keys = Object.keys(data[0]);
    const findKey = (searchTerms: string[]) => {
      return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
    };

    const nameKey = findKey(['name']) || 'Name';
    const enrollmentKey = findKey(['enrollment', 'registration']) || 'Enrollment';
    const programKey = findKey(['program', 'class', 'degree']) || 'Program';
    const subjectKey = findKey(['subject', 'course']) || 'Subject';
    const codeKey = findKey(['code', 'coursecode']) || 'Course Code';
    const teacherKey = findKey(['teacher']) || 'Teacher Name';

    // Map data to the required format
    const exportData = data.map((row, index) => {
      // Convert "Session 1" to "I", "Session 2" to "II"
      let session = row['Session'] || '';
      if (session === 'Session 1') session = 'I';
      else if (session === 'Session 2') session = 'II';

      return {
        'Sr #': index + 1,
        'Date': row['Date'] || '',
        'Session': session,
        'Name': row[nameKey] || '',
        'Enrollment': row[enrollmentKey] || '',
        'Program': row[programKey] || '',
        'Subject': row[subjectKey] || '',
        'Course Code': row[codeKey] || '',
        'Teacher Name': row[teacherKey] || ''
      };
    });

    // Create worksheet starting with title
    const ws = XLSX.utils.aoa_to_sheet([['RE-TAKE FINAL EXAM FALL 2025 SEMESTER']]);
    
    // Add data starting at A2
    XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A2' });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datesheet');

    // Write file
    XLSX.writeFile(wb, 'Exam_Datesheet.xlsx');
  };

    const handleExportDGIC = () => {
    if (!records || records.length === 0) return;
    
    // Filter out pending records for DGIC export
    const actedRecords = records.filter(r => r._status !== 'pending');
    
    // Sort records: Recommended (approved/late_approved) first, then others
    const sortedRecords = [...actedRecords].sort((a, b) => {
      const isARecommended = a._status === 'approved' || a._status === 'late_approved' ? 0 : 1;
      const isBRecommended = b._status === 'approved' || b._status === 'late_approved' ? 0 : 1;
      return isARecommended - isBRecommended;
    });

    // Find keys from the original data that match the required columns
    const keys = Object.keys(records[0]).filter(k => !k.startsWith('_'));
    const findKey = (searchTerms: string[]) => {
      return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
    };

    const nameKey = findKey(['name']) || 'Name';
    const enrollmentKey = findKey(['enrollment', 'registration']) || 'Enrollment';
    const classKey = findKey(['class', 'program']) || 'Class';
    const subjectKey = findKey(['subject', 'course']) || 'Subject';
    const codeKey = findKey(['code', 'coursecode']) || 'CODE';
    const teacherKey = findKey(['teacher']) || 'Teacher Name';
    const remarksKey = findKey(['remark', 'reason']) || 'Remarks(If Any)';

    // Create the data for the sheet
    const exportData = sortedRecords.map((row, index) => {
      let decision = '';
      if (row._status === 'approved') decision = 'Recommended';
      else if (row._status === 'late_approved') decision = 'Recommended (Late)';
      else if (row._status === 'rejected') decision = 'Not Recommended';
      else decision = 'Pending';

      return {
        'S#': index + 1,
        'Name': row[nameKey] || '',
        'Enrollment': row[enrollmentKey] || '',
        'Class': row[classKey] || '',
        'Subject': row[subjectKey] || '',
        'CODE': row[codeKey] || '',
        'Teacher Name': row[teacherKey] || '',
        'Remarks(If Any)': row[remarksKey] || '',
        'DECission': decision
      };
    });

    // Create worksheet starting with title
    const ws = XLSX.utils.aoa_to_sheet([['Retake Applications of Final Term Exam - Fall - 2024']]);
    
    // Add data starting at A2
    XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A2' });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DGIC');

    // Write file
    XLSX.writeFile(wb, 'DG_IC_Approval_File.xlsx');
  };

  const handleExportAccountOffice = () => {
    if (!records || records.length === 0) return;
    const nameKey = Object.keys(records[0]).find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('teacher')) || 'Name';
    
    const filtered = records
      .filter(r => r._status === 'approved' || r._status === 'late_approved')
      .sort((a, b) => String(a[nameKey] || '').localeCompare(String(b[nameKey] || '')))
      .map(r => {
        const newRow: any = {};
        Object.keys(r).forEach(k => {
          if (!k.startsWith('_')) newRow[k] = r[k];
        });
        newRow['DECission'] = 'Recommended';
        return newRow;
      });
      
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Account Office');
    XLSX.writeFile(wb, 'Account_Office_File.xlsx');
  };

  const handleExportDepartment = () => {
    if (!records || records.length === 0) return;
    const remarksKey = Object.keys(records[0]).find(k => k.toLowerCase().includes('remark') || k.toLowerCase().includes('reason'));
    
    const filtered = records
      .filter(r => r._status === 'approved' || r._status === 'late_approved')
      .map(r => {
        const newRow: any = {};
        Object.keys(r).forEach(k => {
          if (!k.startsWith('_') && k !== remarksKey) {
            newRow[k] = r[k];
          }
        });
        newRow['DECission'] = 'Recommended';
        return newRow;
      });
      
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Department');
    XLSX.writeFile(wb, 'Department_File.xlsx');
  };

  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Datesheet Generated (Approved Cases Only) 🎉</h2>
            <p className="text-gray-500 mt-1">Only Recommended/Approved cases have been scheduled.</p>
          </div>
          <button
            onClick={handleExportDatesheet}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-bold text-base w-full sm:w-auto justify-center"
          >
            <CalendarDays className="w-5 h-5" />
            Download Datesheet
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Scheduled Courses</p>
            <p className="text-2xl font-bold text-gray-800">{totalCourses}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Students</p>
            <p className="text-2xl font-bold text-gray-800">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div
            className={`p-3 rounded-lg ${
              totalClashes > 0
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}
          >
            {totalClashes > 0 ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <CheckCircle2 className="w-6 h-6" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Unresolved Clashes</p>
            <p
              className={`text-2xl font-bold ${
                totalClashes > 0 ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {totalClashes}
            </p>
          </div>
        </div>
      </div>

      {unresolvedConflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl">
          <h4 className="text-red-800 font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Warning: Some students have overlapping exams
          </h4>
          <p className="text-sm text-red-700 mb-2">
            Not enough time slots to resolve all conflicts. Consider increasing days or sessions.
          </p>
          <ul className="text-xs text-red-600 list-disc list-inside max-h-32 overflow-y-auto">
            {unresolvedConflicts.slice(0, 10).map((conflict, i) => (
              <li key={i}>
                Student {conflict.student} has {conflict.course1} and {conflict.course2} at the same time.
              </li>
            ))}
            {unresolvedConflicts.length > 10 && (
              <li>...and {unresolvedConflicts.length - 10} more.</li>
            )}
          </ul>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-800">Generated Datesheet</h3>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 shadow-sm">
              <tr>
                {headers.map((header) => (
                  <th key={header} className="px-6 py-3 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr
                  key={index}
                  className="bg-white border-b hover:bg-gray-50 transition-colors"
                >
                  {headers.map((header) => (
                    <td
                      key={`${index}-${header}`}
                      className={`px-6 py-4 ${
                        header === 'Date' || header === 'Session'
                          ? 'font-semibold text-gray-900'
                          : ''
                      }`}
                    >
                      {row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
