
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
  
  // Style bazowe
  const baseClass = "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all mb-1 group font-medium";
  
  // Style aktywne vs nieaktywne
  const activeClass = "bg-zinc-900 text-white shadow-md shadow-black/20";
  const inactiveClass = "hover:bg-zinc-900/50 text-zinc-400 hover:text-zinc-200";
  
  // Style licznika (badge)
  const badgeActiveClass = "bg-zinc-800 text-zinc-300";
  const badgeInactiveClass = "bg-zinc-900 text-zinc-600 group-hover:text-zinc-400";

  // Obsługa wariantu 'warning' (np. dla Vision Labs)
  if (variant === 'warning') {
      return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-amber-500 hover:bg-amber-900/20 hover:text-amber-300 border border-transparent hover:border-amber-900/30 ${isActive ? 'bg-amber-900/20 text-amber-300' : ''}`}
        >
            <Icon size={14} /> {label}
        </button>
      );
  }

  return (
    <button 
      onClick={onClick}
      className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
    >
      <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && count > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md min-w-[20px] text-center ${isActive ? badgeActiveClass : badgeInactiveClass}`}>
              {count}
          </span>
      )}
    </button>
  );
};
