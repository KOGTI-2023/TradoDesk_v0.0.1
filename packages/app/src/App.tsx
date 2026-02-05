import React, { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { Dashboard } from './components/Dashboard';
import { LogPanel } from './components/LogPanel';
import { useAppStore } from './store/appStore';
import { Activity, LayoutDashboard, Settings, ShieldCheck, Zap } from 'lucide-react';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'settings'>('chat');
  const { config, usageStats, loadConfig } = useAppStore();

  useEffect(() => {
    loadConfig();
  }, []);

  // Compute session costs
  const sessionCost = usageStats.reduce((acc, curr) => acc + curr.cost, 0);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans overflow-hidden">
      {/* Sidebar / Broker Placeholder */}
      <div className="w-[50%] border-r border-slate-800 flex flex-col relative">
        <div className="h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 justify-between">
          <span className="font-bold text-emerald-400">Heldentrader (Demo)</span>
          <span className="text-xs text-slate-500">Broker View Active</span>
        </div>
        <div className="flex-1 bg-black/50 flex items-center justify-center">
            {/* The Electron BrowserView overlays this area */}
            <p className="text-slate-600">Broker Browser View Overlay Area</p>
        </div>
        <LogPanel />
      </div>

      {/* Right Panel: Chat & Agent */}
      <div className="w-[50%] flex flex-col bg-slate-900">
        {/* Top Bar */}
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900">
            <div className="flex space-x-4">
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`px-3 py-1 rounded-md text-sm flex items-center gap-2 ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
                >
                    <Zap size={16} /> Chat
                </button>
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3 py-1 rounded-md text-sm flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
                >
                    <LayoutDashboard size={16} /> Dashboard
                </button>
            </div>
            
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck size={14} />
                    {config.secureMode ? 'SECURE' : 'UNSAFE'}
                </div>
                <div className="bg-slate-800 px-2 py-1 rounded">
                    Session: €{sessionCost.toFixed(4)}
                </div>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
            {activeTab === 'chat' && <ChatInterface />}
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'settings' && <div className="p-4">Settings UI Placeholder</div>}
        </div>
      </div>
    </div>
  );
};

export default App;
