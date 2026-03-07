import 'dotenv/config';

export const RAILWAY_URL = process.env.RAILWAY_URL || 'https://abis-drift-monitor-production-b484.up.railway.app';
export const ABIS_ADMIN_KEY = process.env.ABIS_ADMIN_KEY || '';
export const MONGODB_URI = process.env.MONGODB_URI || '';
export const AMBIENT_DRIFT_THRESHOLD = parseFloat(process.env.AMBIENT_DRIFT_THRESHOLD || '0.65');
export const AMBIENT_CRITICAL_THRESHOLD = parseFloat(process.env.AMBIENT_CRITICAL_THRESHOLD || '0.90');
export const SESSION_SNAPSHOT_INTERVAL = parseInt(process.env.SESSION_SNAPSHOT_INTERVAL || '5', 10);
