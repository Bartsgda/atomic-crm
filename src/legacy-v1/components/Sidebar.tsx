
import React, { useState, useEffect } from 'react';
import { Users, Search, GripVertical, Clock, RefreshCw } from 'lucide-react';
import { Client } from '../types';
import { BackupManager } from './BackupManager';
import { storage } from '../services/storage';

interface ClientCardProps {
  client: Client;
}

const ClientCard: React.FC<ClientCardProps> = ({ client }) => {
  return (
    <div className="p-3 mb-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm hover:border-zinc-600 transition-all cursor-pointer">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-black">
            {client.lastName[0]}{client.firstName[0]}
          </div>
          <div>
            <h4 className="text-sm font-bold text-zinc-100">{client.firstName} {client.lastName}</h4>
            <p className="text-[10px] text-zinc-500 font-mono">{client.pesel || 'Brak PESEL'}</p>
          </div>
        </div>
        <GripVertical className="h-4 w-4 text-zinc-800" />
      </div>
    </div>
  );
};

interface SidebarProps {
  clients: Client[];
  onImportComplete: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ clients, onImportComplete }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const filteredClients = clients.filter(c => 
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.pesel?.includes(searchTerm)
  );

  // --- SESSION TIMER LOGIC ---
  useEffect(() => {
      const checkTime = () => {
          const expiry = storage.getSessionExpiry();
          if (expiry) {
              const diff = expiry - Date.now();
              setTimeLeft(diff > 0 ? diff : 0);
          } else {
              setTimeLeft(null);
          }
      };
      
      checkTime();
      const interval = setInterval(checkTime, 30000); // Check every 30s
      return () => clearInterval(interval);
  }, [clients]); // Update when clients change (implies activity)

  const handleExtendSession = () => {
      storage.extendSession();
      const expiry = storage.getSessionExpiry();
      if (expiry) setTimeLeft(expiry - Date.now());
  };

  const formatTimeLeft = (ms: number) => {
      const mins = Math.ceil(ms / 60000);
      if (mins > 60) return '> 1h';
      return `${mins} min`;
  };

  return (
    <div className="w-80 bg-zinc-950 border-r border-zinc-900 h-full flex flex-col hidden md:flex text-zinc-400">
      <div className="p-6 border-b border-zinc-900 bg-zinc-950">
        <h2 className="text-lg font-black text-zinc-100 flex items-center mb-6">
          <Users className="h-5 w-5 mr-3 text-red-600" />
          Klienci
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-600" />
          <input 
            type="text"
            placeholder="Szukaj w bazie..."
            className="w-full pl-10 pr-3 py-3 text-sm border border-zinc-800 bg-zinc-900 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-zinc-100 placeholder-zinc-700 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
        {filteredClients.map(client => (
          <ClientCard key={client.id} client={client} />
        ))}
        {filteredClients.length === 0 && (
          <div className="text-center py-12 text-zinc-700 text-xs font-bold uppercase tracking-widest">
            Baza jest pusta
          </div>
        )}
      </div>

      <div className="bg-zinc-950 p-2 space-y-2">
        {timeLeft !== null && (
            <div className={`px-3 py-2 rounded-xl flex items-center justify-between border ${timeLeft < 300000 ? 'bg-red-900/20 border-red-900 text-red-500 animate-pulse' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                <div className="flex items-center gap-2">
                    <Clock size={12} />
                    <span className="text-[9px] font-black uppercase">Auto-Wipe: {formatTimeLeft(timeLeft)}</span>
                </div>
                <button 
                    onClick={handleExtendSession}
                    className="p-1 hover:text-white transition-colors"
                    title="Przedłuż sesję o 1h"
                >
                    <RefreshCw size={12} />
                </button>
            </div>
        )}
        <BackupManager onRefresh={onImportComplete} />
      </div>
    </div>
  );
};
