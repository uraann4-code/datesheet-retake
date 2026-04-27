import React, { useState } from 'react';
import { FileText, Upload, X, CheckCircle2, AlertTriangle, Download, ArrowRight, Settings, Users, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { processExcelData } from '../lib/excelProcessor';

interface AttendanceSheetGeneratorProps {
  onClose: () => void;
}

export function AttendanceSheetGenerator({ onClose }: AttendanceSheetGeneratorProps) {
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [roomCapacity, setRoomCapacity] = useState(30);
  const [isProcessing, setIsProcessing] = useState<'pdf' | 'excel' | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binary = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binary, { type: 'array', cellDates: true });
        
        let allData: any[] = [];
        
        // Process all sheets in case it's a multi-sheet export being "fixed"
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'dd-mm-yy' }) as any[][];
          
          if (rawData.length === 0) return;

          // Attempt to extract Date and Session from metadata rows (usually line 3)
          let sheetDate = "";
          let sheetSession = "";
          const metaSearchArea = rawData.slice(0, 5);
          metaSearchArea.forEach(rowArr => {
            if (!rowArr) return;
            rowArr.forEach(cell => {
              const cellStr = String(cell);
              if (cellStr.toLowerCase().includes('dated:')) {
                sheetDate = cellStr.split(/dated:/i)[1]?.split(',')[0]?.trim() || "";
              }
              if (cellStr.toLowerCase().includes('session -')) {
                sheetSession = cellStr.split(/session -/i)[1]?.split(',')[0]?.trim() || "";
              }
            });
          });

          // Find the header row (the one containing S# or Name or Enrollment or Subject)
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(rawData.length, 15); i++) {
            const row = rawData[i];
            if (row && row.some(cell => {
              const cellStr = String(cell).toLowerCase();
              return cellStr.includes('s#') || 
                     cellStr.includes('name') || 
                     cellStr.includes('enrollment') || 
                     cellStr.includes('subject');
            })) {
              headerRowIndex = i;
              break;
            }
          }

          if (headerRowIndex !== -1) {
            const headers = rawData[headerRowIndex];
            const rows = rawData.slice(headerRowIndex + 1);
            const sheetJson = rows.map(row => {
              const obj: any = {};
              headers.forEach((h, idx) => {
                if (h) {
                  const cleanHeader = String(h).trim().toUpperCase();
                  obj[cleanHeader] = row[idx];
                }
              });
              
              // If date/session are missing from row data, use header metadata
              const dKey = Object.keys(obj).find(k => k.includes('DATE')) || 'DATE';
              const sKey = Object.keys(obj).find(k => k.includes('SESSION')) || 'SESSION';
              if (!obj[dKey] && sheetDate) obj[dKey] = sheetDate;
              if (!obj[sKey] && sheetSession) obj[sKey] = sheetSession;
              
              return obj;
            }).filter(row => row['NAME'] || row['Name'] || row['ENROLLMENT NO'] || row['Enrollment']);

            allData = [...allData, ...sheetJson];
          } else {
            // Fallback to standard parsing if no clear header found
            const fallback = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd-mm-yy' });
            allData = [...allData, ...fallback];
          }
        });
        
        if (allData.length === 0) {
          alert("The file seems empty or headers not found.");
          return;
        }
        setSourceData(allData);
      } catch (err) {
        console.error(err);
        alert("Failed to process file. Please ensure it is a valid Excel file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateAttendanceSheets = async (format: 'pdf' | 'excel' = 'pdf') => {
    if (sourceData.length === 0) {
      alert("Please upload your data file first.");
      return;
    }

    setIsProcessing(format);
    // Give UI a moment to update
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Improved robust key finding
      const findKey = (data: any[], terms: string[]) => {
        const keys = Object.keys(data[0] || {});
        // Try exact match first
        const exact = keys.find(k => terms.some(t => k.toLowerCase() === t.toLowerCase()));
        if (exact) return exact;
        // Then try includes
        return keys.find(k => terms.some(t => k.toLowerCase().includes(t.toLowerCase()))) || terms[0];
      };

      const dateKey = findKey(sourceData, ['date', 'exam date', 'dated']);
      const sessionKey = findKey(sourceData, ['session', 'exam session', 'time']);
      const nameKey = findKey(sourceData, ['name', 'student name', 'student']);
      const enrolKey = findKey(sourceData, ['enrollment', 'reg', 'enrollment no', 'registration no']);
      const classKey = findKey(sourceData, ['class', 'program', 'discipline', 'section']);
      const subKey = findKey(sourceData, ['subject', 'course', 'course title', 'title']);
      const teacherKey = findKey(sourceData, ['teacher', 'faculty', 'instructor', 'teacher name']);

      // Group students by Date and Session
      const sessions: Record<string, any[]> = {};
      sourceData.forEach(row => {
        let dateRaw = String(row[dateKey] || "").trim();
        let sessionRaw = String(row[sessionKey] || "").trim();

        if (!dateRaw || !sessionRaw) return;

        // Standardize Session: I -> I, II -> II, 1 -> I, 2 -> II
        let displaySession = sessionRaw;
        if (sessionRaw === '1' || sessionRaw.toLowerCase() === 'session 1') displaySession = 'I';
        else if (sessionRaw === '2' || sessionRaw.toLowerCase() === 'session 2') displaySession = 'II';
        else if (sessionRaw.toUpperCase() === 'I') displaySession = 'I';
        else if (sessionRaw.toUpperCase() === 'II') displaySession = 'II';

        const key = `${dateRaw}|${displaySession}`;
        if (!sessions[key]) sessions[key] = [];
        sessions[key].push({ ...row, _displaySession: displaySession, _displayDate: dateRaw });
      });

      // Sort students in each session by Subject to group them in rooms
      Object.keys(sessions).forEach(key => {
        sessions[key].sort((a, b) => {
          const subA = String(a[subKey] || "").trim().toLowerCase();
          const subB = String(b[subKey] || "").trim().toLowerCase();
          if (subA !== subB) return subA.localeCompare(subB);
          
          // Secondary sort: Enrollment
          const enA = String(a[enrolKey] || "").toLowerCase();
          const enB = String(b[enrolKey] || "").toLowerCase();
          return enA.localeCompare(enB);
        });
      });

      const sessionKeys = Object.keys(sessions).sort((a, b) => {
        const [dateStrA, sessionA] = a.split('|');
        const [dateStrB, sessionB] = b.split('|');
        
        const parseDate = (s: string) => {
          const parts = s.split(/[-/]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            let y = parseInt(parts[2]);
            if (y < 100) y += 2000;
            return new Date(y, m - 1, d).getTime();
          }
          return 0;
        };

        const tA = parseDate(dateStrA);
        const tB = parseDate(dateStrB);

        if (tA !== tB) return tA - tB;
        // Session I before II
        return sessionA.localeCompare(sessionB);
      });
      
      if (sessionKeys.length === 0) {
        throw new Error("No valid Date and Session columns found. Please ensure your file has 'Date' and 'Session' columns.");
      }

      if (format === 'pdf') {
        const pdf = new jsPDF('l', 'mm', 'a4');
        let isFirstPage = true;

        for (const key of sessionKeys) {
          const sessionStudents = sessions[key];
          const date = sessionStudents[0]._displayDate;
          const session = sessionStudents[0]._displaySession;
          
          const totalRooms = Math.ceil(sessionStudents.length / roomCapacity);

          for (let roomIdx = 0; roomIdx < totalRooms; roomIdx++) {
            if (!isFirstPage) pdf.addPage();
            isFirstPage = false;

            const startIdx = roomIdx * roomCapacity;
            const roomStudents = sessionStudents.slice(startIdx, startIdx + roomCapacity);
            const roomNumber = roomIdx + 1;

            // Header - Landscape A4 is ~297mm wide
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('BAHRIA UNIVERSITY - ISLAMABAD CAMPUS', 148.5, 15, { align: 'center' });
            
            pdf.setFontSize(12);
            pdf.text('ATTENDANCE-SHEET - RE-TAKE MID TERM SPRING-2026 SEMESTER', 148.5, 22, { align: 'center' });

            pdf.setFontSize(10);
            pdf.text(`ROOM # ${roomNumber}`, 20, 32);
            pdf.text(`Dated: ${date}`, 148.5, 32, { align: 'center' });
            pdf.text(`Session - ${session}`, 277, 32, { align: 'right' });

            const tableHeaders = [['S#', 'NAME', 'ENROLLMENT NO', 'CLASS', 'SUBJECT', 'TEACHER NAME', 'SHEET #', 'SIGN']];
            const tableData = roomStudents.map((s, idx) => [
              (startIdx + idx + 1), // Global index
              s[nameKey] || '',
              s[enrolKey] || '',
              s[classKey] || '',
              s[subKey] || '',
              s[teacherKey] || '',
              '',
              ''
            ]);

            autoTable(pdf, {
              head: tableHeaders,
              body: tableData,
              startY: 38,
              theme: 'grid',
              headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], lineWidth: 0.1, fontStyle: 'bold' },
              bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.1, minCellHeight: 12 },
              styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
              columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 50 },
                2: { cellWidth: 35 },
                3: { cellWidth: 30 },
                4: { cellWidth: 50 },
                5: { cellWidth: 35 },
                6: { cellWidth: 20 },
                7: { cellWidth: 25 }
              }
            });

            pdf.setFontSize(8);
            pdf.text(`Generated by Exam Tool | Page ${roomIdx + 1} for this session`, 148.5, 205, { align: 'center' });
          }
        }
        pdf.save(`Attendance_Landscape_${new Date().getTime()}.pdf`);
      } else {
        // EXCEL EXPORT - Exact template structure
        const wb = XLSX.utils.book_new();
        
        sessionKeys.forEach(key => {
          const sessionStudents = sessions[key];
          const date = sessionStudents[0]._displayDate;
          const session = sessionStudents[0]._displaySession;
          const totalRooms = Math.ceil(sessionStudents.length / roomCapacity);

          for (let roomIdx = 0; roomIdx < totalRooms; roomIdx++) {
            const startIdx = roomIdx * roomCapacity;
            const roomStudents = sessionStudents.slice(startIdx, startIdx + roomCapacity);
            const roomNumber = roomIdx + 1;

            const aoa = [
              ['BAHRIA UNIVERSITY - ISLAMABAD CAMPUS', '', '', '', '', '', '', ''],
              ['ATTENDANCE-SHEET - RE-TAKE MID TERM SPRING-2026 SEMESTER', '', '', '', '', '', '', ''],
              ['', '', `ROOM # ${roomNumber}`, '', `Dated: ${date}`, '', `Session - ${session}`, ''],
              ['S#', 'NAME', 'ENROLLMENT NO', 'CLASS', 'SUBJECT', 'TEACHER NAME', 'SHEET #', 'SIGN']
            ];

            roomStudents.forEach((s, idx) => {
              aoa.push([
                idx + 1,
                s[nameKey] || '',
                s[enrolKey] || '',
                s[classKey] || '',
                s[subKey] || '',
                s[teacherKey] || '',
                '',
                ''
              ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Column widths for readability
            ws['!cols'] = [
              { wch: 5 },  // S#
              { wch: 30 }, // NAME
              { wch: 20 }, // ENROLLMENT
              { wch: 15 }, // CLASS
              { wch: 30 }, // SUBJECT
              { wch: 20 }, // TEACHER
              { wch: 10 }, // SHEET #
              { wch: 15 }  // SIGN
            ];

            // Excel sheet name limits: 31 chars
            let cleanDate = date.replace(/[\\/?*\[\]:]/g, '-');
            let sheetName = `${cleanDate} S-${session} R${roomNumber}`.substring(0, 31).trim();
            
            if (wb.SheetNames.includes(sheetName)) {
               sheetName = (sheetName.substring(0, 27) + "_" + Math.random().toString(36).substring(2, 5)).toUpperCase();
            }

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
          }
        });

        if (wb.SheetNames.length === 0) {
          throw new Error("No data found to export.");
        }

        XLSX.writeFile(wb, `Attendance_Sheets_${new Date().getTime()}.xlsx`);
      }
      
      alert(`${format.toUpperCase()} generated successfully!`);
    } catch (err: any) {
      console.error(err);
      alert(`Error generating ${format}: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Attendance Sheet Tools</h2>
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Landscape PDF & Excel Export</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${sourceData.length > 0 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                {sourceData.length > 0 ? <CheckCircle2 className="w-5 h-5" /> : '1'}
              </div>
              <h4 className="font-black text-gray-800 uppercase tracking-tight">Upload Combined File</h4>
            </div>
            
            <label className={`flex flex-col items-center justify-center gap-4 w-full p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${
              sourceData.length > 0 ? 'bg-green-50 border-green-200 text-green-600' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-blue-400 hover:bg-blue-50'
            }`}>
              <Upload className="w-10 h-10 opacity-50" />
              <div className="text-center">
                <p className="text-lg font-black text-gray-700">{sourceData.length > 0 ? 'File Loaded ' : 'Select Data or Existing Sheet'}</p>
                <p className="text-xs font-bold tracking-widest mt-1 opacity-60 uppercase">Fix & Re-sort existing sheets or upload new data</p>
              </div>
              {sourceData.length > 0 && (
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-green-100 text-xs font-black">
                  {sourceData.length} records processed
                </div>
              )}
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
            <h4 className="flex items-center gap-2 font-black text-gray-800 uppercase tracking-tight text-sm">
              <Settings className="w-4 h-4 text-blue-600" />
              Configuration
            </h4>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Students per Room (Capacity)</label>
                <input 
                  type="number" 
                  value={roomCapacity}
                  onChange={(e) => setRoomCapacity(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-lg"
                />
              </div>
              <div className="flex-1 min-w-[200px] p-4 bg-orange-50 rounded-2xl border border-orange-100">
                <p className="text-[10px] text-orange-700 font-bold uppercase tracking-widest">Page Orientation</p>
                <p className="text-xs text-orange-900 font-bold mt-1">PDF will be generated in LANDSCAPE mode automatically.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4">
          <button 
            onClick={onClose}
            className="flex-1 min-w-[120px] py-4 px-6 border-2 border-gray-200 text-gray-500 font-black rounded-2xl hover:bg-white transition-all uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
          
          <button 
            disabled={isProcessing !== null || !sourceData.length}
            onClick={() => generateAttendanceSheets('excel')}
            className={`flex-1 min-w-[180px] py-4 px-6 font-black rounded-2xl transition-all shadow-lg uppercase tracking-widest text-xs flex items-center justify-center gap-2 ${
              isProcessing !== null || !sourceData.length
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-green-200'
            }`}
          >
            {isProcessing === 'excel' ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-5 h-5" />
            )}
            {isProcessing === 'excel' ? 'Processing...' : 'Excel Export'}
          </button>

          <button 
            disabled={isProcessing !== null || !sourceData.length}
            onClick={() => generateAttendanceSheets('pdf')}
            className={`flex-[1.5] min-w-[200px] py-4 px-6 font-black rounded-2xl transition-all shadow-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 ${
              isProcessing !== null || !sourceData.length
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            {isProcessing === 'pdf' ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
            {isProcessing === 'pdf' ? 'Generating PDF...' : 'Landscape PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
