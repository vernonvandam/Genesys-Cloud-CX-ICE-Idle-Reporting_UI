
export interface Agent {
  id: string;
  name: string;
  presence: 'Available' | 'Away' | 'On Queue' | 'Meeting' | 'Busy' | 'Idle';
  routingStatus: 'IDLE' | 'COMMUNICATING' | 'INTERACTING' | 'OFF_LINE' | 'NOT_RESPONDING';
  idleMinutes: number;
  lastStatusChange: string;
  queue: string;
  efficiencyScore: number;
}

export interface MetricSummary {
  totalAgents: number;
  idleAgents: number;
  avgIdleTime: number;
  maxIdleTime: number;
  onQueueAgents: number;
}

export interface IdleTrend {
  time: string;
  idleCount: number;
  activeCount: number;
}

export interface AIAnalysis {
  summary: string;
  recommendations: string[];
  bottlenecks: string[];
}

export interface CustomerProfile {
  id: string;
  name: string;
  region: string;
  apiHost: string;
  clientId: string;
  clientSecret: string;
  loginHost: string;
  corsProxy?: string; // New field for CORS bypass
  lastSyncedAt?: string;
}
