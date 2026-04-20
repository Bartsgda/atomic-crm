import React from 'react';
import * as Icons from 'lucide-react';

const ICON_LIST = [
  { name: 'Home', icon: Icons.Home, color: 'text-indigo-500' },
  { name: 'Users', icon: Icons.Users, color: 'text-blue-500' },
  { name: 'Heart', icon: Icons.Heart, color: 'text-emerald-500' },
  { name: 'Car', icon: Icons.Car, color: 'text-sky-500' },
  { name: 'Zap', icon: Icons.Zap, color: 'text-amber-500' },
  { name: 'Shield', icon: Icons.Shield, color: 'text-rose-500' },
];

export const IconPlayground: React.FC = () => {
  return (
    <div className="p-10 bg-zinc-950 min-h-screen text-white">
      <h2 className="text-2xl font-black mb-8 uppercase tracking-widest text-zinc-500">Proposal Layout: Neon-Glass Icons</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {ICON_LIST.map(({ name, icon: Icon, color }) => (
          <div key={name} className="group relative p-6 rounded-3xl bg-zinc-900/50 border border-zinc-800 hover:border-white/20 transition-all hover:scale-105 cursor-pointer overflow-hidden">
            {/* Glow Effect */}
            <div className={`absolute -inset-px opacity-0 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity blur-2xl ${color.replace('text-', 'bg-')}`} />
            
            <div className="relative flex flex-col items-center gap-4">
              <div className={`p-4 rounded-2xl bg-white/5 border border-white/10 shadow-xl group-hover:shadow-2xl transition-all ${color}`}>
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{name}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl max-w-2xl">
        <h3 className="text-lg font-bold mb-4">Symmetric Quick Action Proposal</h3>
        <p className="text-sm text-zinc-400 mb-6">Pływający dock dla funkcji krytycznych (Sync, Wipe, Restore).</p>
        
        <div className="flex items-center gap-4 p-2 bg-black/40 rounded-2xl border border-white/5 w-fit">
           <button className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
             <Icons.Save size={20} />
           </button>
           <button className="p-3 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
             <Icons.CloudDownload size={20} />
           </button>
           <div className="w-px h-8 bg-white/10 mx-1" />
           <button className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
             <Icons.Trash2 size={20} />
           </button>
        </div>
      </div>
    </div>
  );
};
