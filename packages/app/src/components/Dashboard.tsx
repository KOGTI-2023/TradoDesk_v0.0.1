import React from 'react';
import { useAppStore } from '../store/appStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { usageStats } = useAppStore();

  const totalTokens = usageStats.reduce((acc, curr) => acc + curr.totalTokens, 0);
  const totalCost = usageStats.reduce((acc, curr) => acc + curr.cost, 0);

  // Prepare chart data (last 20 calls)
  const chartData = usageStats.slice(-20).map(u => ({
    name: new Date(u.timestamp).toLocaleTimeString(),
    tokens: u.totalTokens,
    cost: u.cost
  }));

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-white">Nutzungsstatistik & Kosten</h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-slate-400 text-sm">Gesamttokens (Session)</div>
            <div className="text-2xl font-mono text-emerald-400">{totalTokens.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="text-slate-400 text-sm">Geschätzte Kosten</div>
            <div className="text-2xl font-mono text-purple-400">€{totalCost.toFixed(6)}</div>
        </div>
      </div>

      <div className="h-64 bg-slate-800 p-4 rounded-lg mb-8 border border-slate-700">
        <h3 className="text-sm text-slate-400 mb-4">Token Verlauf (Letzte 20 Calls)</h3>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                    itemStyle={{ color: '#cbd5e1' }}
                />
                <Bar dataKey="tokens" fill="#6366f1" />
            </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="text-lg font-bold mb-4 text-white">Letzte Anfragen</h3>
      <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
        <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900">
                <tr>
                    <th className="px-4 py-3">Zeit</th>
                    <th className="px-4 py-3">Modell</th>
                    <th className="px-4 py-3">Tokens</th>
                    <th className="px-4 py-3">Latenz</th>
                </tr>
            </thead>
            <tbody>
                {usageStats.slice().reverse().slice(0, 10).map((record) => (
                    <tr key={record.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                        <td className="px-4 py-2">{new Date(record.timestamp).toLocaleTimeString()}</td>
                        <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] ${record.lane === 'deep' ? 'bg-purple-900 text-purple-200' : 'bg-emerald-900 text-emerald-200'}`}>
                                {record.lane.toUpperCase()}
                            </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{record.totalTokens}</td>
                        <td className="px-4 py-2">{record.latencyMs}ms</td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
};
