
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
        <div className="mb-4 rounded-lg bg-white shadow-sm border border-gray-200">
            <div className="flex w-full items-center justify-between p-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex flex-grow items-center text-left"
                    aria-expanded={isOpen}
                >
                    <h3 className="text-lg font-semibold text-gray-800">
                        {categoryName} <span className="text-sm font-normal text-gray-500">({data.length} rows)</span>
                    </h3>
                    <ChevronDownIcon className={`h-5 w-5 ml-2 text-gray-500 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                <div className="flex-shrink-0 flex items-center space-x-2">
                    <ExcelExportButton headers={displayHeaders} data={data} filename={`${categoryName.replace(/[\s/]/g, '_')}.xlsx`} />
                    <CopyButton headers={displayHeaders} data={data} />
                </div>
            </div>
            {isOpen && (
                <div className="p-4 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200 text-center">
                            <p className="text-xl font-bold text-indigo-600">{data.length}</p>
                            <p className="text-xs font-medium text-gray-500">Rows</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200 text-center">
                            <p className="text-xl font-bold text-indigo-600">{displayHeaders.length}</p>
                            <p className="text-xs font-medium text-gray-500">Columns</p>
                        </div>
                    </div>
                    <DataTable headers={displayHeaders} data={data} />
                </div>
            )}
        </div>
    );
};

export default CategorySection;