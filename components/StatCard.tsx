
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, trend }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-start space-x-4 transition-all hover:shadow-md">
      <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center text-white text-xl shadow-inner`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
        {trend && (
          <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center">
            <i className="fas fa-arrow-up mr-1"></i> {trend}
          </p>
        )}
      </div>
    </div>
  );
};
