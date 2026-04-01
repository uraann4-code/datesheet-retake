import React, { useState } from 'react';
import { FileUpload } from './FileUpload';
import { ConfigurationPanel } from './ConfigurationPanel';
import { ResultsTable } from './ResultsTable';
import { generateSchedule, ScheduleResult } from '../lib/scheduler';
import { CalendarDays, AlertTriangle, Plus } from 'lucide-react';

export function DatesheetGenerator() {
  const [data, setData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [numDays, setNumDays] = useState<number>(10);
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [skipWeekends, setSkipWeekends] = useState<boolean>(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ScheduleResult | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);

  const handleDataLoaded = (jsonData: any[]) => {
    setData(jsonData);
    setResult(null); // Reset previous results
  };

  const handleReset = () => {
    setData([]);
    setResult(null);
    setResetKey(prev => prev + 1);
    setStartDate(new Date().toISOString().split('T')[0]);
    setNumDays(10);
    setSessionsPerDay(2);
    setSkipWeekends(true);
  };

  const handleGenerate = () => {
    if (data.length === 0) return;
    
    setIsGenerating(true);
    
    // Use setTimeout to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        const scheduleResult = generateSchedule(
          data,
          new Date(startDate),
          numDays,
          sessionsPerDay,
          skipWeekends
        );
        setResult(scheduleResult);
      } catch (error) {
        console.error("Error generating schedule:", error);
        alert("An error occurred while generating the schedule. Please check your data format.");
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

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
              <h1 className="text-3xl font-bold text-gray-900">
                Automated Datesheet Generator
              </h1>
              <p className="text-gray-500 mt-1">
                Upload student enrollments and generate conflict-free exam schedules instantly.
              </p>
            </div>
          </div>
          {data.length > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              New Datesheet
            </button>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                1. Upload Data
              </h3>
              <FileUpload key={resetKey} onDataLoaded={handleDataLoaded} isLoading={isGenerating} />
              
              {data.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm font-medium border border-green-200">
                  Successfully loaded {data.length} records.
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
              onGenerate={handleGenerate}
              isReady={data.length > 0 && !isGenerating}
            />
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-3">
            {isGenerating ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-lg font-medium text-gray-600">
                  Generating optimal schedule...
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Resolving student conflicts and assigning time slots.
                </p>
              </div>
            ) : result ? (
              result.totalCourses === 0 ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-red-100 text-center p-8">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-10 h-10 text-red-500" />
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
                  totalClashes={result.totalClashes}
                  totalCourses={result.totalCourses}
                  totalStudents={result.totalStudents}
                  unresolvedConflicts={result.unresolvedConflicts}
                />
              )
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white rounded-xl shadow-sm border border-gray-100 text-center p-8">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <CalendarDays className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  No Schedule Generated Yet
                </h3>
                <p className="text-gray-500 max-w-md">
                  Upload an Excel file with student enrollments and configure your schedule parameters on the left to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
