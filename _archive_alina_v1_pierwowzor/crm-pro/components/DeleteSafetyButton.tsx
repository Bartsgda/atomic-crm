
import React, { useState, useRef, useEffect } from 'react';
import { Trash2, AlertTriangle, Lock, Unlock } from 'lucide-react';

interface Props {
  onConfirm: () => void;
  label?: string;
  iconSize?: number;
  className?: string;
  popoverPlacement?: 'left' | 'right' | 'top';
}

export const DeleteSafetyButton: React.FC<Props> = ({ onConfirm, label, iconSize = 16, className = "", popoverPlacement = 'left' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsConfirmed(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConfirmed) {
      onConfirm();
      setIsOpen(false);
      setIsConfirmed(false);
    }
  };

  // Compact positioning
  const placementClasses = {
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2'
  };

  return (
    <div className="relative inline-block">
      <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`p-1.5 transition-all rounded-lg ${isOpen ? 'bg-red-600 text-white shadow-sm' : 'text-zinc-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'} ${className}`}
        title={label || "Usuń element"}
      >
        <Trash2 size={iconSize} />
      </button>

      {isOpen && (
        <div 
          ref={popoverRef}
          onClick={e => e.stopPropagation()}
          className={`absolute z-[300] w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl p-3 animate-in zoom-in-95 duration-150 ${placementClasses[popoverPlacement]}`}
        >
          {/* Mini Header */}
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-zinc-50 dark:border-zinc-800">
             <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Potwierdź</span>
             <AlertTriangle size={12} className="text-red-500" />
          </div>

          <div className="flex items-center gap-2">
             {/* Mini Switch */}
             <button 
                type="button"
                onClick={() => setIsConfirmed(!isConfirmed)}
                className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${isConfirmed ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
             >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all flex items-center justify-center ${isConfirmed ? 'left-5' : 'left-1'}`}>
                    {isConfirmed ? <Unlock size={10} className="text-emerald-500"/> : <Lock size={10} className="text-zinc-400"/>}
                </div>
             </button>

             {/* Action Button */}
             <button 
                disabled={!isConfirmed}
                onClick={handleConfirm}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${isConfirmed ? 'bg-red-600 text-white shadow-md hover:bg-red-700' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-300 cursor-not-allowed'}`}
             >
                <Trash2 size={12} /> Usuń
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
