import React from 'react';
import { Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ResultsTableProps {
  data: any[];
  totalClashes: number;
  totalCourses: number;
  totalStudents: number;
  unresolvedConflicts: { student: string; course1: string; course2: string }[];
}

export function ResultsTable({
  data,
  totalClashes,
  totalCourses,
  totalStudents,
  unresolvedConflicts,
}: ResultsTableProps) {
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datesheet');
    XLSX.writeFile(wb, 'generated_datesheet.xlsx');
  };

  if (!data || data.length === 0) return null;

  const headers = Object.keys(data[0]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Schedule Generated Successfully!</h2>
          <p className="text-sm text-gray-500">Review the summary below or download the full datesheet.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg font-semibold text-base w-full sm:w-auto justify-center"
        >
          <Download className="w-5 h-5" />
          Download Excel File
        </button>
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
