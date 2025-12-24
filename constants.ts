
import { Agent, IdleTrend, CustomerProfile } from './types';

export const DEFAULT_PROFILES: CustomerProfile[] = [
  {
    id: 'examp-001',
    name: 'Example',
    region: 'ap_southeast_2',
    apiHost: 'https://api.mypurecloud.com.au',
    clientId: '', // Empty to force user configuration
    clientSecret: '', // Empty to force user configuration
    loginHost: 'https://login.mypurecloud.com.au',
    corsProxy: 'https://corsproxy.io/?',
    lastSyncedAt: undefined
  }
];

// Start with empty agents so user is prompted to sync
export const MOCK_AGENTS: Agent[] = [];

export const MOCK_TRENDS: IdleTrend[] = [
  { time: '08:00', idleCount: 2, activeCount: 10 },
  { time: '09:00', idleCount: 5, activeCount: 8 },
  { time: '10:00', idleCount: 12, activeCount: 15 },
  { time: '11:00', idleCount: 8, activeCount: 20 },
  { time: '12:00', idleCount: 15, activeCount: 12 },
  { time: '13:00', idleCount: 20, activeCount: 8 },
  { time: '14:00', idleCount: 10, activeCount: 25 },
];

export const GENESYS_COLORS = {
  primary: '#ff4f1f',
  secondary: '#2c3e50',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  idle: '#6366f1'
};
