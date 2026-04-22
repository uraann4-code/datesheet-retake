import React, { useState } from 'react';
import { FileText, Upload, X, CheckCircle2, AlertTriangle, Download, ArrowRight, Settings, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { processExcelData } from '../lib/excelProcessor';

interface AttendanceSheetGeneratorProps {
  onClose: () => void;
}

export function AttendanceSheetGenerator({ onClose }: AttendanceSheetGeneratorProps) {
  const [datesheetData, setDatesheetData] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [roomCapacity, setRoomCapacity] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'datesheet' | 'source') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binary = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binary, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        
        let jsonData: any[] = [];
        if (type === 'datesheet') {
          // Datesheet just needs basic parsing
          const worksheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet);
        } else {
          // Source data needs robust student/course parsing
          jsonData = processExcelData(workbook, sheetName);
        }
        
        if (type === 'datesheet') setDatesheetData(jsonData);
        else setSourceData(jsonData);
      } catch (err) {
        console.error(err);
        alert("Failed to process file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateAttendanceSheets = async () => {
    if (datesheetData.length === 0 || sourceData.length === 0) {
      alert("Please upload both Datesheet and Source Student List.");
      return;
    }

    setIsProcessing(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let isFirstPage = true;

      // Group students by Subject first to match with datesheet
      const studentsBySubject: Record<string, any[]> = {};
      sourceData.forEach(student => {
        const subKey = Object.keys(student).find(k => k.toLowerCase().match(/subject|course|coursename|coursetitle|sub/)) || 'Subject';
        const subject = String(student[subKey] || "").trim().toUpperCase();
        if (!studentsBySubject[subject]) studentsBySubject[subject] = [];
        studentsBySubject[subject].push(student);
      });

      // Group Datesheet entries by Date and Session
      const sessions: Record<string, any[]> = {};
      datesheetData.forEach(entry => {
        const date = String(entry['Date'] || "").trim();
        const session = String(entry['Session'] || "").trim();
        const subject = String(entry['Subject'] || entry['Course Title'] || "").trim().toUpperCase();
        
        if (!date || !session || !subject) return;
        
        const key = `${date}|${session}`;
        if (!sessions[key]) sessions[key] = [];
        sessions[key].push({ ...entry, subject });
      });

      // Process each Session
      for (const [key, sessionSubjects] of Object.entries(sessions)) {
        const [date, session] = key.split('|');
        
        // Collect all students for this session
        let sessionStudents: any[] = [];
        sessionSubjects.forEach(subEntry => {
          const matchingStudents = studentsBySubject[subEntry.subject] || [];
          // Add subject and teacher info to each student for the sheet
          matchingStudents.forEach(s => {
            sessionStudents.push({
              ...s,
              _date: date,
              _session: session,
              _subject: subEntry.subject,
              _teacher: subEntry['Teacher Name'] || s['Teacher Name'] || s['Teacher'] || ''
            });
          });
        });

        if (sessionStudents.length === 0) continue;

        // Split students into rooms based on capacity
        const roomsCount = Math.ceil(sessionStudents.length / roomCapacity);
        
        for (let i = 0; i < roomsCount; i++) {
          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;

          const roomNumber = i + 1;
          const startIdx = i * roomCapacity;
          const roomStudents = sessionStudents.slice(startIdx, startIdx + roomCapacity);

          // PDF Header
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('BAHRIA UNIVERSITY - ISLAMABAD CAMPUS', 105, 15, { align: 'center' });
          
          pdf.setFontSize(10);
          pdf.text('ATTENDANCE-SHEET - RE-TAKE EXAM SEMESTER', 105, 22, { align: 'center' });

          // ROOM / DATE / SESSION LABELS
          pdf.setFontSize(9);
          pdf.text(`ROOM # ${roomNumber}`, 20, 30);
          pdf.text(`Dated: ${date}`, 105, 30, { align: 'center' });
          pdf.text(`Session - ${session}`, 190, 30, { align: 'right' });

          // Table Preparation
          const tableHeaders = [['S#', 'NAME', 'ENROLLMENT NO', 'CLASS', 'SUBJECT', 'TEACHER NAME', 'SHEET #', 'SIGN']];
          const tableData = roomStudents.map((s, idx) => {
            const nameKey = Object.keys(s).find(k => k.toLowerCase().match(/name/)) || 'Name';
            const enrolKey = Object.keys(s).find(k => k.toLowerCase().match(/enrollment|reg/)) || 'Enrollment';
            const classKey = Object.keys(s).find(k => k.toLowerCase().match(/class|program/)) || 'Class';
            
            return [
              idx + 1,
              s[nameKey] || '',
              s[enrolKey] || '',
              s[classKey] || '',
              s._subject || '',
              s._teacher || '',
              '',
              ''
            ];
          });

          autoTable(pdf, {
            head: tableHeaders,
            body: tableData,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
            bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 10 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
              0: { cellWidth: 8 },
              1: { cellWidth: 35 },
              2: { cellWidth: 25 },
              3: { cellWidth: 20 },
              4: { cellWidth: 35 },
              5: { cellWidth: 25 },
              6: { cellWidth: 15 },
              7: { cellWidth: 25 }
            }
          });

          // Footer
          const finalY = (pdf as any).lastAutoTable.finalY + 10;
          pdf.text(`Page 1 of 1`, 105, 285, { align: 'center' });
        }
      }

      pdf.save(`Attendance_Sheets_${new Date().toLocaleDateString()}.pdf`);
      alert("Attendance Sheets generated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error generating PDF.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Generate Attendance Sheets</h2>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Automated Room Allocation & Formatting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Step 1: Upload Datesheet */}
            <div className={`space-y-4 transition-all ${datesheetData.length > 0 ? 'opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${datesheetData.length > 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                  {datesheetData.length > 0 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
                </div>
                <h4 className="font-black text-gray-800 uppercase tracking-tight">Upload Datesheet</h4>
              </div>
              
              <label className={`flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                datesheetData.length > 0 ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <Upload className="w-8 h-8 opacity-50" />
                <div className="text-center">
                  <p className="text-sm font-black text-gray-700">{datesheetData.length > 0 ? 'Datesheet Loaded' : 'Select Datesheet File'}</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-60">Source for Date/Session/Rooms</p>
                </div>
                {datesheetData.length > 0 && <p className="text-xs font-bold mt-2">{datesheetData.length} entries found</p>}
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'datesheet')} />
              </label>
            </div>

            {/* Step 2: Upload Student List */}
            <div className={`space-y-4 transition-all ${sourceData.length > 0 ? 'opacity-100' : 'opacity-100'}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${sourceData.length > 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                   {sourceData.length > 0 ? <CheckCircle2 className="w-5 h-5" /> : '2'}
                </div>
                <h4 className="font-black text-gray-800 uppercase tracking-tight">Upload Student List</h4>
              </div>

              <label className={`flex flex-col items-center justify-center gap-3 w-full p-8 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
                sourceData.length > 0 ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-blue-400 hover:bg-blue-50'
              }`}>
                <Users className="w-8 h-8 opacity-50" />
                <div className="text-center">
                  <p className="text-sm font-black text-gray-700">{sourceData.length > 0 ? 'Student List Loaded' : 'Select Student Data'}</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-60">Names, Enrollment, Teachers</p>
                </div>
                {sourceData.length > 0 && <p className="text-xs font-bold mt-2">{sourceData.length} records found</p>}
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={(e) => handleFileUpload(e, 'source')} />
              </label>
            </div>
          </div>

          <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
            <h4 className="flex items-center gap-2 font-black text-gray-800 uppercase tracking-tight text-sm">
              <Settings className="w-4 h-4 text-blue-600" />
              Room Allocation Settings
            </h4>
            <div className="flex items-center gap-6">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Students per Room (Capacity)</label>
                <input 
                  type="number" 
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold"
                />
              </div>
              <div className="hidden sm:block">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] text-blue-700 font-bold uppercase tracking-widest">Logic Info</p>
                  <p className="text-xs text-blue-900 font-medium mt-1">If session has 70 students and capacity is 30, system will create 3 sheets: Room 1 (30), Room 2 (30), Room 3 (10).</p>
                </div>
              </div>
            </div>
          </div>

          {datesheetData.length > 0 && sourceData.length > 0 && (
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 w-full max-w-md">
                <div className="p-2 bg-green-500 text-white rounded-lg">
                   <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Ready to Generate</p>
                  <p className="text-xs text-gray-500">Matching {sourceData.length} students with your schedule.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 px-6 border-2 border-gray-200 text-gray-500 font-black rounded-2xl hover:bg-white transition-all uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
          <button 
            disabled={isProcessing || !datesheetData.length || !sourceData.length}
            onClick={generateAttendanceSheets}
            className={`flex-[2] py-4 px-6 font-black rounded-2xl transition-all shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 ${
              isProcessing || !datesheetData.length || !sourceData.length
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {isProcessing ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
            {isProcessing ? 'Generating...' : 'Download Attendance Sheets (PDF)'}
          </button>
        </div>
      </div>
    </div>
  );
}
