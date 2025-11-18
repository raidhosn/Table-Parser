import React, { useState, useCallback } from 'react';
import { TransformedRow, finalHeaders } from './types';
import CategorySection from './components/CategorySection';
import DataTable from './components/DataTable';
import CopyButton from './components/CopyButton';
import ExcelExportButton from './components/ExcelExportButton';
import UploadModal from './components/UploadModal';
import DataInputCard from './components/DataInputCard';

/**
 * Removes the standard header line from Azure DevOps query exports.
 * @param text The raw text content from the file.
 * @returns The cleaned text content.
 */
const cleanAzureDevOpsHeader = (text: string): string => {
    if (!text) return text;
    const lines = text.split('\n');
    
    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        // Check for distinctive parts of the Azure DevOps header to ensure we only remove the correct line.
        const isAzureHeader = firstLine.startsWith("Project: Quota") &&
                              firstLine.includes("Server: https://dev.azure.com/capacityrequest") &&
                              firstLine.includes("Query: [None]") &&
                              firstLine.includes("List type: Flat");
                              
        if (isAzureHeader) {
            return lines.slice(1).join('\n');
        }
    }

    return text;
};


/**
 * Removes region abbreviations from a region string.
 * @param region The raw region string (e.g., "Brazil South (SB)").
 * @returns The cleaned region string (e.g., "Brazil South").
 */
const cleanRegion = (region: string): string => {
    if (!region) return region;
    // Removes abbreviations like (SEA), (FC), (SB), (NE), etc.
    return region.replace(/\s\([A-Z]+\)/g, '').trim();
};


const App: React.FC = () => {
    const [rawInput, setRawInput] = useState<string>('');
    const [categorizedData, setCategorizedData] = useState<Record<string, TransformedRow[]> | null>(null);
    const [transformedData, setTransformedData] = useState<TransformedRow[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [unifiedView, setUnifiedView] = useState<'none' | 'full'>('none');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
    
    const handleTransform = useCallback(() => {
        setError(null);
        setCategorizedData(null);
        setTransformedData(null);
        setUnifiedView('none');
        
        const cleanedInput = cleanAzureDevOpsHeader(rawInput);

        if (!cleanedInput.trim()) {
            setError("Input data cannot be empty.");
            return;
        }

        try {
            const lines = cleanedInput.trim().split('\n').filter(line => line.trim() !== '');
            if (lines.length < 2) {
                setError("Input must contain a header row and at least one data row.");
                return;
            }

            const headerLine = lines[0];
            const dataLines = lines.slice(1);
            
            // Auto-detect separator
            let separator: string | RegExp;
            const tabCount = (headerLine.match(/\t/g) || []).length;
            const commaCount = (headerLine.match(/,/g) || []).length;

            if (tabCount > commaCount && tabCount > 0) {
                separator = '\t';
            } else if (commaCount > 0) {
                separator = ',';
            } else {
                separator = /\s+/;
            }
            
            const headers = headerLine.split(separator).map(h => h.trim().replace(/"/g, ''));
            const headerMap: { [key: string]: number } = {};
            headers.forEach((header, index) => {
                headerMap[header] = index;
            });

            const isAlreadyTransformed = finalHeaders.every(h => headers.includes(h));
            let processedRows: TransformedRow[];

            if (isAlreadyTransformed) {
                // Data is already in the final format
                processedRows = dataLines.map((line, index) => {
                    const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
                    const get = (col: keyof Omit<TransformedRow, 'Original ID'>) => values[headerMap[col]]?.trim() || '';

                    let status = get('Status');
                    if (status === 'Verification Successful') {
                        status = 'Approved';
                    } else if (status === 'Abandoned') {
                        status = 'Backlogged';
                    } else if (status === '-') {
                        status = 'Pending Customer Response';
                    }

                    return {
                        'Subscription ID': get('Subscription ID'),
                        'Request Type': get('Request Type'),
                        'VM Type': get('VM Type'),
                        'Region': cleanRegion(get('Region')),
                        'Zone': get('Zone'),
                        'Cores': get('Cores'),
                        'Status': status,
                        'Original ID': `pre-transformed-${index}`, // Stable key
                    };
                });

            } else {
                // Data is in raw format, needs transformation
                const requiredOriginalHeaders = ["UTC Ticket", "Deployment Constraints", "Event ID", "Reason", "Subscription ID", "SKU", "Region"];
                if (!headerMap.hasOwnProperty('ID') && !headerMap.hasOwnProperty('RDQuota')) {
                    throw new Error('Missing required header column: "ID" or "RDQuota"');
                }
                for (const reqHeader of requiredOriginalHeaders) {
                    if (!(reqHeader in headerMap)) {
                        throw new Error(`Missing required header column: "${reqHeader}"`);
                    }
                }

                processedRows = dataLines.map((line) => {
                    const values = line.split(separator).map(v => v.trim().replace(/"/g, ''));
                    
                    const get = (col: string) => values[headerMap[col]]?.trim() || '';

                    const originalRequestType = get("UTC Ticket");
                    let cores = get("Event ID");
                    let zone = get("Deployment Constraints");
                    let status = get("Reason");

                    if (originalRequestType === "AZ Enablement/Whitelisting") {
                        cores = 'N/A';
                    } else if (cores === '-1') {
                        cores = '';
                    }
                    
                    if (!zone) {
                        zone = 'N/A';
                    }

                    let finalRequestType = originalRequestType;
                    switch (originalRequestType) {
                        case 'AZ Enablement/Whitelisting': finalRequestType = 'Zonal Enablement'; break;
                        case 'Region Enablement/Whitelisting': finalRequestType = 'Region Enablement'; break;
                        case 'Whitelisting/Quota Increase': finalRequestType = 'Region Enablement & Quota Increase'; break;
                        case 'Quota Increase': finalRequestType = 'Quota Increase'; break;
                        case 'Region Limit Increase': finalRequestType = 'Region Limit Increase'; break;
                        case 'RI Enablement/Whitelisting': finalRequestType = 'Reserved Instances'; break;
                    }

                    if (status === 'Fulfillment Actions Completed') {
                        status = 'Fulfilled';
                    } else if (status === 'Verification Successful') {
                        status = 'Approved';
                    } else if (status === 'Abandoned') {
                        status = 'Backlogged';
                    } else if (status === '-') {
                        status = 'Pending Customer Response';
                    }

                    return {
                        'Subscription ID': get("Subscription ID"),
                        'Request Type': finalRequestType,
                        'VM Type': get("SKU"),
                        'Region': cleanRegion(get("Region")),
                        'Zone': zone,
                        'Cores': cores,
                        'Status': status,
                        'Original ID': get("RDQuota") || get("ID"),
                    };
                }).filter(row => {
                    const isZoneNA = row['Zone'] === 'N/A';
                    const isRowEffectivelyEmpty = !row['Subscription ID'] && !row['VM Type'] && !row['Region'] && !row['Request Type'];
                    return !(isZoneNA && isRowEffectivelyEmpty);
                });
            }


            if (processedRows.length === 0) {
                setError("No valid data rows could be processed. Please check your input.");
                return;
            }

            const groups: Record<string, TransformedRow[]> = {};
            for (const row of processedRows) {
                const category = row['Request Type'];
                if (!groups[category]) {
                    groups[category] = [];
                }
                groups[category].push(row);
            }

            setTransformedData(processedRows);
            setCategorizedData(groups);

        } catch (e) {
            if (e instanceof Error) {
                setError(`Failed to process data: ${e.message}. Please check the input format.`);
            } else {
                setError("An unknown error occurred during processing.");
            }
        }
    }, [rawInput]);
    
    const handleClear = () => {
        setRawInput('');
        setCategorizedData(null);
        setTransformedData(null);
        setError(null);
        setUnifiedView('none');
    };

    const handleDataLoaded = useCallback((data: string) => {
        setRawInput(data);
        setCategorizedData(null);
        setTransformedData(null);
        setError(null);
        setUnifiedView('none');
    }, []);
    
    const handleDataUploadedFromModal = useCallback((data: string) => {
        handleDataLoaded(data);
        setIsUploadModalOpen(false);
    }, [handleDataLoaded]);

    const renderResults = () => {
        if (!categorizedData || !transformedData) {
            return null;
        }
    
        // Default View
        if (unifiedView === 'none') {
            return (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{transformedData.length}</p>
                            <p className="text-sm font-medium text-gray-500">Total Rows</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{Object.keys(categorizedData).length}</p>
                            <p className="text-sm font-medium text-gray-500">Categories</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{finalHeaders.length}</p>
                            <p className="text-sm font-medium text-gray-500">Columns</p>
                        </div>
                    </div>
    
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 text-gray-800">Categorized Results</h2>
                        {Object.entries(categorizedData)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([category, data]) => (
                                <CategorySection key={category} categoryName={category} data={data} />
                            ))}
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Unified Table</h2>
                            <div className="flex items-center space-x-2">
                                <ExcelExportButton headers={finalHeaders} data={transformedData} filename="Unified_Table.xlsx" />
                                <CopyButton headers={finalHeaders} data={transformedData} />
                            </div>
                        </div>
                        <DataTable headers={finalHeaders} data={transformedData} />
                    </div>
                </>
            );
        }
    
        // List by RDQuotas View
        if (unifiedView === 'full') {
            const headersWithRdQuota = ['RDQuota', ...finalHeaders];
            const unifiedDataWithRdQuota = transformedData.map(row => ({ ...row, RDQuota: row['Original ID'] }));
    
            return (
                 <div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{transformedData.length}</p>
                            <p className="text-sm font-medium text-gray-500">Total Rows</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{Object.keys(categorizedData).length}</p>
                            <p className="text-sm font-medium text-gray-500">Categories</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
                            <p className="text-2xl font-bold text-indigo-600">{headersWithRdQuota.length}</p>
                            <p className="text-sm font-medium text-gray-500">Columns</p>
                        </div>
                    </div>
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold mb-4 text-gray-800">RDQuotas Categorized by Request Type</h2>
                        {Object.entries(categorizedData)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([category, data]) => (
                                <CategorySection 
                                    key={category} 
                                    categoryName={category} 
                                    data={data.map(row => ({ ...row, RDQuota: row['Original ID'] }))} 
                                    headers={headersWithRdQuota}
                                />
                            ))}
                    </div>
    
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-gray-800">Unified Table</h2>
                            <div className="flex items-center space-x-2">
                                 <ExcelExportButton headers={headersWithRdQuota} data={unifiedDataWithRdQuota} filename="Unified_Table_by_RDQuota.xlsx" />
                                 <CopyButton headers={headersWithRdQuota} data={unifiedDataWithRdQuota} />
                            </div>
                        </div>
                        <DataTable headers={headersWithRdQuota} data={unifiedDataWithRdQuota} />
                    </div>
                </div>
            );
        }
    
        return null;
    };


    return (
        <div className="min-h-screen font-sans text-gray-900">
            <header className="bg-white shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <h1 className="text-2xl font-bold text-gray-800">Quota Data Transformer</h1>
                    <p className="text-gray-600 mt-1">Paste raw data to categorize and transform it according to predefined rules.</p>
                </div>
            </header>
            
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <DataInputCard onDataLoaded={handleDataLoaded} />
                
                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mb-8">
                     <label htmlFor="raw-input" className="block text-lg font-semibold text-gray-700 mb-2">Raw Table Input</label>
                    <textarea
                        id="raw-input"
                        rows={10}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 ease-in-out font-sans text-sm bg-white text-gray-800"
                        placeholder="Data loaded from the upload section will appear here. You can also paste directly and edit before transforming..."
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                    />
                    <div className="mt-4 flex justify-end space-x-4">
                        <button
                            onClick={handleClear}
                            className="px-6 py-2 bg-white text-gray-700 font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Clear
                        </button>
                        {transformedData && (
                             <button
                                onClick={() => setUnifiedView('full')}
                                className="px-5 py-2 border border-indigo-600 text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                List by RDQuotas
                            </button>
                        )}
                        <button
                            onClick={handleTransform}
                            className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Transform
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
                        <strong className="font-bold">Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                {renderResults()}
            </main>
            {isUploadModalOpen && (
                <UploadModal
                    isOpen={isUploadModalOpen}
                    onClose={() => setIsUploadModalOpen(false)}
                    onDataLoaded={handleDataUploadedFromModal}
                />
            )}
        </div>
    );
};

export default App;