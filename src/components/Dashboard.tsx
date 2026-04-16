import React, { useEffect, useState } from 'react';
import { Plus, History, Calendar, FileText, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { loadAllWorkspaces } from '../lib/db';
import { format } from 'date-fns';

interface DashboardProps {
  onSelectWorkspace: (id: string) => void;
  onStartNew: () => void;
}

export function Dashboard({ onSelectWorkspace, onStartNew }: DashboardProps) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const data = await loadAllWorkspaces();
        setWorkspaces(data);
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchWorkspaces();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Datesheet History</h1>
          <p className="text-gray-500 font-medium mt-1">Manage and view your previous exam schedules.</p>
        </div>
        <button
          onClick={onStartNew}
          className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-black text-base"
        >
          <Plus className="w-5 h-5" />
          Start New Datesheet
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <History className="w-4 h-4" />
            Recent Records
          </h2>
          
          {workspaces.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
              <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No datesheets yet</h3>
              <p className="text-gray-500 mt-1 mb-6">Start your first datesheet by clicking the button above.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => onSelectWorkspace(ws.id)}
                  className="group bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg leading-tight">{ws.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs font-bold text-gray-400">
                          <Clock className="w-3 h-3" />
                          {format(new Date(ws.createdAt), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 text-white shadow-xl shadow-blue-200">
            <h3 className="text-xl font-black mb-2">Quick Stats</h3>
            <div className="space-y-4 mt-6">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-blue-100 font-medium">Total Saved</span>
                <span className="text-2xl font-black">{workspaces.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <span className="text-blue-100 font-medium">Last Generated</span>
                <span className="font-bold">{workspaces.length > 0 ? format(new Date(workspaces[0].createdAt), 'MMM dd') : 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">How it works</h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-black shrink-0">1</div>
                <p className="text-sm text-gray-600 font-medium">Upload your Excel file with student and course data.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-black shrink-0">2</div>
                <p className="text-sm text-gray-600 font-medium">Choose between <strong>Direct Schedule</strong> or <strong>Manual Approval</strong>.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs font-black shrink-0">3</div>
                <p className="text-sm text-gray-600 font-medium">Download your formatted datesheet and DGIC files.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
