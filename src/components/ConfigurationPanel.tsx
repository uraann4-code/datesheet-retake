import React from 'react';
import { Calendar, Clock, Hash } from 'lucide-react';

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
        <Calendar className="w-5 h-5 text-blue-500" />
        Schedule Configuration
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            <Hash className="w-4 h-4 text-gray-400" />
            Number of Days
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value={numDays}
            onChange={(e) => setNumDays(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Sessions Per Day
          </label>
          <input
            type="number"
            min="1"
            max="5"
            value={sessionsPerDay}
            onChange={(e) => setSessionsPerDay(parseInt(e.target.value) || 1)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-center">
          <input
            id="skip-weekends"
            type="checkbox"
            checked={skipWeekends}
            onChange={(e) => setSkipWeekends(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
          <label
            htmlFor="skip-weekends"
            className="ml-2 text-sm font-medium text-gray-700"
          >
            Skip Weekends (Sat/Sun)
          </label>
        </div>
      </div>

      <button
        onClick={onGenerate}
        disabled={!isReady}
        className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-all ${
          isReady
            ? 'bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
      >
        Generate Datesheet
      </button>
    </div>
  );
}
