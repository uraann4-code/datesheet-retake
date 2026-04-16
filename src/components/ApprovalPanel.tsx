import React, { useState, useMemo } from 'react';
import { Search, Check, X, CheckCircle2, Building2, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { updateRecordStatus, updateMultipleRecordStatuses } from '../lib/db';

export interface ApprovableRecord {
  _id: string;
  _status: 'pending' | 'approved' | 'late_approved' | 'rejected';
  [key: string]: any;
}

interface ApprovalPanelProps {
  records: ApprovableRecord[];
  setRecords: React.Dispatch<React.SetStateAction<ApprovableRecord[]>>;
  workspaceId: string | null;
}

export function ApprovalPanel({ records, setRecords, workspaceId }: ApprovalPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Find enrollment and course keys for display
  const keys = records.length > 0 ? Object.keys(records[0]).filter(k => !k.startsWith('_')) : [];
  const findKey = (searchTerms: string[]) => {
    return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
  };

  const enrollmentKey = findKey(['enrollment', 'registration', 'studentid', 'regno', 'rollno']);
  const courseCodeKey = findKey(['coursecode', 'subjectcode']) || findKey(['course']);
  const subjectKey = findKey(['subject', 'coursename', 'coursetitle']);

  // Filter records based on search query (matching enrollment)
  const searchedRecords = useMemo(() => {
    if (!searchQuery.trim() || !enrollmentKey) return [];
    const query = searchQuery.toLowerCase().trim();
    return records.filter(r => String(r[enrollmentKey] || '').toLowerCase().includes(query));
  }, [records, searchQuery, enrollmentKey]);

  const handleApprove = async (id: string) => {
    setRecords(prev => prev.map(r => r._id === id ? { ...r, _status: 'approved' } : r));
    if (workspaceId) await updateRecordStatus(workspaceId, id, 'approved');
  };

  const handleLateApprove = async (id: string) => {
    setRecords(prev => prev.map(r => r._id === id ? { ...r, _status: 'late_approved' } : r));
    if (workspaceId) await updateRecordStatus(workspaceId, id, 'late_approved');
  };

  const handleReject = async (id: string) => {
    setRecords(prev => prev.map(r => r._id === id ? { ...r, _status: 'rejected' } : r));
    if (workspaceId) await updateRecordStatus(workspaceId, id, 'rejected');
  };

  const handleApproveAllSearched = async () => {
    const searchedIds = new Set(searchedRecords.map(r => r._id));
    setRecords(prev => prev.map(r => searchedIds.has(r._id) ? { ...r, _status: 'approved' } : r));
    if (workspaceId) await updateMultipleRecordStatuses(workspaceId, Array.from(searchedIds) as string[], 'approved');
  };

  const approvedCount = records.filter(r => r._status === 'approved' || r._status === 'late_approved').length;
  const pendingCount = records.filter(r => r._status === 'pending').length;

  const handleExportDGIC = () => {
    if (!records || records.length === 0) return;
    
    // Include all records for DGIC export to ensure a complete list for approval
    const sortedRecords = [...records].sort((a, b) => {
      const isARecommended = a._status === 'approved' || a._status === 'late_approved' ? 0 : 1;
      const isBRecommended = b._status === 'approved' || b._status === 'late_approved' ? 0 : 1;
      return isARecommended - isBRecommended;
    });

    // Find keys from the original data that match the required columns
    const keys = Object.keys(records[0]).filter(k => !k.startsWith('_'));
    const findKey = (searchTerms: string[]) => {
      return keys.find(k => searchTerms.some(term => k.toLowerCase().replace(/[\s_]+/g, '').includes(term.toLowerCase().replace(/[\s_]+/g, ''))));
    };

    const nameKey = findKey(['name']) || 'Name';
    const enrollmentKey = findKey(['enrollment', 'registration']) || 'Enrollment';
    const classKey = findKey(['class', 'program']) || 'Class';
    const subjectKey = findKey(['subject', 'course']) || 'Subject';
    const codeKey = findKey(['code', 'coursecode']) || 'CODE';
    const teacherKey = findKey(['teacher']) || 'Teacher Name';
    const remarksKey = findKey(['remark', 'reason']) || 'Remarks(If Any)';

    // Create the data for the sheet
    const exportData = sortedRecords.map((row, index) => {
      let decision = '';
      if (row._status === 'approved') decision = 'Recommended';
      else if (row._status === 'late_approved') decision = 'Recommended (Late)';
      else if (row._status === 'rejected') decision = 'Not Recommended';
      else decision = 'Pending';

      return {
        'S#': index + 1,
        'Name': row[nameKey] || '',
        'Enrollment': row[enrollmentKey] || '',
        'Class': row[classKey] || '',
        'Subject': row[subjectKey] || '',
        'CODE': row[codeKey] || '',
        'Teacher Name': row[teacherKey] || '',
        'Remarks(If Any)': row[remarksKey] || '',
        'DECission': decision
      };
    });

    // Create worksheet starting with title
    const ws = XLSX.utils.aoa_to_sheet([['Retake Applications of Final Term Exam - Fall - 2024']]);
    
    // Add data starting at A2
    XLSX.utils.sheet_add_json(ws, exportData, { origin: 'A2' });

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DGIC');

    // Write file
    XLSX.writeFile(wb, 'DG_IC_Approval_File.xlsx');
  };

  const handleExportAccountOffice = () => {
    if (!records || records.length === 0) return;
    const nameKey = Object.keys(records[0]).find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('teacher')) || 'Name';
    
    const filtered = records
      .filter(r => r._status === 'approved' || r._status === 'late_approved')
      .sort((a, b) => String(a[nameKey] || '').localeCompare(String(b[nameKey] || '')))
      .map(r => {
        const newRow: any = {};
        Object.keys(r).forEach(k => {
          if (!k.startsWith('_')) newRow[k] = r[k];
        });
        newRow['DECission'] = 'Recommended';
        return newRow;
      });
      
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Account Office');
    XLSX.writeFile(wb, 'Account_Office_File.xlsx');
  };

  const handleExportDepartment = () => {
    if (!records || records.length === 0) return;
    const remarksKey = Object.keys(records[0]).find(k => k.toLowerCase().includes('remark') || k.toLowerCase().includes('reason'));
    
    const filtered = records
      .filter(r => r._status === 'approved' || r._status === 'late_approved')
      .map(r => {
        const newRow: any = {};
        Object.keys(r).forEach(k => {
          if (!k.startsWith('_') && k !== remarksKey) {
            newRow[k] = r[k];
          }
        });
        newRow['DECission'] = 'Recommended';
        return newRow;
      });
      
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Department');
    XLSX.writeFile(wb, 'Department_File.xlsx');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full min-h-[500px]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Case Approvals</h3>
          <p className="text-sm text-gray-500">Search students to recommend/approve their courses.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600">
            {pendingCount} Pending
          </div>
          <div className="bg-green-100 px-3 py-1.5 rounded-lg text-sm font-medium text-green-700 flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" />
            {approvedCount} Approved
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <h4 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
          <span className="bg-blue-200 text-blue-800 w-5 h-5 rounded-full flex items-center justify-center text-xs">i</span>
          Quick Guide
        </h4>
        <ul className="text-sm text-blue-800 list-disc list-inside space-y-1 ml-1">
          <li>Type a student's Enrollment Number in the search box below.</li>
          <li>Click <strong>Approve</strong> for normal cases, or <strong>Late Approve</strong> for delayed cases.</li>
          <li>Only the approved courses will be included in the final datesheet.</li>
        </ul>
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="bg-gray-50 border border-gray-300 text-gray-900 text-base rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full pl-11 p-3.5 transition-all outline-none shadow-sm"
          placeholder="Search by Enrollment Number (e.g. 01-112233-001)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery.trim() && searchedRecords.length > 0 && (
          <div className="space-y-4 border border-blue-100 rounded-xl p-5 bg-blue-50/30">
            <div className="flex justify-between items-center border-b border-blue-100 pb-3">
              <h4 className="font-semibold text-blue-900">
                Found {searchedRecords.length} courses for "{searchQuery}"
              </h4>
              <button
                onClick={handleApproveAllSearched}
                className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve All
              </button>
            </div>

            <div className="space-y-3">
              {searchedRecords.map(record => (
                <div key={record._id} className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                  <div>
                    <p className="font-bold text-gray-800 text-base">
                      {courseCodeKey ? record[courseCodeKey] : 'Unknown Course'}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {subjectKey ? record[subjectKey] : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => handleApprove(record._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium text-sm ${
                        record._status === 'approved' 
                          ? 'bg-green-100 text-green-700 border border-green-200 shadow-inner' 
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
                      }`}
                      title="Recommend (Approve)"
                    >
                      <Check className="w-4 h-4" />
                      {record._status === 'approved' ? 'Approved' : 'Approve'}
                    </button>
                    <button
                      onClick={() => handleLateApprove(record._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium text-sm ${
                        record._status === 'late_approved' 
                          ? 'bg-orange-100 text-orange-700 border border-orange-200 shadow-inner' 
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'
                      }`}
                      title="Late Recommend (Late Approve)"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {record._status === 'late_approved' ? 'Late Approved' : 'Late Approve'}
                    </button>
                    <button
                      onClick={() => handleReject(record._id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-medium text-sm ${
                        record._status === 'rejected' 
                          ? 'bg-red-100 text-red-700 border border-red-200 shadow-inner' 
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                      }`}
                      title="Not Recommend (Reject)"
                    >
                      <X className="w-4 h-4" />
                      {record._status === 'rejected' ? 'Rejected' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {searchQuery.trim() && searchedRecords.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <Search className="w-8 h-8 text-gray-300 mb-3" />
            <p>No records found for "{searchQuery}"</p>
          </div>
        )}
        
        {!searchQuery.trim() && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <CheckCircle2 className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-lg font-medium text-gray-500">Ready for Approvals</p>
            <p className="text-sm mt-1">Search an enrollment number above to begin.</p>
          </div>
        )}
      </div>

      {/* Standalone Export Buttons */}
      <div className="mt-6 pt-6 border-t border-gray-100">
        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Download Approval Files</h4>
        <p className="text-xs text-gray-500 mb-4">You can download these files right now without generating a datesheet.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportDGIC}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
          >
            <Building2 className="w-4 h-4" />
            DG IC File
          </button>
          <button
            onClick={handleExportAccountOffice}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Account Office
          </button>
          <button
            onClick={handleExportDepartment}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            Department File
          </button>
        </div>
      </div>
    </div>
  );
}
