import React, { useState, useCallback, useRef } from 'react';

// Make XLSX and mammoth available from the global scope (loaded via CDN)
declare const XLSX: any;
declare const mammoth: any;

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
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

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onDataLoaded }) => {
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

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFile = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
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
                                onDataLoaded(tsv);
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
                            onDataLoaded(text);
                        } catch (err) {
                            setError(`Error reading text file: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
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
                            onDataLoaded(tsv);
                        } catch (err) {
                            setError(`Error parsing HTML file: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
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
                            onDataLoaded(tsv);
                        } catch (err) {
                            setError(`Error parsing DOCX file: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
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
    }, [onDataLoaded]);
    
    const handleSheetSelect = (sheetName: string) => {
        if (!workbook) return;
        setIsLoading(true);
        setError(null);
        try {
            const worksheet = workbook.Sheets[sheetName];
            const tsv = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
            onDataLoaded(tsv);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" aria-modal="true" role="dialog">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 m-4">
                <div className="flex items-start justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{sheetNames ? 'Select a Sheet' : 'Upload Your Data'}</h2>
                    <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 mb-6 rounded-r-lg" role="alert">
                        <p className="font-bold text-sm">Error</p>
                        <p className="text-sm">{error}</p>
                    </div>
                )}
                
                {isLoading && (
                    <div className="flex flex-col justify-center items-center h-64">
                         <div className="animate-spin rounded-full h-14 w-14 border-4 border-teal-100 border-t-teal-600"></div>
                         <p className="mt-4 text-gray-600 font-medium">Processing file...</p>
                    </div>
                )}

                {!isLoading && !sheetNames && (
                    <>
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={triggerFileSelect}
                            className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 ${isDragging ? 'border-teal-500 bg-teal-50 scale-105' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'}`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                                accept=".csv,.tsv,.txt,.xlsx,.xls,.docx,.html"
                            />
                            <svg className="w-16 h-16 text-teal-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 15l-4-4m0 0l4-4m-4 4h12" /></svg>
                            <p className="text-center text-gray-700 text-lg">
                                <span className="font-bold text-teal-600">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                Supports: CSV, TSV, TXT, XLSX, XLS, DOCX, HTML
                            </p>
                        </div>
                    </>
                )}

                {!isLoading && sheetNames && (
                    <div>
                        <p className="text-sm text-gray-600 mb-4">Your Excel file has multiple sheets. Please choose one to import.</p>
                        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-200">
                            {sheetNames.map((name) => (
                                <button
                                    key={name}
                                    onClick={() => handleSheetSelect(name)}
                                    className="w-full text-left px-5 py-3.5 text-sm font-medium text-gray-800 hover:bg-teal-50 hover:text-teal-700 transition-all duration-150"
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadModal;