import React from 'react';
import { Calendar, Clock, Hash, Settings } from 'lucide-react';

interface ConfigurationPanelProps {
  startDate: string;
  setStartDate: (date: string) => void;
  numDays: number;
  setNumDays: (days: number) => void;
  sessionsPerDay: number;
  setSessionsPerDay: (sessions: number) => void;
  skipWeekends: boolean;
  setSkipWeekends: (skip: boolean) => void;
  onGenerate: () => void;
  isReady: boolean;
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
  onGenerate,
  isReady,
}: ConfigurationPanelProps) {
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
