import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

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
    const worksheet = wb.Sheets[sheetName];
    
    // Read as array of arrays first to find the header row
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    
    if (rows.length === 0) {
      onDataLoaded([]);
      return;
    }

    // Find the best header row by counting keyword matches
    let bestHeaderIndex = 0;
    let maxMatches = 0;
    
    // Scan more rows (up to 20) for better reliability
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      let matches = 0;
      
      const rowStr = row.map(cell => String(cell).toLowerCase()).join(' ');
      
      // Keywords for high confidence headers
      if (rowStr.match(/enrollment|reg|registration|studentid|rollno|reg#/)) matches += 2;
      if (rowStr.match(/subject|course|coursename|coursetitle|sub/)) matches += 2;
      if (rowStr.match(/code|id|name|teacher|program|class/)) matches += 1;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestHeaderIndex = i;
      }
    }

    // Convert to JSON using the best found header row
    const initialJson: any[] = XLSX.utils.sheet_to_json(worksheet, { 
      range: bestHeaderIndex,
      defval: "" 
    });
    
    // Forward fill logic for merged cells
    if (initialJson.length === 0) {
      onDataLoaded([]);
      return;
    }

    const processedJson: any[] = [];
    let lastValidRow: any = { ...initialJson[0] };

    for (let i = 0; i < initialJson.length; i++) {
      const currentRow = initialJson[i];
      const newRow = { ...currentRow };

      const keys = Object.keys(currentRow);
      let hasData = false;

      keys.forEach(key => {
        const val = String(currentRow[key]).trim();
        // Skip keys that look like "Sr #" or index if they are empty
        if (val !== "") {
          hasData = true;
          lastValidRow[key] = currentRow[key];
        } else {
          newRow[key] = lastValidRow[key];
        }
      });

      if (hasData) {
        processedJson.push(newRow);
      }
    }

    onDataLoaded(processedJson);
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
