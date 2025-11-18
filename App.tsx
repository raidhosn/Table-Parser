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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white border-2 border-teal-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-teal-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">{transformedData.length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Rows</p>
                        </div>
                        <div className="bg-white border-2 border-blue-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-blue-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">{Object.keys(categorizedData).length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categories</p>
                        </div>
                        <div className="bg-white border-2 border-cyan-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-cyan-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-cyan-600 to-teal-600 bg-clip-text text-transparent mb-2">{finalHeaders.length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Columns</p>
                        </div>
                    </div>

                    <div className="mb-12">
                        <div className="flex items-center mb-8">
                            <div className="h-1.5 w-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full mr-4"></div>
                            <h2 className="text-3xl font-bold text-gray-900">Categorized Results</h2>
                        </div>
                        {Object.entries(categorizedData)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([category, data]) => (
                                <CategorySection key={category} categoryName={category} data={data} />
                            ))}
                    </div>

                    <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 mb-12 hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                                <div className="h-1.5 w-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full mr-4"></div>
                                <h2 className="text-3xl font-bold text-gray-900">Unified Table</h2>
                            </div>
                            <div className="flex items-center gap-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                        <div className="bg-white border-2 border-teal-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-teal-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-teal-600 to-cyan-600 bg-clip-text text-transparent mb-2">{transformedData.length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Rows</p>
                        </div>
                        <div className="bg-white border-2 border-blue-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-blue-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">{Object.keys(categorizedData).length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Categories</p>
                        </div>
                        <div className="bg-white border-2 border-cyan-100 p-8 rounded-2xl shadow-lg text-center transform transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-cyan-200">
                            <div className="text-5xl font-bold bg-gradient-to-br from-cyan-600 to-teal-600 bg-clip-text text-transparent mb-2">{headersWithRdQuota.length}</div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Columns</p>
                        </div>
                    </div>
                    <div className="mb-12">
                        <div className="flex items-center mb-8">
                            <div className="h-1.5 w-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full mr-4"></div>
                            <h2 className="text-3xl font-bold text-gray-900">RDQuotas Categorized by Request Type</h2>
                        </div>
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
    
                    <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-200 hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center">
                                <div className="h-1.5 w-16 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full mr-4"></div>
                                <h2 className="text-3xl font-bold text-gray-900">Unified Table</h2>
                            </div>
                            <div className="flex items-center gap-3">
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
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 font-sans text-gray-900">
            <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-md">
                            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Quota Data Transformer</h1>
                    </div>
                    <p className="text-gray-600 ml-13">Transform and categorize quota data with ease</p>
                </div>
            </header>

            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-7xl">
                <DataInputCard onDataLoaded={handleDataLoaded} />
                
                <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 mb-8 hover:shadow-lg transition-shadow duration-300">
                     <label htmlFor="raw-input" className="block text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Raw Table Input
                    </label>
                    <textarea
                        id="raw-input"
                        rows={10}
                        className="w-full p-5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 font-mono text-sm bg-gray-50/50 text-gray-800 placeholder-gray-400 hover:border-gray-300"
                        placeholder="Data loaded from the upload section will appear here. You can also paste directly and edit before transforming..."
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                    />
                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <button
                            onClick={handleClear}
                            className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200 shadow-sm hover:shadow-md"
                        >
                            Clear
                        </button>
                        {transformedData && (
                             <button
                                onClick={() => setUnifiedView('full')}
                                className="px-6 py-3 border-2 border-teal-600 text-teal-600 font-semibold rounded-xl hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                                List by RDQuotas
                            </button>
                        )}
                        <button
                            onClick={handleTransform}
                            className="px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-teal-700 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                        >
                            Transform
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-6 py-5 rounded-xl relative mb-8 shadow-md" role="alert">
                        <div className="flex items-start">
                            <svg className="h-6 w-6 text-red-500 mr-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <strong className="font-bold text-base">Error: </strong>
                                <span className="block sm:inline text-sm">{error}</span>
                            </div>
                        </div>
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