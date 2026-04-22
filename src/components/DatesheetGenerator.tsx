import React, { useState, useEffect } from 'react';
import { FileUpload } from './FileUpload';
import { ConfigurationPanel } from './ConfigurationPanel';
import { ResultsTable } from './ResultsTable';
import { ApprovalPanel, ApprovableRecord } from './ApprovalPanel';
import { DataTools } from './DataTools';
import { generateSchedule, ScheduleResult, ExamType } from '../lib/scheduler';
import { CalendarDays, Plus, ArrowLeft, CheckCircle2, Cloud, FileSpreadsheet, AlertTriangle, X } from 'lucide-react';
import { createWorkspace, loadWorkspaceById, loadAllWorkspaces } from '../lib/db';

type Step = 'upload' | 'approve' | 'results';

interface DatesheetGeneratorProps {
  workspaceId?: string | null;
  isLateMode?: boolean;
}

export function DatesheetGenerator({ 
  workspaceId: initialWorkspaceId,
  isLateMode = false
}: DatesheetGeneratorProps) {
  const [records, setRecords] = useState<ApprovableRecord[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [workspaceId, setWorkspaceId] = useState<string | null>(initialWorkspaceId || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [directSchedule, setDirectSchedule] = useState(isLateMode); // Default to direct for late
  const [examType, setExamType] = useState<ExamType>('final');
  
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [numDays, setNumDays] = useState<number>(10);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true);
  const [extraDay, setExtraDay] = useState<string>('');
  const [baseWorkspaceId, setBaseWorkspaceId] = useState<string>('');
  const [availableWorkspaces, setAvailableWorkspaces] = useState<any[]>([]);
  const [uploadedBaseRecords, setUploadedBaseRecords] = useState<any[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

  // Load available workspaces for base matching
  useEffect(() => {
    async function loadWorkspaces() {
      const ws = await loadAllWorkspaces();
      setAvailableWorkspaces(ws.filter(w => w.id !== workspaceId));
    }
    if (step === 'approve') {
      loadWorkspaces();
    }
  }, [step, workspaceId]);

  // Load workspace if ID is provided
  useEffect(() => {
    async function loadData() {
      if (!initialWorkspaceId) {
        setStep('upload');
        setRecords([]);
        setWorkspaceId(null);
        return;
      }
      
      setIsSyncing(true);
      try {
        const ws = await loadWorkspaceById(initialWorkspaceId);
        if (ws) {
          setWorkspaceId(ws.workspaceId);
          setRecords(ws.records);
          setStep('approve');
        }
      } catch (err) {
        console.error("Error loading workspace:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    loadData();
  }, [initialWorkspaceId]);

  const handleDataLoaded = async (jsonData: any[]) => {
    setIsSyncing(true);
    const initialRecords = jsonData.map((row, index) => ({
      ...row,
      _id: `rec_${Date.now()}_${index}`,
      _status: directSchedule ? 'approved' : 'pending' as any
    }));
    
    const newWorkspaceId = `ws_${Date.now()}`;
    setWorkspaceId(newWorkspaceId);
    setRecords(initialRecords);
    
    // Save to Firestore
    await createWorkspace(newWorkspaceId, `Datesheet ${new Date().toLocaleDateString()}`, initialRecords);
    
    setResult(null);
    if (directSchedule) {
      handleGenerate(initialRecords);
    } else {
      setStep('approve');
    }
    setIsSyncing(false);
  };

  const handleLateDataLoaded = async (jsonData: any[]) => {
    setIsSyncing(true);
    
    // Process new records as late registrations
    const newLateRecords = jsonData.map((row, index) => ({
      ...row,
      _id: `late_${Date.now()}_${index}`,
      _status: 'late_approved' as any // Automatically approve late registrations for the current datesheet
    }));

    // Merge with existing records
    const updatedRecords = [...records, ...newLateRecords];
    setRecords(updatedRecords);
    
    // Update Firestore if we have a workspace
    if (workspaceId) {
      await createWorkspace(workspaceId, `Datesheet ${new Date().toLocaleDateString()}`, updatedRecords);
    }
    
    // Automatically re-generate the schedule with the new late records
    handleGenerate(updatedRecords);
    setIsSyncing(false);
  };

  const handleGenerate = (recordsToUse?: ApprovableRecord[]) => {
    const sourceRecords = recordsToUse || records;
    const approvedRecords = sourceRecords
      .filter(r => r._status === 'approved' || r._status === 'late_approved')
      .map(r => {
        const { _id, _status, ...rest } = r;
        return rest;
      });

    if (approvedRecords.length === 0) {
      alert("Please approve at least one course before generating the datesheet.");
      return;
    }
    
    setIsGenerating(true);
    setStep('results');
    
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(async () => {
      try {
        let recordsForScheduling = [...approvedRecords];
        
        // Match assignments from either historical base workspace or uploaded base file
        let baseAssignments: any[] = [];
        
        if (baseWorkspaceId) {
          const baseWs = await loadWorkspaceById(baseWorkspaceId);
          if (baseWs) {
            baseAssignments = baseWs.records.filter(r => r['Date'] && r['Session']);
          }
        } else if (uploadedBaseRecords.length > 0) {
          baseAssignments = uploadedBaseRecords.filter(r => r['Date'] && r['Session']);
        }

        if (baseAssignments.length > 0) {
          // For each course in our approvedRecords, if a matching course exists in baseAssignments, 
          // set its Date and Session so scheduler.ts can infer it.
          recordsForScheduling = approvedRecords.map(rec => {
            const recKeys = Object.keys(rec);
            const recSubKey = recKeys.find(k => k.toLowerCase().match(/subject|course|coursename|coursetitle|sub/));
            const recCodeKey = recKeys.find(k => k.toLowerCase().match(/code|id/)) || recSubKey;
            
            if (!recSubKey) return rec;

            const matchingBase = baseAssignments.find(base => {
              const baseKeys = Object.keys(base);
              const baseSubKey = baseKeys.find(k => k.toLowerCase().match(/subject|course|coursename|coursetitle|sub/));
              const baseCodeKey = baseKeys.find(k => k.toLowerCase().match(/code|id/)) || baseSubKey;

              if (baseSubKey && recSubKey) {
                // Match by code first, then by subject
                const codeMatch = baseCodeKey && recCodeKey && 
                  String(base[baseCodeKey]).toLowerCase().trim() === String(rec[recCodeKey]).toLowerCase().trim();
                const subMatch = String(base[baseSubKey]).toLowerCase().trim() === String(rec[recSubKey]).toLowerCase().trim();
                
                return codeMatch || subMatch;
              }
              return false;
            });

            if (matchingBase) {
              return {
                ...rec,
                Date: matchingBase['Date'],
                Session: matchingBase['Session']
              };
            }
            return rec;
          });
        }

        const scheduleResult = generateSchedule(
          recordsForScheduling,
          new Date(startDate),
          numDays,
          sessionsPerDay,
          skipWeekends,
          result,
          examType,
          extraDay ? new Date(extraDay) : undefined
        );
        setResult(scheduleResult);
      } catch (error) {
        console.error("Error generating schedule:", error);
        alert("An error occurred while generating the schedule. Please check your data format.");
        setStep('approve');
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const handleReset = () => {
    setRecords([]);
    setResult(null);
    setResetKey(prev => prev + 1);
    setWorkspaceId(null);
    setStartDate(new Date().toISOString().split('T')[0]);
    setNumDays(10);
    setSessionsPerDay(2);
    setSkipWeekends(true);
    setExtraDay('');
    setBaseWorkspaceId('');
    setUploadedBaseRecords([]);
    setStep('upload');
    setDirectSchedule(false);
    setExamType('final');
  };

  const approvedCount = records.filter(r => r._status === 'approved' || r._status === 'late_approved').length;

  const steps = [
    { 
      id: 'upload', 
      title: isLateMode ? '1. Upload Late' : '1. Upload Data', 
      desc: isLateMode ? 'Naye bacho ki list' : 'Import Excel file' 
    },
    { 
      id: 'approve', 
      title: isLateMode ? '2. Match Old' : '2. Review Cases', 
      desc: isLateMode ? 'Base datesheet select kren' : 'Approve or Reject' 
    },
    { 
      id: 'results', 
      title: '3. Download', 
      desc: 'Get your files' 
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-sm">
              <CalendarDays className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">
                  {isLateMode ? 'Late Registration Portal' : 'Datesheet Generator'}
                </h1>
                {isSyncing ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    <Cloud className="w-3 h-3 animate-pulse" /> Syncing...
                  </span>
                ) : workspaceId ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <Cloud className="w-3 h-3" /> Saved to Cloud
                  </span>
                ) : null}
              </div>
              <p className="text-gray-500 mt-1">
                {isLateMode 
                  ? 'Incorporate late registrations into your existing exam schedule seamlessly.' 
                  : 'Generate conflict-free exam schedules with manual or direct approval.'}
              </p>
            </div>
          </div>
        </header>

        {/* Stepper */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            {steps.map((s, idx) => {
              const isActive = step === s.id;
              const isPast = 
                (step === 'approve' && s.id === 'upload') || 
                (step === 'results' && (s.id === 'upload' || s.id === 'approve'));
              
              return (
                <div key={s.id} className="flex items-center flex-1 w-full">
                  <div className={`flex items-center gap-3 p-3 rounded-lg w-full transition-colors ${
                    isActive ? 'bg-blue-50 border border-blue-100' : ''
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      isActive ? 'bg-blue-600 text-white shadow-md' : 
                      isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isPast ? <CheckCircle2 className="w-6 h-6" /> : idx + 1}
                    </div>
                    <div>
                      <p className={`font-bold ${isActive ? 'text-blue-900' : isPast ? 'text-gray-800' : 'text-gray-400'}`}>
                        {s.title}
                      </p>
                      <p className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="hidden sm:block w-8 h-[2px] bg-gray-200 mx-2"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${step !== 'upload' ? 'opacity-70' : ''}`}>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 tracking-tight">
                {isLateMode ? '1. Upload Late List' : '1. Upload Data'}
              </h3>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-3">Exam Type Choice:</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="examType" 
                      checked={examType === 'final'} 
                      onChange={() => setExamType('final')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Final Term Re-take</p>
                      <p className="text-xs text-gray-500">Max students on first day strategy.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="examType" 
                      checked={examType === 'mid'} 
                      onChange={() => setExamType('mid')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Mid Term Re-take</p>
                      <p className="text-xs text-gray-500">Equal student distribution per session.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-3">Workflow Choice:</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="workflow" 
                      checked={!directSchedule} 
                      onChange={() => setDirectSchedule(false)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Manual Approval</p>
                      <p className="text-xs text-gray-500">Review each case before scheduling.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="radio" 
                      name="workflow" 
                      checked={directSchedule} 
                      onChange={() => setDirectSchedule(true)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">Direct Schedule</p>
                      <p className="text-xs text-gray-500">Auto-approve all and generate immediately.</p>
                    </div>
                  </label>
                </div>
              </div>

              <FileUpload key={resetKey} onDataLoaded={handleDataLoaded} isLoading={isGenerating} />
              
              {records.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Loaded {records.length} records.
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                Excel Format Guide
              </h3>
              <p className="text-xs text-gray-500 mb-4 font-medium">
                Please ensure your Excel file contains these exact columns for accurate generation:
              </p>
              <div className="space-y-2">
                {[
                  { name: 'Enrollment', desc: 'Registration # (Required)', req: true },
                  { name: 'Subject', desc: 'Course Title (Required for scheduling)', req: true },
                  { name: 'Course Code', desc: 'Subject Code', req: false },
                  { name: 'Name', desc: 'Student Name', req: false },
                  { name: 'Program', desc: 'Class/Degree', req: false },
                  { name: 'Teacher Name', desc: 'Instructor', req: false },
                ].map((col) => (
                  <div key={col.name} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-xs font-black text-gray-900">{col.name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{col.desc}</p>
                    </div>
                    {col.req && (
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100">
                        REQ
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[10px] text-amber-800 font-bold leading-tight">
                  Note: Column names can be slightly different (e.g., "Reg #" instead of "Enrollment"), but the data must be present.
                </p>
              </div>
            </div>

            {step === 'upload' && <DataTools />}

            <ConfigurationPanel
              startDate={startDate}
              setStartDate={setStartDate}
              numDays={numDays}
              setNumDays={setNumDays}
              sessionsPerDay={sessionsPerDay}
              setSessionsPerDay={setSessionsPerDay}
              skipWeekends={skipWeekends}
              setSkipWeekends={setSkipWeekends}
              extraDay={extraDay}
              setExtraDay={setExtraDay}
              baseWorkspaceId={baseWorkspaceId}
              setBaseWorkspaceId={setBaseWorkspaceId}
              availableWorkspaces={availableWorkspaces}
              uploadedBaseRecords={uploadedBaseRecords}
              setUploadedBaseRecords={setUploadedBaseRecords}
              onGenerate={() => handleGenerate()}
              isReady={
                records.length > 0 && 
                approvedCount > 0 && 
                !isGenerating && 
                (!isLateMode || (isLateMode && (baseWorkspaceId || uploadedBaseRecords.length > 0)))
              }
              isLateMode={isLateMode}
            />
            
            {records.length > 0 && approvedCount === 0 && step === 'approve' && (
              <p className="text-sm text-amber-600 font-medium text-center bg-amber-50 p-3 rounded-lg border border-amber-200">
                Please approve at least one course to generate the datesheet.
              </p>
            )}
          </div>

          {/* Right Column: Main Content Area */}
          <div className="lg:col-span-3">
            {step === 'upload' && (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 text-center p-8">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <CalendarDays className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Data Uploaded
                </h3>
                <p className="text-gray-500 max-w-md">
                  Upload an Excel file with student enrollments on the left to begin the approval and scheduling process.
                </p>
              </div>
            )}

            {step === 'approve' && (
              <ApprovalPanel 
                records={records} 
                setRecords={setRecords}
                workspaceId={workspaceId}
                examType={examType}
              />
            )}

            {step === 'results' && (
              <div className="space-y-4">
                <button
                  onClick={() => setStep('approve')}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Approvals
                </button>
                
                {isGenerating ? (
                  <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-medium text-gray-600">
                      Generating optimal schedule...
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Scheduling {approvedCount} approved subjects.
                    </p>
                  </div>
                ) : result ? (
                  result.totalCourses === 0 ? (
                    <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-red-100 text-center p-8">
                      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle className="w-10 h-10 text-red-500" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Subjects Found
                      </h3>
                      <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                        We couldn't identify the required columns in your Excel file. Please ensure your file has columns for <strong>Enrollment (Reg #)</strong> and <strong>Subject</strong>.
                      </p>
                      <div className="mt-6 p-4 bg-gray-50 rounded-2xl border border-gray-200 max-w-md mx-auto text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Detected Columns in File:</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {records.length > 0 && Object.keys(records[0]).filter(k => !k.startsWith('_')).map(key => (
                            <span key={key} className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-md text-gray-500 font-mono">
                              {key}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Required Checklist:</p>
                        <ul className="text-sm text-gray-600 space-y-2">
                          <li className="flex items-center gap-2">
                            {records.length > 0 && Object.keys(records[0]).some(k => k.toLowerCase().match(/enrollment|reg|registration|studentid|rollno|reg#|roll|student|id/)) ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                            Enrollment / Registration column?
                          </li>
                          <li className="flex items-center gap-2">
                            {records.length > 0 && Object.keys(records[0]).some(k => k.toLowerCase().match(/subject|course|coursename|coursetitle|sub|paper|title/)) ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                            Subject / Course Title column?
                          </li>
                        </ul>
                        <button 
                          onClick={handleReset}
                          className="mt-6 w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
                        >
                          Try Different File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <ResultsTable
                      data={result.datesheet}
                      records={records}
                      totalClashes={result.totalClashes}
                      totalCourses={result.totalCourses}
                      totalStudents={result.totalStudents}
                      unresolvedConflicts={result.unresolvedConflicts}
                      examType={examType}
                      onLateRegistrations={handleLateDataLoaded}
                      isLoading={isSyncing}
                    />
                  )
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
