import React, { useState } from 'react';

interface CopyButtonProps {
    headers: string[];
    data: Record<string, any>[];
}

const ClipboardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);


const copyTableToClipboard = async (headers: string[], data: Record<string, any>[]): Promise<boolean> => {
    const tsvHeader = headers.join('\t');
    const tsvBody = data.map(row => headers.map(h => row[h]).join('\t')).join('\n');
    const tsvString = `${tsvHeader}\n${tsvBody}`;

    const htmlHeader = `<thead><tr>${headers.map(h => `<th style="border: 1px solid #ddd; padding: 8px; text-align: center;">${h}</th>`).join('')}</tr></thead>`;
    const htmlBody = `<tbody>${data.map(row => `<tr>${headers.map(h => `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${String(row[h] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody>`;
    const htmlString = `<table style="border-collapse: collapse; width: 100%;">${htmlHeader}${htmlBody}</table>`;

    try {
        const htmlBlob = new Blob([htmlString], { type: 'text/html' });
        const textBlob = new Blob([tsvString], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob,
        });
        await navigator.clipboard.write([clipboardItem]);
        return true;
    } catch (err) {
        console.error('Failed to copy using ClipboardItem API: ', err);
        try {
            await navigator.clipboard.writeText(tsvString);
            return true;
        } catch (fallbackErr) {
            console.error('Fallback copy to clipboard failed: ', fallbackErr);
            return false;
        }
    }
};


const CopyButton: React.FC<CopyButtonProps> = ({ headers, data }) => {
    const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

    const handleCopy = async () => {
        if (copyState !== 'idle' || !data || data.length === 0) return;

        const success = await copyTableToClipboard(headers, data);
        setCopyState(success ? 'success' : 'error');
        setTimeout(() => setCopyState('idle'), 2500);
    };

    const buttonContent = {
        idle: {
            text: 'Copy',
            icon: <ClipboardIcon className="h-4 w-4 mr-2" />,
            className: 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-gray-300'
        },
        success: {
            text: 'Copied!',
            icon: <CheckIcon className="h-4 w-4 mr-2" />,
            className: 'bg-green-100 text-green-700 border-green-300'
        },
        error: {
            text: 'Failed',
            icon: <ClipboardIcon className="h-4 w-4 mr-2" />,
            className: 'bg-red-100 text-red-700 border-red-300'
        }
    };

    const current = buttonContent[copyState];

    return (
        <button
            onClick={handleCopy}
            className={`flex items-center justify-center px-3 py-1 border text-xs font-medium rounded-md transition-colors duration-150 ${current.className}`}
            disabled={copyState !== 'idle'}
        >
            {current.icon}
            {current.text}
        </button>
    );
};

export default CopyButton;