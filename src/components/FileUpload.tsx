import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
  isLoading: boolean;
  key?: string | number;
}

export function FileUpload({ onDataLoaded, isLoading }: FileUploadProps) {
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        onDataLoaded(json);
      };
      reader.readAsArrayBuffer(file);
    },
    [onDataLoaded]
  );

  return (
    <div className="w-full">
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
    </div>
  );
}
