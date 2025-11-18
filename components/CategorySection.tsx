
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
        <div className="mb-6 rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
            <div className="flex w-full items-center justify-between px-6 py-5 bg-gradient-to-r from-gray-50 to-white">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex flex-grow items-center text-left group"
                    aria-expanded={isOpen}
                >
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-teal-600 transition-colors">
                        {categoryName} <span className="text-sm font-medium text-gray-500 ml-2">({data.length} rows)</span>
                    </h3>
                    <ChevronDownIcon className={`h-5 w-5 ml-3 text-gray-400 group-hover:text-teal-600 transition-all duration-200 ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                <div className="flex-shrink-0 flex items-center gap-2">
                    <ExcelExportButton headers={displayHeaders} data={data} filename={`${categoryName.replace(/[\s/]/g, '_')}.xlsx`} />
                    <CopyButton headers={displayHeaders} data={data} />
                </div>
            </div>
            {isOpen && (
                <div className="p-6 pt-4">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-100 text-center">
                            <p className="text-2xl font-bold text-teal-600">{data.length}</p>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-1">Rows</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-100 text-center">
                            <p className="text-2xl font-bold text-blue-600">{displayHeaders.length}</p>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-1">Columns</p>
                        </div>
                    </div>
                    <DataTable headers={displayHeaders} data={data} />
                </div>
            )}
        </div>
    );
};

export default CategorySection;