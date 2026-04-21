import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { processExcelData } from '../lib/excelProcessor';

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
  isLoading: boolean;
  key?: string | number;
}

export function FileUpload({ onDataLoaded, isLoading }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const data = processExcelData(wb, sheetName);
    
    // Add internal metadata for the generator
    const processed = data.map((row, index) => ({
      ...row,
      _id: `rec_${Date.now()}_${index}`,
      _status: 'pending'
    }));

    onDataLoaded(processed);
  };

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        const firstSheetName = wb.SheetNames[0];
        setSelectedSheet(firstSheetName);
        processSheet(wb, firstSheetName);
      };
      reader.readAsArrayBuffer(file);
    },
    [onDataLoaded]
  );

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sheetName = e.target.value;
    setSelectedSheet(sheetName);
    if (workbook) {
      processSheet(workbook, sheetName);
    }
  };

  return (
    <div className="w-full space-y-4">
      <label
        htmlFor="file-upload"
        className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isLoading
            ? 'bg-gray-100 border-gray-300'
            : 'bg-blue-50 border-blue-300 hover:bg-blue-100'
        }`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud
            className={`w-10 h-10 mb-3 ${
              isLoading ? 'text-gray-400' : 'text-blue-500'
            }`}
          />
          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Excel files only (.xlsx, .xls)
          </p>
          <p className="text-xs text-gray-500 mt-2 text-center px-4">
            Required columns: Enrollment, Course Code, Subject
          </p>
        </div>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          disabled={isLoading}
        />
      </label>

      {fileName && sheetNames.length > 0 && (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            <span className="truncate max-w-[200px]">{fileName}</span>
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Select Sheet
            </label>
            <select
              value={selectedSheet}
              onChange={handleSheetChange}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {sheetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
