
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  variant?: 'default' | 'subtle' | 'warning'; // Możliwość rozszerzania stylów
}

export const NavButton: React.FC<Props> = ({ icon: Icon, label, count, isActive, onClick, variant = 'default' }) => {
  
  // Base classes for a more premium look
  const baseClass = "w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[13px] transition-all mb-1.5 group font-bold tracking-tight relative overflow-hidden";
  
  // Neon-Glass logic: subtle background, strong accent on active
  const activeClass = "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10";
  const inactiveClass = "text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent";
  
  // Badge styling
  const badgeClass = "text-[10px] font-black px-2 py-0.5 rounded-lg min-w-[20px] text-center transition-all duration-300";
  const badgeActive = "bg-white/20 text-white";
  const badgeInactive = "bg-zinc-800 text-zinc-500 group-hover:bg-zinc-700 group-hover:text-zinc-300";

  if (variant === 'warning') {
      return (
        <button 
            onClick={onClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all text-amber-500 hover:bg-amber-500/10 hover:text-amber-400 border border-transparent hover:border-amber-500/20"
        >
            <Icon size={14} strokeWidth={2.5} /> {label}
        </button>
      );
  }

  return (
    <button 
      onClick={onClick}
      className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
    >
      {/* Active Glow Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full blur-[2px]" />
      )}
      
      <Icon 
        size={18} 
        strokeWidth={isActive ? 2 : 1.5} 
        className={`transition-all duration-300 ${isActive ? 'text-white scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'text-zinc-500 group-hover:text-zinc-300'}`} 
      />
      
      <span className="flex-1 text-left">{label}</span>
      
      {count !== undefined && count > 0 && (
          <span className={`${badgeClass} ${isActive ? badgeActive : badgeInactive}`}>
              {count}
          </span>
      )}
    </button>
  );
};
