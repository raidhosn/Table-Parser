import React from 'react';

// Make XLSX available from the global scope (loaded via CDN)
declare const XLSX: any;

interface ExcelExportButtonProps {
    headers: string[];
    data: Record<string, any>[];
    filename: string;
}

const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const handleExport = (headers: string[], data: Record<string, any>[], filename: string) => {
    if (typeof XLSX === 'undefined') {
        console.error("XLSX library is not loaded. Make sure it's included in your HTML.");
        alert("Excel export functionality is currently unavailable.");
        return;
    }

    // Re-map data to ensure correct header order and inclusion
    const dataForSheet = data.map(row => {
        const newRow: { [key: string]: string } = {};
        headers.forEach(header => {
            newRow[header] = String(row[header] || '');
        });
        return newRow;
    });

    const ws = XLSX.utils.json_to_sheet(dataForSheet, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
};


const ExcelExportButton: React.FC<ExcelExportButtonProps> = ({ headers, data, filename }) => {
    return (
        <button
            onClick={() => handleExport(headers, data, filename)}
            className="flex items-center justify-center px-5 py-2.5 border-2 text-xs font-bold rounded-xl transition-all duration-200 bg-white text-gray-700 hover:bg-gray-50 border-gray-300 hover:border-gray-400 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!data || data.length === 0}
            title="Export to Excel"
        >
            <DownloadIcon className="h-4 w-4 mr-2" />
            Export
        </button>
    );
};

export default ExcelExportButton;