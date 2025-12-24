
import React, { useState } from 'react';
import { CustomerProfile } from '../types';

interface AdminPanelProps {
  profiles: CustomerProfile[];
  activeProfileId: string;
  onSaveProfile: (profile: CustomerProfile) => void;
  onDeleteProfile: (id: string) => void;
  onSelectProfile: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  profiles, 
  activeProfileId, 
  onSaveProfile, 
  onDeleteProfile, 
  onSelectProfile 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomerProfile | null>(null);

  const handleEdit = (profile: CustomerProfile) => {
    setEditingId(profile.id);
    setFormData({ ...profile });
  };

  const handleAddNew = () => {
    const newId = `cust-${Date.now()}`;
    setEditingId(newId);
    setFormData({
      id: newId,
      name: 'New Customer',
      region: 'ap_southeast_2',
      apiHost: 'https://api.mypurecloud.com.au',
      clientId: '',
      clientSecret: '',
      loginHost: 'https://login.mypurecloud.com.au',
      corsProxy: 'https://corsproxy.io/?' // Default helper
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!formData) return;
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      onSaveProfile(formData);
      setEditingId(null);
      setFormData(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex space-x-8 animate-fadeIn">
      {/* Profile List */}
      <div className="w-1/3 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-slate-800">Customers</h2>
          <button 
            onClick={handleAddNew}
            className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm flex items-center"
          >
            <i className="fas fa-plus-circle mr-1"></i> Add New
          </button>
        </div>
        
        <div className="space-y-2">
          {profiles.map(p => (
            <div 
              key={p.id}
              className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                activeProfileId === p.id 
                ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' 
                : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
              onClick={() => onSelectProfile(p.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-bold ${activeProfileId === p.id ? 'text-indigo-900' : 'text-slate-800'}`}>
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{p.region}</p>
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEdit(p); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDeleteProfile(p.id); }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
              {activeProfileId === p.id && (
                <div className="mt-3 flex items-center text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 animate-pulse"></div>
                  Active Connection
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Panel */}
      <div className="flex-1">
        {editingId && formData ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Edit Customer Profile</h3>
              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">Customer Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">Region</label>
                  <input
                    type="text"
                    name="region"
                    value={formData.region}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">API Host</label>
                  <input
                    type="text"
                    name="apiHost"
                    value={formData.apiHost}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">CORS Proxy URL (Required for Browser Access)</label>
                <input
                  type="text"
                  name="corsProxy"
                  value={formData.corsProxy || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. https://corsproxy.io/?"
                />
                <p className="text-[10px] text-slate-400">Example: Use <code>https://corsproxy.io/?</code> or your own proxy to bypass browser CORS on OAuth requests.</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">OAuth Client ID</label>
                  <input
                    type="text"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg font-mono text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 block">OAuth Client Secret</label>
                  <input
                    type="password"
                    name="clientSecret"
                    value={formData.clientSecret}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingId(null)}
                  className="px-6 py-2 text-slate-600 font-semibold text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-md transition-all"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="h-full bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <i className="fas fa-network-wired text-5xl mb-4"></i>
            <h3 className="text-lg font-bold text-slate-600">Select a Customer Profile</h3>
            <p className="max-w-xs mt-2 text-sm">To fix "Failed to fetch" errors, ensure you have a valid **CORS Proxy** configured for your profile.</p>
          </div>
        )}
      </div>
    </div>
  );
};
