import React, { useState } from 'react';
import { Layers, ListFilter, Download, FileSpreadsheet, Upload, CheckCircle2, X, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { unmergeAndFill, sortRecordsByRecommendation } from '../lib/excelProcessor';
import { AttendanceSheetGenerator } from './AttendanceSheetGenerator';

export function DataTools() {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const handleTool = async (tool: 'unmerge' | 'sort' | 'dgic') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(tool);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const binary = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(binary, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          
          let data: any[] = [];
          let fileName = '';

          if (tool === 'unmerge') {
            data = unmergeAndFill(workbook, sheetName);
            fileName = 'Fixed_Unmerged_File.xlsx';
          } else if (tool === 'sort') {
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet);
            data = sortRecordsByRecommendation(rawData);
            fileName = 'Sorted_Recommendations.xlsx';
          } else if (tool === 'dgic') {
            const worksheet = workbook.Sheets[sheetName];
            const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
            
            if (rawData.length === 0) {
              alert("The file is empty.");
              return;
            }

            // Robust header matching
            const keys = Object.keys(rawData[0]);
            const findKey = (searchTerms: string[]) => {
              return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
            };

            const nameKey = findKey(['name']) || 'Name';
            const enrollmentKey = findKey(['enrollment', 'registration', 'reg#']) || 'Enrollment';
            const classKey = findKey(['class', 'program']) || 'Class';
            const subjectKey = findKey(['subject', 'course']) || 'Subject';
            const codeKey = findKey(['code', 'coursecode']) || 'CODE';
            const teacherKey = findKey(['teacher']) || 'Teacher Name';
            const remarksKey = findKey(['remark', 'reason']) || 'Remarks(If Any)';
            const recKey = findKey(['recommend', 'status', 'decision', 'result']) || 'Decision';

            data = rawData.map((row: any, idx: number) => {
              const status = String(row[recKey] || "").toLowerCase();
              let decision = 'Pending';
              if (status.includes('recommended') && !status.includes('not')) decision = 'Recommended';
              else if (status.includes('not')) decision = 'Not Recommended';

              return {
                'S#': idx + 1,
                'Name': row[nameKey] || '',
                'Enrollment': row[enrollmentKey] || '',
                'Class': row[classKey] || '',
                'Subject': row[subjectKey] || '',
                'Course Code': row[codeKey] || '',
                'Teacher Name': row[teacherKey] || '',
                'Remarks(If Any)': row[remarksKey] || '',
                'Decision': decision
              };
            });
            fileName = 'DGIC_Format_File.xlsx';
          }

          // Create new workbook and download
          const ws = XLSX.utils.json_to_sheet(data);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'ProcessedData');
          XLSX.writeFile(wb, fileName);
          
        } catch (err) {
          console.error(err);
          alert("Error processing file. Please ensure it's a valid Excel format.");
        } finally {
          setIsProcessing(null);
        }
      };
      
      reader.readAsArrayBuffer(file);
    };
    
    input.click();
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          Quick Data Tools
        </h3>
        <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest">Pre-process your files efficiently</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Tool 1: Unmerge */}
        <button
          onClick={() => handleTool('unmerge')}
          disabled={isProcessing !== null}
          className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left"
        >
          <div className={`p-3 rounded-xl transition-colors ${isProcessing === 'unmerge' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
            {isProcessing === 'unmerge' ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Layers className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 group-hover:text-blue-700">1. Unmerge & Fill Cells</p>
            <p className="text-xs text-gray-500">Fix merged rows by filling down duplicated data.</p>
          </div>
        </button>

        {/* Tool 2: Sort Recommendation */}
        <button
          onClick={() => handleTool('sort')}
          disabled={isProcessing !== null}
          className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-purple-200 hover:bg-purple-50 transition-all text-left"
        >
          <div className={`p-3 rounded-xl transition-colors ${isProcessing === 'sort' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white'}`}>
             {isProcessing === 'sort' ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ListFilter className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 group-hover:text-purple-700">2. Sort by Recommendation</p>
            <p className="text-xs text-gray-500">Move all "Recommended" cases to the top automatically.</p>
          </div>
        </button>

        {/* Tool 3: DGIC Format */}
        <button
          onClick={() => handleTool('dgic')}
          disabled={isProcessing !== null}
          className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-green-200 hover:bg-green-50 transition-all text-left"
        >
          <div className={`p-3 rounded-xl transition-colors ${isProcessing === 'dgic' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600 group-hover:bg-green-600 group-hover:text-white'}`}>
             {isProcessing === 'dgic' ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileSpreadsheet className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 group-hover:text-green-700">3. DGIC Format Converter</p>
            <p className="text-xs text-gray-500">Convert any list into the official DGIC approval format.</p>
          </div>
        </button>

        {/* Tool 4: Attendance Sheets */}
        <button
          onClick={() => setShowAttendanceModal(true)}
          disabled={isProcessing !== null}
          className="group flex items-center gap-4 p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50 transition-all text-left"
        >
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
             <Users className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 group-hover:text-blue-700">4. Make Attendance Sheets</p>
            <p className="text-xs text-gray-500">Create room-wise attendance PDFs from datesheet & student data.</p>
          </div>
        </button>
      </div>

      {showAttendanceModal && (
        <AttendanceSheetGenerator onClose={() => setShowAttendanceModal(false)} />
      )}

      <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
        <p className="text-[10px] text-amber-800 font-bold leading-tight">
          Info: These tools are standalone. Upload a file, and it will download the processed version immediately without affecting your current workspace.
        </p>
      </div>
    </div>
  );
}
