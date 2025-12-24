
import React from 'react';
import { Agent } from '../types';

interface AgentTableProps {
  agents: Agent[];
}

export const AgentTable: React.FC<AgentTableProps> = ({ agents }) => {
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'IDLE': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'COMMUNICATING': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'OFF_LINE': 'bg-slate-100 text-slate-700 border-slate-200',
      'INTERACTING': 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const getEfficiencyColor = (score: number) => {
    if (score > 85) return 'text-emerald-600';
    if (score > 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Agent</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Presence</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Routing Status</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Idle Time</th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {agents.map((agent) => (
            <tr key={agent.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                    {agent.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-slate-900">{agent.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {agent.presence}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(agent.routingStatus)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {agent.queue}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900">
                {agent.idleMinutes}m
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getEfficiencyColor(agent.efficiencyScore)}`}>
                {agent.efficiencyScore}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
