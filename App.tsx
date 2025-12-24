
import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { MOCK_AGENTS, GENESYS_COLORS, DEFAULT_PROFILES } from './constants';
import { StatCard } from './components/StatCard';
import { AgentTable } from './components/AgentTable';
import { AdminPanel } from './components/AdminPanel';
import { analyzeIdleData } from './services/geminiService';
import { collectGenesysData } from './services/genesysService';
import { AIAnalysis, CustomerProfile, Agent, IdleTrend } from './types';

const App: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [syncHistory, setSyncHistory] = useState<IdleTrend[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agents' | 'reports' | 'admin'>('dashboard');
  
  // Filtering state for Agents Tab
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [presenceFilter, setPresenceFilter] = useState('All');

  // Multiple Profiles Persistence
  const [profiles, setProfiles] = useState<CustomerProfile[]>(() => {
    const saved = localStorage.getItem('genesys_profiles');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES;
  });

  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    return localStorage.getItem('active_profile_id') || (profiles.length > 0 ? profiles[0].id : '');
  });

  const activeProfile = useMemo(() => 
    profiles.find(p => p.id === activeProfileId) || profiles[0], 
    [profiles, activeProfileId]
  );

  // Effect to persist changes to profiles and active org
  useEffect(() => {
    localStorage.setItem('genesys_profiles', JSON.stringify(profiles));
    localStorage.setItem('active_profile_id', activeProfileId);
  }, [profiles, activeProfileId]);

  // CRITICAL: Clear all data when the active organization changes
  useEffect(() => {
    setAgents([]);
    setSyncHistory([]);
    setAiAnalysis(null);
    setSyncError(null);
    setSearchTerm('');
    setStatusFilter('All');
    setPresenceFilter('All');
  }, [activeProfileId]);

  const handleSaveProfile = (newProfile: CustomerProfile) => {
    setProfiles(prev => {
      const exists = prev.find(p => p.id === newProfile.id);
      if (exists) return prev.map(p => p.id === newProfile.id ? newProfile : p);
      return [...prev, newProfile];
    });
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) return alert("Must keep at least one profile.");
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(profiles[0].id);
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const freshData = await collectGenesysData(activeProfile);
      
      // Explicitly set the new data as a new array to ensure React state update
      setAgents([...freshData]);
      
      // Update Trends History (Tracking On Queue trends for better operational focus)
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const onQueue = freshData.filter(a => {
        const p = a.presence.toLowerCase().replace(/\s+/g, '');
        return p === 'onqueue';
      });

      const idleCount = onQueue.filter(a => a.routingStatus === 'IDLE').length;
      const activeCount = onQueue.filter(a => a.routingStatus === 'COMMUNICATING' || a.routingStatus === 'INTERACTING').length;
      
      setSyncHistory(prev => {
        const newHistory = [...prev, { time: timeStr, idleCount, activeCount }];
        return newHistory.slice(-15); // Keep last 15 sync snapshots
      });

      setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, lastSyncedAt: now.toISOString() } : p));
    } catch (e: any) {
      console.error(e);
      setSyncError(e.message || "Failed to sync from Genesys Cloud.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Dashboard Specific Filtering: Only show On Queue agents
  const onQueueAgents = useMemo(() => 
    agents.filter(a => {
      const p = a.presence.toLowerCase().replace(/\s+/g, '');
      return p === 'onqueue';
    }),
    [agents]
  );

  // Agents Tab Specific Filtering
  const filteredAgentsList = useMemo(() => {
    return agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || agent.routingStatus === statusFilter;
      
      let matchesPresence = true;
      if (presenceFilter !== 'All') {
        const p = agent.presence.toLowerCase().replace(/\s+/g, '');
        const f = presenceFilter.toLowerCase().replace(/\s+/g, '');
        matchesPresence = p === f;
      }
      
      return matchesSearch && matchesStatus && matchesPresence;
    });
  }, [agents, searchTerm, statusFilter, presenceFilter]);

  const stats = useMemo(() => {
    const idle = onQueueAgents.filter(a => a.routingStatus === 'IDLE').length;
    const maxIdle = onQueueAgents.length > 0 ? Math.max(...onQueueAgents.map(a => a.idleMinutes)) : 0;
    const avgIdle = onQueueAgents.length > 0 ? Math.round(onQueueAgents.reduce((acc, curr) => acc + curr.idleMinutes, 0) / onQueueAgents.length) : 0;
    return {
      total: onQueueAgents.length,
      idle,
      maxIdle,
      avgIdle
    };
  }, [onQueueAgents]);

  const statusDistribution = useMemo(() => {
    return [
      { name: 'Idle', count: onQueueAgents.filter(a => a.routingStatus === 'IDLE').length, color: '#6366f1' },
      { name: 'Comm', count: onQueueAgents.filter(a => a.routingStatus === 'COMMUNICATING').length, color: '#10b981' },
      { name: 'Busy/Other', count: onQueueAgents.filter(a => !['IDLE', 'COMMUNICATING'].includes(a.routingStatus)).length, color: '#f59e0b' },
    ];
  }, [onQueueAgents]);

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      // Analyze the On Queue agents specifically for efficiency
      const result = await analyzeIdleData(onQueueAgents);
      setAiAnalysis(result);
      setActiveTab('reports');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasCredentials = activeProfile?.clientId?.trim() && activeProfile?.clientSecret?.trim();

  // Helper for unique presence types
  const uniquePresences = useMemo(() => {
    const set = new Set(agents.map(a => a.presence));
    return Array.from(set).sort();
  }, [agents]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col hidden md:flex shrink-0">
        <div className="p-6 flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#ff4f1f] rounded flex items-center justify-center">
            <i className="fas fa-chart-line text-white"></i>
          </div>
          <span className="font-bold text-white text-lg tracking-tight">ICE Idle</span>
        </div>

        {/* Active Org Selector - Now interactive */}
        <div className="px-6 py-2 mb-4">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Active Org</label>
          <div className="relative group">
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full bg-slate-800 text-white text-xs font-bold rounded-lg p-3 border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer pr-8 hover:bg-slate-750 transition-colors"
            >
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-slate-300">
              <i className="fas fa-chevron-down text-[10px]"></i>
            </div>
            {activeProfile && (
              <div className="text-[10px] text-indigo-400 mt-1.5 px-1 truncate opacity-70">
                Region: {activeProfile.region}
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}
          >
            <i className="fas fa-th-large mr-3 text-indigo-400"></i> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('agents')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'agents' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}
          >
            <i className="fas fa-users mr-3 text-emerald-400"></i> Agents
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-slate-800 text-white' : 'hover:bg-slate-800'}`}
          >
            <i className="fas fa-file-alt mr-3 text-amber-400"></i> AI Reports
          </button>
          
          <div className="pt-4 mt-4 border-t border-slate-800">
            <button 
              onClick={() => setActiveTab('admin')}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'admin' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <i className="fas fa-cogs mr-3"></i> Administration
            </button>
          </div>
        </nav>

        <div className="p-4 bg-slate-800/50 mt-auto">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-500 animate-ping' : (hasCredentials ? 'bg-emerald-500' : 'bg-rose-500')}`}></div>
            <span className="text-xs font-semibold text-slate-400">
              {isSyncing ? 'Syncing...' : (hasCredentials ? 'Connected' : 'Missing Config')}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">v1.3.0-enterprise</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'Operations Overview'}
              {activeTab === 'agents' && 'Real-time Agent Status'}
              {activeTab === 'reports' && 'Intelligent Insights'}
              {activeTab === 'admin' && 'Admin Settings'}
            </h1>
            {activeTab !== 'admin' && activeProfile && (
              <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-100 uppercase tracking-wide">
                {activeProfile.name}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {activeTab !== 'admin' && (
              <button 
                onClick={handleSyncData}
                disabled={isSyncing}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center disabled:opacity-50 shadow-sm"
              >
                {isSyncing ? (
                  <><i className="fas fa-sync fa-spin mr-2"></i> Fetching...</>
                ) : (
                  <><i className="fas fa-cloud-download-alt mr-2"></i> Sync Genesys</>
                )}
              </button>
            )}
            
            <button 
              onClick={handleRunAIAnalysis}
              disabled={isAnalyzing || onQueueAgents.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center disabled:opacity-50 shadow-sm"
            >
              {isAnalyzing ? (
                <><i className="fas fa-circle-notch fa-spin mr-2"></i> Analyzing...</>
              ) : (
                <><i className="fas fa-robot mr-2"></i> Run AI Audit</>
              )}
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1 rounded-lg transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">JD</div>
              <i className="fas fa-chevron-down text-xs text-slate-400"></i>
            </div>
          </div>
        </header>

        {syncError && (
          <div className="bg-rose-50 border-b border-rose-200 px-8 py-2 flex items-center justify-between">
            <span className="text-rose-700 text-xs font-semibold">
              <i className="fas fa-exclamation-triangle mr-2"></i> {syncError}
            </span>
            <div className="flex items-center space-x-4">
              {syncError.includes("Missing Credentials") && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className="text-xs font-bold text-rose-600 underline hover:text-rose-800"
                >
                  Configure Now
                </button>
              )}
              <button onClick={() => setSyncError(null)} className="text-rose-400 hover:text-rose-600">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#f8fafc]">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              {agents.length === 0 && !isSyncing ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <i className="fas fa-cloud-upload-alt text-2xl text-slate-300"></i>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">No Data Synchronized</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2 mb-6">Connect to Genesys Cloud to start reporting on real-time agent idle status.</p>
                  <button onClick={handleSyncData} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700 transition-all">
                    Sync Now
                  </button>
                </div>
              ) : (
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Agents On Queue" value={stats.total} icon="fa-users" color="bg-slate-700" />
                    <StatCard label="Idle On Queue" value={stats.idle} icon="fa-clock" color="bg-indigo-600" />
                    <StatCard label="Avg Idle Time" value={`${stats.avgIdle}m`} icon="fa-hourglass-half" color="bg-emerald-600" />
                    <StatCard label="Max Idle Peak" value={`${stats.maxIdle}m`} icon="fa-bolt" color="bg-rose-500" />
                  </div>

                  {/* Charts Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800">On Queue Idle Trend</h3>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {syncHistory.length > 0 ? 'Live Tracking' : 'Awaiting First Sync'}
                        </div>
                      </div>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={syncHistory}>
                            <defs>
                              <linearGradient id="colorIdle" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Area type="monotone" dataKey="idleCount" name="Idle (On Queue)" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorIdle)" />
                            <Area type="monotone" dataKey="activeCount" name="Active (On Queue)" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                      <h3 className="font-bold text-slate-800 mb-6">On Queue Status Composition</h3>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statusDistribution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                            <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={45}>
                              {statusDistribution.map((entry, index) => (
                                <rect key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-800">Current On Queue Roster ({onQueueAgents.length})</h3>
                      <button onClick={() => setActiveTab('agents')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">View Full Floor</button>
                    </div>
                    <AgentTable agents={onQueueAgents} />
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6 animate-fadeIn">
               {agents.length === 0 ? (
                 <div className="text-center py-20 text-slate-400">Sync data to view agent roster.</div>
               ) : (
                 <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
                      <div className="relative flex-1">
                        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                        <input 
                          type="text" 
                          placeholder="Search agents by name..." 
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Status:</label>
                        <select 
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value)}
                        >
                          <option value="All">All Statuses</option>
                          <option value="IDLE">IDLE</option>
                          <option value="COMMUNICATING">COMMUNICATING</option>
                          <option value="INTERACTING">INTERACTING</option>
                          <option value="OFF_LINE">OFF_LINE</option>
                          <option value="NOT_RESPONDING">NOT_RESPONDING</option>
                        </select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Presence:</label>
                        <select 
                          className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          value={presenceFilter}
                          onChange={(e) => setPresenceFilter(e.target.value)}
                        >
                          <option value="All">All Presences</option>
                          {uniquePresences.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {(searchTerm || statusFilter !== 'All' || presenceFilter !== 'All') && (
                        <button 
                          onClick={() => {
                            setSearchTerm('');
                            setStatusFilter('All');
                            setPresenceFilter('All');
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800">
                        {searchTerm || statusFilter !== 'All' || presenceFilter !== 'All' 
                          ? `Found ${filteredAgentsList.length} results` 
                          : `Full Roster (${agents.length} Agents)`}
                      </h3>
                      <span className="text-xs text-slate-500 italic">Live floor data</span>
                    </div>
                    
                    {filteredAgentsList.length > 0 ? (
                      <AgentTable agents={filteredAgentsList} />
                    ) : (
                      <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                         <i className="fas fa-search text-slate-300 text-3xl mb-4"></i>
                         <p className="text-slate-500">No agents match your current filters.</p>
                      </div>
                    )}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="animate-fadeIn space-y-8 max-w-4xl mx-auto">
              {!aiAnalysis && !isAnalyzing && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-robot text-3xl text-indigo-600"></i>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Generate AI Efficiency Audit</h2>
                  <p className="text-slate-500 mb-8 max-w-md mx-auto">Gemini 3 Flash will analyze your real-time routing data from {activeProfile?.name || 'Customer'} to find hidden bottlenecks.</p>
                  <button 
                    onClick={handleRunAIAnalysis} 
                    disabled={onQueueAgents.length === 0}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    Start Analysis
                  </button>
                </div>
              )}
              {isAnalyzing && (
                <div className="text-center py-20">
                  <div className="relative w-24 h-24 mx-auto mb-8">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><i className="fas fa-brain text-indigo-600 text-2xl"></i></div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Processing Agent Intelligence</h3>
                  <p className="text-slate-500 animate-pulse">Scanning routing statuses for {activeProfile?.name}...</p>
                </div>
              )}
              {aiAnalysis && (
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                  <div className="bg-slate-900 p-8 text-white">
                    <div className="flex items-center space-x-3 mb-4">
                      <i className="fas fa-sparkles text-amber-400"></i>
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">AI Audit: {activeProfile?.name}</span>
                    </div>
                    <h2 className="text-3xl font-bold mb-4">Efficiency & Idle Analysis</h2>
                    <p className="text-slate-300 leading-relaxed text-lg">{aiAnalysis.summary}</p>
                  </div>
                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                      <h4 className="flex items-center text-emerald-700 font-bold mb-6 text-lg"><i className="fas fa-check-circle mr-3"></i> Recommended Actions</h4>
                      <ul className="space-y-4">
                        {aiAnalysis.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                            <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold mr-4 shrink-0 mt-0.5">{i+1}</span>
                            <span className="text-slate-700 font-medium">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="flex items-center text-rose-700 font-bold mb-6 text-lg"><i className="fas fa-exclamation-triangle mr-3"></i> Identified Bottlenecks</h4>
                      <ul className="space-y-4">
                        {aiAnalysis.bottlenecks.map((bot, i) => (
                          <li key={i} className="flex items-start bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                            <i className="fas fa-circle text-[8px] text-rose-500 mr-4 mt-2"></i>
                            <span className="text-slate-700 font-medium">{bot}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-400 italic">Generated by Gemini 3 Flash • {new Date().toLocaleTimeString()}</span>
                    <button onClick={() => setAiAnalysis(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-700">Clear Report</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'admin' && (
            <AdminPanel 
              profiles={profiles} 
              activeProfileId={activeProfileId}
              onSaveProfile={handleSaveProfile}
              onDeleteProfile={handleDeleteProfile}
              onSelectProfile={setActiveProfileId}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
