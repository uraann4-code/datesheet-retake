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

export function unmergeAndFill(wb: XLSX.WorkBook, sheetName: string): any[] {
  const worksheet = wb.Sheets[sheetName];
  if (!worksheet['!merges']) return XLSX.utils.sheet_to_json(worksheet);

  // Deep copy worksheet to not modify original if needed, 
  // but sheet_to_json usually doesn't mind if we modify the cells here
  const merges = worksheet['!merges'];
  merges.forEach(merge => {
    const startCell = worksheet[XLSX.utils.encode_cell(merge.s)];
    if (!startCell) return;
    
    const value = startCell.v;
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[addr]) {
          worksheet[addr] = { v: value, t: startCell.t };
        } else {
          worksheet[addr].v = value;
        }
      }
    }
  });

  return XLSX.utils.sheet_to_json(worksheet);
}

export function sortRecordsByRecommendation(data: any[]): any[] {
  if (data.length === 0) return data;
  
  // Try to find a recommendation column (Look for Remarks, Decision, Status, etc.)
  const keys = Object.keys(data[0]);
  const recKey = keys.find(k => k.toLowerCase().match(/remark|recommend|status|decision|result/));
  
  if (!recKey) return data;

  return [...data].sort((a, b) => {
    const valA = String(a[recKey] || "").toLowerCase().trim();
    const valB = String(b[recKey] || "").toLowerCase().trim();
    
    // Check for "Recommended" (must not contain "not")
    const aIsRecommended = valA.includes("recommended") && !valA.includes("not");
    const bIsRecommended = valB.includes("recommended") && !valB.includes("not");
    
    // Check for "Not Recommended"
    const aIsNotRecommended = valA.includes("not recommended") || (valA.includes("not") && valA.includes("recommended"));
    const bIsNotRecommended = valB.includes("not recommended") || (valB.includes("not") && valB.includes("recommended"));

    // Priority ordering: 
    // 1. Recommended
    // 2. Everything else (Pending, etc.)
    // 3. Not Recommended

    const getPriority = (isRec: boolean, isNotRec: boolean) => {
      if (isRec) return 1;
      if (isNotRec) return 3;
      return 2;
    };

    const priorityA = getPriority(aIsRecommended, aIsNotRecommended);
    const priorityB = getPriority(bIsRecommended, bIsNotRecommended);

    return priorityA - priorityB;
  });
}
