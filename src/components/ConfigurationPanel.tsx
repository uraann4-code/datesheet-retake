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
  const [activeTab, setActiveTab] = useState<'history' | 'upload'>(uploadedBaseRecords.length > 0 ? 'upload' : 'history');

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
          setBaseWorkspaceId(''); 
          setActiveTab('upload');
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

  const handleTabChange = (tab: 'history' | 'upload') => {
    setActiveTab(tab);
    if (tab === 'history') {
      setUploadedBaseRecords([]);
    } else {
      setBaseWorkspaceId('');
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <Settings className="w-5 h-5 text-blue-500" />
        Exam Settings
      </h3>
      
      <div className="space-y-5">
        <div className={isLateMode ? 'p-4 bg-blue-50/50 rounded-2xl border-2 border-blue-100 ring-4 ring-blue-50/20 space-y-4' : 'space-y-4'}>
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-black text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Settings className={`w-4 h-4 ${isLateMode ? 'text-blue-600 animate-pulse' : 'text-blue-400'}`} />
              Reference Datesheet
            </label>
            <div className="flex p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => handleTabChange('history')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Saved History
              </button>
              <button
                onClick={() => handleTabChange('upload')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Upload Excel
              </button>
            </div>
          </div>

          {activeTab === 'history' ? (
            <div>
              <select
                value={baseWorkspaceId}
                onChange={(e) => setBaseWorkspaceId(e.target.value)}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium ${
                  isLateMode && !baseWorkspaceId 
                    ? 'border-red-300 bg-red-50 text-red-900 shadow-sm' 
                    : 'border-gray-200 bg-white text-gray-900'
                }`}
              >
                <option value="">{isLateMode ? '-- Choose from History --' : 'No History Selected'}</option>
                {availableWorkspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name} ({new Date(ws.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              {uploadedBaseRecords.length > 0 ? (
                <div className="flex items-center justify-between p-3 bg-white border border-green-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-gray-900">Reference File Ready</p>
                      <p className="text-[10px] text-green-600 font-bold uppercase tracking-tight">{uploadedBaseRecords.length} courses identified</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setUploadedBaseRecords([])}
                    className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-3 w-full p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                  isLateMode 
                    ? 'bg-white border-blue-200 text-blue-600 hover:border-blue-400' 
                    : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:border-gray-300'
                }`}>
                  <div className={`p-3 rounded-2xl ${isLateMode ? 'bg-blue-50' : 'bg-gray-100'}`}>
                    {isProcessingBase ? (
                      <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                    ) : (
                      <Upload className={`w-6 h-6 ${isLateMode ? 'text-blue-600' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-700">{isProcessingBase ? 'Analyzing Data...' : 'Upload Reference Sheet'}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Excel file containing existing schedule</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".xlsx, .xls" 
                    onChange={handleBaseFileUpload}
                    disabled={isProcessingBase}
                  />
                </label>
              )}
            </div>
          )}

          <p className="text-[10px] bg-blue-100/50 p-2 rounded-lg text-blue-800 font-bold leading-snug">
            {isLateMode 
              ? 'Required: Select a reference to ensure old subjects keep their original dates.' 
              : 'Subjects in your current data that match the reference will keep their old Date/Session.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            When do the exams start?
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all bg-gray-50 font-medium"
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
