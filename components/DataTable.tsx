import React from 'react';

interface DataTableProps {
    headers: string[];
    data: Record<string, any>[];
}

const DataTable: React.FC<DataTableProps> = ({ headers, data }) => {
    return (
        <div className="overflow-x-auto rounded-xl border-2 border-gray-200 shadow-md">
            <table className="min-w-full bg-white text-sm">
                <thead className="bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 border-b-2 border-gray-300">
                    <tr className="divide-x divide-gray-300">
                        {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-6 py-4 text-center font-bold text-gray-800 uppercase tracking-wider text-xs">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {data.map((row, rowIndex) => (
                        <tr key={row['Original ID'] || rowIndex} className={`divide-x divide-gray-200 transition-all duration-150 ${rowIndex % 2 === 0 ? 'bg-white hover:bg-teal-50/50' : 'bg-gray-50/50 hover:bg-teal-50/50'}`}>
                            {headers.map((header, colIndex) => (
                                <td key={`${rowIndex}-${colIndex}`} className="whitespace-nowrap px-6 py-4 text-gray-700 text-center font-medium">
                                    {row[header]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;