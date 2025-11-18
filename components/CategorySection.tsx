
import React, { useState } from 'react';
import DataTable from './DataTable';
import { finalHeaders } from '../types';
import CopyButton from './CopyButton';
import ExcelExportButton from './ExcelExportButton';

interface CategorySectionProps {
    categoryName: string;
    data: Record<string, any>[];
    headers?: string[];
}

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);

const CategorySection: React.FC<CategorySectionProps> = ({ categoryName, data, headers }) => {
    const [isOpen, setIsOpen] = useState(true);
    const displayHeaders = headers || finalHeaders;

    return (
        <div className="mb-8 rounded-2xl bg-white shadow-md border-2 border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-gray-300">
            <div className="flex w-full items-center justify-between px-8 py-6 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b-2 border-gray-200">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex flex-grow items-center text-left group"
                    aria-expanded={isOpen}
                >
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                        {categoryName} <span className="text-sm font-semibold text-gray-500 ml-3 bg-gray-100 px-3 py-1 rounded-full">({data.length} rows)</span>
                    </h3>
                    <ChevronDownIcon className={`h-6 w-6 ml-4 text-gray-400 group-hover:text-teal-600 transition-all duration-300 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                <div className="flex-shrink-0 flex items-center gap-3 ml-4">
                    <ExcelExportButton headers={displayHeaders} data={data} filename={`${categoryName.replace(/[\s/]/g, '_')}.xlsx`} />
                    <CopyButton headers={displayHeaders} data={data} />
                </div>
            </div>
            {isOpen && (
                <div className="p-8 bg-gray-50/30">
                    <div className="grid grid-cols-2 gap-5 mb-8">
                        <div className="bg-white border-2 border-teal-100 p-5 rounded-xl shadow-sm text-center hover:shadow-md transition-all duration-200">
                            <p className="text-3xl font-bold bg-gradient-to-br from-teal-600 to-cyan-600 bg-clip-text text-transparent">{data.length}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Rows</p>
                        </div>
                        <div className="bg-white border-2 border-blue-100 p-5 rounded-xl shadow-sm text-center hover:shadow-md transition-all duration-200">
                            <p className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 bg-clip-text text-transparent">{displayHeaders.length}</p>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-2">Columns</p>
                        </div>
                    </div>
                    <DataTable headers={displayHeaders} data={data} />
                </div>
            )}
        </div>
    );
};

export default CategorySection;