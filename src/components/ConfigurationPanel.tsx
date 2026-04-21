import React, { useState } from 'react';
import { Calendar, Clock, Hash, Settings, FileSpreadsheet, X, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { processExcelData } from '../lib/excelProcessor';

interface ConfigurationPanelProps {
  startDate: string;
  setStartDate: (date: string) => void;
  numDays: number;
  setNumDays: (days: number) => void;
  sessionsPerDay: number;
  setSessionsPerDay: (sessions: number) => void;
  skipWeekends: boolean;
  setSkipWeekends: (skip: boolean) => void;
  extraDay: string;
  setExtraDay: (date: string) => void;
  baseWorkspaceId: string;
  setBaseWorkspaceId: (id: string) => void;
  availableWorkspaces: any[];
  uploadedBaseRecords: any[];
  setUploadedBaseRecords: (records: any[]) => void;
  onGenerate: () => void;
  isReady: boolean;
  isLateMode?: boolean;
}

export function ConfigurationPanel({
  startDate,
  setStartDate,
  numDays,
  setNumDays,
  sessionsPerDay,
  setSessionsPerDay,
  skipWeekends,
  setSkipWeekends,
  extraDay,
  setExtraDay,
  baseWorkspaceId,
  setBaseWorkspaceId,
  availableWorkspaces,
  uploadedBaseRecords,
  setUploadedBaseRecords,
  onGenerate,
  isReady,
  isLateMode,
}: ConfigurationPanelProps) {
  const [isProcessingBase, setIsProcessingBase] = useState(false);

  const handleBaseFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingBase(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const binary = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(binary, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = processExcelData(workbook, sheetName);
        
        // Filter only those that have Date and Session
        const validAssignments = jsonData.filter(r => r['Date'] && r['Session']);
        
        if (validAssignments.length === 0) {
          alert("The uploaded file does not contain 'Date' or 'Session' columns. Please ensure it's a valid datesheet export.");
          setUploadedBaseRecords([]);
        } else {
          setUploadedBaseRecords(validAssignments);
          setBaseWorkspaceId(''); // Clear workspace selection if file is uploaded
        }
      } catch (err) {
        console.error("Base upload error:", err);
        alert("Failed to process the old datesheet file.");
      } finally {
        setIsProcessingBase(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Settings className="w-5 h-5 text-blue-500" />
        Exam Settings
      </h3>
      <p className="text-sm text-gray-500 -mt-4">
        Tell us how you want to schedule the exams.
      </p>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            When do the exams start?
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-400" />
            How many days will exams run?
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={numDays}
            onChange={(e) => setNumDays(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Example: 10 days</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Exams per day (Sessions)
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={sessionsPerDay}
            onChange={(e) => setSessionsPerDay(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Example: 2 (Morning & Evening)</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            Extra Clash Day (Optional)
          </label>
          <input
            type="date"
            value={extraDay}
            onChange={(e) => setExtraDay(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-gray-50 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-1">Select a date for students with unresolved conflicts.</p>
        </div>

        <div className={isLateMode ? 'p-4 bg-blue-50 rounded-xl border-2 border-blue-200 ring-4 ring-blue-50/50 space-y-4' : 'space-y-4'}>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Settings className={`w-4 h-4 ${isLateMode ? 'text-blue-600 animate-pulse' : 'text-blue-400'}`} />
              {isLateMode ? 'Option A: Select from History' : 'Match with Old History (Optional)'}
            </label>
            <select
              value={baseWorkspaceId}
              disabled={uploadedBaseRecords.length > 0}
              onChange={(e) => setBaseWorkspaceId(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm ${
                isLateMode && !baseWorkspaceId && uploadedBaseRecords.length === 0
                  ? 'border-red-300 bg-red-50 text-red-900' 
                  : (uploadedBaseRecords.length > 0 ? 'bg-gray-100 cursor-not-allowed border-gray-200' : 'border-gray-300 bg-gray-50 text-gray-900')
              }`}
            >
              <option value="">{isLateMode ? '-- Choose Datesheet --' : 'No History Selected'}</option>
              {availableWorkspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({new Date(ws.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex items-center justify-center py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <span className="relative px-2 bg-transparent text-[10px] font-black text-gray-400 uppercase tracking-widest">OR</span>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
              <Upload className={`w-4 h-4 ${isLateMode && uploadedBaseRecords.length > 0 ? 'text-green-600' : 'text-blue-400'}`} />
              {isLateMode ? 'Option B: Upload Old Datesheet (Excel)' : 'Upload Old Datesheet (Optional)'}
            </label>
            {uploadedBaseRecords.length > 0 ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs font-bold text-green-900">Base File Uploaded</p>
                    <p className="text-[10px] text-green-700">{uploadedBaseRecords.length} courses matched</p>
                  </div>
                </div>
                <button 
                  onClick={() => setUploadedBaseRecords([])}
                  className="p-1 hover:bg-green-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-green-700" />
                </button>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                isLateMode && !baseWorkspaceId 
                  ? 'bg-blue-50 border-blue-300 text-blue-600 hover:bg-blue-100' 
                  : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
              }`}>
                {isProcessingBase ? (
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                <span className="text-xs font-bold">{isProcessingBase ? 'Processing...' : 'Upload Excel File'}</span>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".xlsx, .xls" 
                  onChange={handleBaseFileUpload}
                  disabled={isProcessingBase || baseWorkspaceId !== ''}
                />
              </label>
            )}
            {baseWorkspaceId && !uploadedBaseRecords.length && (
               <p className="text-[10px] text-amber-600 font-bold mt-1 tracking-tight italic">Using history (Option A selection)</p>
            )}
          </div>

          <p className={`text-[10px] mt-1 ${isLateMode ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>
            {isLateMode 
              ? 'Selection is must: System needs a reference to match dates.' 
              : 'Matched subjects will retain their original Date/Session from the reference.'}
          </p>
        </div>

        <div className="flex items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
          <input
            id="skip-weekends"
            type="checkbox"
            checked={skipWeekends}
            onChange={(e) => setSkipWeekends(e.target.checked)}
            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
          />
          <label
            htmlFor="skip-weekends"
            className="ml-3 text-sm font-semibold text-blue-900 cursor-pointer select-none"
          >
            Skip Weekends (Sat/Sun)
          </label>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={!isReady}
        className={`w-full py-3.5 px-4 rounded-xl font-bold text-white transition-all flex flex-col items-center justify-center ${
          isReady
            ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
            : 'bg-gray-300 cursor-not-allowed text-gray-500'
        }`}
      >
        <span>Generate Datesheet</span>
        {isReady && <span className="text-xs font-normal text-blue-200 mt-0.5">Click here when you are ready</span>}
      </button>
    </div>
  );
}
