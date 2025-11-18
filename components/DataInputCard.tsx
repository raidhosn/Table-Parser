import React, { useState, useCallback, useRef } from 'react';

// Make XLSX and mammoth available from the global scope (loaded via CDN)
declare const XLSX: any;
declare const mammoth: any;

interface DataInputCardProps {
    onDataLoaded: (data: string) => void;
}

const parseHtmlTable = (htmlString: string): string => {
    const doc = new DOMParser().parseFromString(htmlString, 'text/html');
    const table = doc.querySelector('table');
    if (!table) {
        throw new Error("No table found in the HTML content.");
    }

    const rows = Array.from(table.querySelectorAll('tr'));
    return rows.map(row => {
        const cells = Array.from(row.querySelectorAll('th, td'));
        return cells.map(cell => cell.textContent?.trim() ?? '').join('\t');
    }).join('\n');
};

const DataInputCard: React.FC<DataInputCardProps> = ({ onDataLoaded }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [sheetNames, setSheetNames] = useState<string[] | null>(null);
    const [workbook, setWorkbook] = useState<any | null>(null);

    const resetState = useCallback(() => {
        setIsDragging(false);
        setError(null);
        setIsLoading(false);
        setSheetNames(null);
        setWorkbook(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);
    
    const handleSuccess = (data: string) => {
        onDataLoaded(data);
        resetState();
    }

    const handleFile = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setSheetNames(null);
        setWorkbook(null);
        try {
            const extension = file.name.split('.').pop()?.toLowerCase();
            const reader = new FileReader();

            switch (extension) {
                case 'xlsx':
                case 'xls':
                    reader.onload = (e) => {
                        try {
                            const data = e.target?.result;
                            const wb = XLSX.read(data, { type: 'array' });
                            if (wb.SheetNames.length > 1) {
                                setWorkbook(wb);
                                setSheetNames(wb.SheetNames);
                                setIsLoading(false);
                            } else {
                                const sheetName = wb.SheetNames[0];
                                const worksheet = wb.Sheets[sheetName];
                                const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
                                handleSuccess(tsv);
                            }
                        } catch (err) {
                            setError(`Error parsing Excel file: ${err instanceof Error ? err.message : String(err)}`);
                            setIsLoading(false);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                    break;
                
                case 'csv':
                case 'tsv':
                case 'txt':
                    reader.onload = (e) => {
                        try {
                            const text = e.target?.result as string;
                            handleSuccess(text);
                        } catch (err) {
                            setError(`Error reading text file: ${err instanceof Error ? err.message : String(err)}`);
                            setIsLoading(false);
                        }
                    };
                    reader.readAsText(file);
                    break;
                
                case 'html':
                    reader.onload = (e) => {
                        try {
                            const html = e.target?.result as string;
                            const tsv = parseHtmlTable(html);
                            handleSuccess(tsv);
                        } catch (err) {
                            setError(`Error parsing HTML file: ${err instanceof Error ? err.message : String(err)}`);
                            setIsLoading(false);
                        }
                    };
                    reader.readAsText(file);
                    break;
                
                case 'docx':
                    reader.onload = async (e) => {
                        try {
                            const arrayBuffer = e.target?.result as ArrayBuffer;
                            const result = await mammoth.convertToHtml({ arrayBuffer });
                            const tsv = parseHtmlTable(result.value);
                            handleSuccess(tsv);
                        } catch (err) {
                            setError(`Error parsing DOCX file: ${err instanceof Error ? err.message : String(err)}`);
                            setIsLoading(false);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                    break;

                case 'doc':
                     setError("'.doc' files are not supported due to technical limitations. Please convert to .docx or another supported format.");
                     setIsLoading(false);
                     break;

                default:
                    setError(`Unsupported file type: .${extension}`);
                    setIsLoading(false);
            }
        } catch (err) {
            setError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
            setIsLoading(false);
        }
    }, [handleSuccess]);
    
    const handleSheetSelect = (sheetName: string) => {
        if (!workbook) return;
        setIsLoading(true);
        setError(null);
        try {
            const worksheet = workbook.Sheets[sheetName];
            const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
            handleSuccess(tsv);
        } catch (err) {
            setError(`Error parsing selected sheet: ${err instanceof Error ? err.message : String(err)}`);
            setIsLoading(false);
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };
    
    const triggerFileSelect = () => fileInputRef.current?.click();

    return (
        <div className="bg-white p-10 rounded-2xl shadow-md border border-gray-200 mb-8 hover:shadow-lg transition-shadow duration-300">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <svg className="h-7 w-7 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {sheetNames ? 'Select a Sheet' : 'Upload Your Data'}
            </h2>
             
             {error && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-5 mb-6 rounded-r-xl shadow-sm" role="alert">
                    <p className="font-bold text-base">Error</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            )}
            
            {isLoading && (
                <div className="flex flex-col justify-center items-center h-64">
                     <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-100 border-t-teal-600 shadow-md"></div>
                     <p className="mt-5 text-gray-700 font-semibold text-lg">Processing file...</p>
                </div>
            )}

            {!isLoading && !sheetNames && (
                <>
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={triggerFileSelect}
                        className={`flex flex-col items-center justify-center p-16 border-3 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${isDragging ? 'border-teal-500 bg-teal-50/70 scale-105 shadow-xl' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50 shadow-inner'}`}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept=".csv,.tsv,.txt,.xlsx,.xls,.docx,.html"
                        />
                        <svg className="w-20 h-20 text-teal-500 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 15l-4-4m0 0l4-4m-4 4h12" /></svg>
                        <p className="text-center text-gray-700 text-xl mb-3">
                            <span className="font-bold text-teal-600">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-sm text-gray-500 font-medium">
                            Supports: CSV, TSV, TXT, XLSX, XLS, DOCX, HTML
                        </p>
                    </div>
                </>
            )}

            {!isLoading && sheetNames && (
                <div>
                    <p className="text-base text-gray-700 mb-5 font-medium">Your Excel file has multiple sheets. Please choose one to import.</p>
                    <div className="max-h-64 overflow-y-auto border-2 border-gray-200 rounded-xl divide-y divide-gray-200 shadow-inner">
                        {sheetNames.map((name) => (
                            <button
                                key={name}
                                onClick={() => handleSheetSelect(name)}
                                className="w-full text-left px-6 py-4 text-sm font-semibold text-gray-800 hover:bg-teal-50 hover:text-teal-700 transition-all duration-200 hover:pl-8"
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataInputCard;