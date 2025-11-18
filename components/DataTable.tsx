import React from 'react';

interface DataTableProps {
    headers: string[];
    data: Record<string, any>[];
}

const DataTable: React.FC<DataTableProps> = ({ headers, data }) => {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="min-w-full bg-gray-800 text-sm">
                <thead>
                    <tr className="divide-x divide-gray-700">
                        {headers.map((header) => (
                            <th key={header} className="whitespace-nowrap px-4 py-3 text-center font-medium text-white">
                                {header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {data.map((row, rowIndex) => (
                        <tr key={row['Original ID'] || rowIndex} className="divide-x divide-gray-700 hover:bg-gray-700">
                            {headers.map((header, colIndex) => (
                                <td key={`${rowIndex}-${colIndex}`} className="whitespace-nowrap px-4 py-3 text-gray-300 text-center">
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