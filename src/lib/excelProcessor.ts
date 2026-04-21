import * as XLSX from 'xlsx';

export function processExcelData(wb: XLSX.WorkBook, sheetName: string): any[] {
  const worksheet = wb.Sheets[sheetName];
  
  // Read as array of arrays first to find the header row
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  
  if (rows.length === 0) {
    return [];
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
  const headers = rows[bestHeaderIndex].map(h => String(h || "").trim());
  const dataRows = rows.slice(bestHeaderIndex + 1);
  
  const processedJson: any[] = [];
  const lastValidValues: Record<string, any> = {};

  dataRows.forEach((row, rowIndex) => {
    const rowData: any = {};
    let hasAnyValue = false;
    
    headers.forEach((header, colIndex) => {
      if (!header || header.startsWith("__EMPTY")) return;
      const val = String(row[colIndex] || "").trim();
      rowData[header] = val;
      if (val !== "") hasAnyValue = true;
    });

    if (!hasAnyValue) return;

    // Smart Forward Fill for Student Info columns
    headers.forEach(header => {
      if (!header || header.startsWith("__EMPTY")) return;
      const hLower = header.toLowerCase();
      const isStudentField = hLower.match(/enrollment|reg|registration|studentid|rollno|reg#|name|program|class|degree/);
      
      if (rowData[header] === "" && isStudentField && lastValidValues[header]) {
        // If a student field is empty, but we have a previous value and THIS row has a subject, fill it
        const subjectKey = headers.find(h => h.toLowerCase().match(/subject|course|coursename|coursetitle|sub/));
        if (subjectKey && row[headers.indexOf(subjectKey)]) {
          rowData[header] = lastValidValues[header];
        }
      }
      
      if (rowData[header] !== "") {
        lastValidValues[header] = rowData[header];
      }
    });

    // Add identifying keys
    const enrollmentKey = headers.find(h => h.toLowerCase().match(/enrollment|reg|registration|studentid|rollno|reg#/));
    const subjectKey = headers.find(h => h.toLowerCase().match(/subject|course|coursename|coursetitle|sub/));
    
    if (enrollmentKey && rowData[enrollmentKey] && subjectKey && rowData[subjectKey]) {
      processedJson.push(rowData);
    }
  });

  // Deduplication
  const enrollmentKey = headers.find(h => h.toLowerCase().match(/enrollment|reg|registration|studentid|rollno|reg#/)) || "";
  const subjectKey = headers.find(h => h.toLowerCase().match(/subject|course|coursename|coursetitle|sub/)) || "";
  
  const seen = new Set<string>();
  return processedJson.filter((row, idx) => {
    const studentId = String(row[enrollmentKey] || "").trim();
    const subjectName = String(row[subjectKey] || "").trim().toUpperCase().replace(/\s+/g, '');
    const key = `${studentId}|${subjectName}`;
    
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
