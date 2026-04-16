import React, { useState, useEffect } from 'react';
import { FileUpload } from './FileUpload';
import { ConfigurationPanel } from './ConfigurationPanel';
import { ResultsTable } from './ResultsTable';
import { ApprovalPanel, ApprovableRecord } from './ApprovalPanel';
import { generateSchedule, ScheduleResult } from '../lib/scheduler';
import { CalendarDays, Plus, ArrowLeft, CheckCircle2, Cloud } from 'lucide-react';
import { createWorkspace, loadWorkspaceById } from '../lib/db';

type Step = 'upload' | 'approve' | 'results';

interface DatesheetGeneratorProps {
  workspaceId?: string | null;
}

export function DatesheetGenerator({ workspaceId: initialWorkspaceId }: DatesheetGeneratorProps) {
  const [records, setRecords] = useState<ApprovableRecord[]>([]);
  const [step, setStep] = useState<Step>('upload');
  const [workspaceId, setWorkspaceId] = useState<string | null>(initialWorkspaceId || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [directSchedule, setDirectSchedule] = useState(false);
  
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [numDays, setNumDays] = useState<number>(10);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

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
    setTimeout(() => {
      try {
        const scheduleResult = generateSchedule(
          approvedRecords,
          new Date(startDate),
          numDays,
          sessionsPerDay,
          skipWeekends,
          result // Pass the previous result here
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
    setStep('upload');
    setDirectSchedule(false);
  };

  const approvedCount = records.filter(r => r._status === 'approved' || r._status === 'late_approved').length;

  const steps = [
    { id: 'upload', title: '1. Upload Data', desc: 'Import Excel file' },
    { id: 'approve', title: '2. Review Cases', desc: 'Approve or Reject' },
    { id: 'results', title: '3. Download', desc: 'Get your files' }
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
                  Datesheet Generator
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
                Generate conflict-free exam schedules with manual or direct approval.
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
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                1. Upload Data
              </h3>
              
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

            <ConfigurationPanel
              startDate={startDate}
              setStartDate={setStartDate}
              numDays={numDays}
              setNumDays={setNumDays}
              sessionsPerDay={sessionsPerDay}
              setSessionsPerDay={setSessionsPerDay}
              skipWeekends={skipWeekends}
              setSkipWeekends={setSkipWeekends}
              onGenerate={() => handleGenerate()}
              isReady={records.length > 0 && approvedCount > 0 && !isGenerating}
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
                      Scheduling {approvedCount} approved courses.
                    </p>
                  </div>
                ) : result ? (
                  result.totalCourses === 0 ? (
                    <div className="h-[500px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-red-100 text-center p-8">
                      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <span className="text-4xl">⚠️</span>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">
                        No Courses Found
                      </h3>
                      <p className="text-gray-500 max-w-md">
                        We couldn't find the required columns in your Excel file. Please ensure your file has columns for <strong>Enrollment</strong> and <strong>Course Code</strong>.
                      </p>
                    </div>
                  ) : (
                    <ResultsTable
                      data={result.datesheet}
                      records={records}
                      totalClashes={result.totalClashes}
                      totalCourses={result.totalCourses}
                      totalStudents={result.totalStudents}
                      unresolvedConflicts={result.unresolvedConflicts}
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
