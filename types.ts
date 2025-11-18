
export interface TransformedRow {
  'Subscription ID': string;
  'Request Type': string;
  'VM Type': string;
  'Region': string;
  'Zone': string;
  'Cores': string;
  'Status': string;
  // Keep original ID for stable keys if available
  'Original ID'?: string;
}

export const finalHeaders: (keyof Omit<TransformedRow, 'Original ID'>)[] = [
    'Subscription ID',
    'Request Type',
    'VM Type',
    'Region',
    'Zone',
    'Cores',
    'Status'
];