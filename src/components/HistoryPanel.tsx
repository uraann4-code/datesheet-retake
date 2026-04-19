import React, { useEffect, useState } from 'react';
import { loadAllWorkspaces, deleteWorkspace } from '../lib/db';
import { Trash2, Clock, Calendar, ChevronRight, History as HistoryIcon, X } from 'lucide-react';

interface HistoryPanelProps {
  onLoadWorkspace: (id: string) => void;
  currentWorkspaceId: string | null;
}

export function HistoryPanel({ onLoadWorkspace, currentWorkspaceId }: HistoryPanelProps) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchWorkspaces = async () => {
    setLoading(true);
    const data = await loadAllWorkspaces();
    setWorkspaces(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchWorkspaces();
    }
  }, [isOpen]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this history?')) {
      // Optimistic update: remove from UI immediately
      setWorkspaces(prev => prev.filter(ws => ws.id !== id));
      
      // Perform deletion in background
      deleteWorkspace(id).catch(err => {
        console.error("Failed to delete history:", err);
        // If it fails, refresh the list
        fetchWorkspaces();
      });
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
      >
        <HistoryIcon className="w-4 h-4" />
        History
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Workspace History</h3>
              <p className="text-xs text-gray-500">View and manage your previous datesheet runs.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-500">Loading history...</p>
            </div>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500">No history found.</p>
            </div>
          ) : (
            workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => {
                  onLoadWorkspace(ws.id);
                  setIsOpen(false);
                }}
                className={`group flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                  currentWorkspaceId === ws.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-100 hover:border-blue-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${
                    currentWorkspaceId === ws.id ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-400'
                  }`}>
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {ws.name}
                    </h4>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(ws.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, ws.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    title="Delete History"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className={`w-5 h-5 transition-transform ${
                    currentWorkspaceId === ws.id ? 'text-blue-600 translate-x-1' : 'text-gray-300 group-hover:translate-x-1'
                  }`} />
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
            History is synced to your account
          </p>
        </div>
      </div>
    </div>
  );
}
