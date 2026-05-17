
import React, { useState, useEffect, useRef } from 'react';
import { INSURERS } from '../towarzystwa';
import { ChevronDown, Search, Check, Building2 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  activeList?: string[]; 
  tabIndex?: number;
}

export const InsurerSelect: React.FC<Props> = ({ value, onChange, label, placeholder = "Wybierz z listy...", error, activeList, tabIndex = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- DATA PREPARATION ---
  const allInsurersMap = new Map(INSURERS.map(i => [i.name, i]));
  const sortedOptions = (activeList || []).map(name => {
      const found = allInsurersMap.get(name);
      return found || { id: name, name: name, currentLegalEntity: 'Wpis niestandardowy', address: '', zipCode: '', city: '', email: '', isBrandOnly: false };
  });
  const activeSet = new Set(activeList || []);
  const otherOptions = INSURERS.filter(i => !activeSet.has(i.name)).sort((a,b) => a.name.localeCompare(b.name));
  const displayOptions = [...sortedOptions, ...otherOptions];
  const selectedInsurer = displayOptions.find(i => i.name === value);

  // --- SMART POSITIONING LOGIC (SCROLL FIX) ---
  const updatePosition = () => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const spaceBelow = viewportHeight - rect.bottom;
          const spaceAbove = rect.top;
          
          const PREFERRED_HEIGHT = 300; // Bazowa wysokość
          const MARGIN = 10; // Margines od krawędzi ekranu

          let style: React.CSSProperties = {
              position: 'fixed',
              left: rect.left,
              width: rect.width,
              zIndex: 9999,
          };

          // Decyzja: Góra czy Dół?
          // Otwórz w górę tylko jeśli na dole jest za mało miejsca A na górze jest go więcej
          if (spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow) {
              // FLIP UP
              const availableHeight = Math.min(PREFERRED_HEIGHT, spaceAbove - MARGIN);
              style.bottom = viewportHeight - rect.top + 4; // +4px odstępu od inputa
              style.maxHeight = `${availableHeight}px`;
          } else {
              // OPEN DOWN (Default)
              const availableHeight = Math.min(PREFERRED_HEIGHT, spaceBelow - MARGIN);
              style.top = rect.bottom + 4;
              style.maxHeight = `${availableHeight}px`;
          }

          setMenuStyle(style);
      }
  };

  useEffect(() => {
    if (isOpen) {
        updatePosition();
        
        const handleScroll = () => {
            // Zamknij przy scrollowaniu, bo fixed element by "odpłynął" od inputa
            setIsOpen(false); 
        };
        const handleResize = () => updatePosition();

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        
        // Auto-focus search input
        setTimeout(() => {
            if (searchInputRef.current) searchInputRef.current.focus();
        }, 50);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }
  }, [isOpen]);

  // Click Outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            // Sprawdź czy kliknięto w dropdown (który jest w portalu/fixed divie)
            const target = e.target as HTMLElement;
            if (!target.closest('[data-insurer-dropdown]')) {
                setIsOpen(false);
            }
        }
    };

    if (isOpen) {
        document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [isOpen]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(!isOpen);
      }
      if (e.key === 'Escape') {
          setIsOpen(false);
      }
  };

  const filtered = displayOptions.filter(i => 
    i.name.toLowerCase().includes(search.toLowerCase()) || 
    i.currentLegalEntity.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative space-y-1" ref={containerRef}>
      {label && <label className="text-[10px] font-black uppercase text-zinc-500 pl-2 tracking-wide">{label}</label>}
      
      <div 
        tabIndex={tabIndex}
        onKeyDown={handleKeyDown}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full p-3 bg-white dark:bg-zinc-800 border-2 rounded-xl text-sm font-bold flex items-center justify-between cursor-pointer transition-all shadow-sm outline-none
          ${isOpen ? 'border-zinc-900 dark:border-zinc-500 ring-4 ring-zinc-100 dark:ring-zinc-700' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-red-500 focus:ring-4 focus:ring-red-50'}
          ${error ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${value ? 'bg-zinc-900 dark:bg-zinc-700 text-white' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400'}`}>
              <Building2 size={16} />
           </div>
           {value ? (
             <div className="flex flex-col truncate">
                <span className="text-zinc-900 dark:text-white leading-tight">{value}</span>
                {selectedInsurer && selectedInsurer.currentLegalEntity !== value && <span className="text-[9px] text-zinc-400 font-medium truncate">{selectedInsurer.currentLegalEntity}</span>}
             </div>
           ) : (
             <span className="text-zinc-400 font-medium">{placeholder}</span>
           )}
        </div>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div 
            style={menuStyle}
            data-insurer-dropdown="true"
            className="fixed bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
        >
           {/* SEARCH BAR (Fixed at top) */}
           <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Szukaj..." 
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none focus:border-zinc-400 dark:focus:border-zinc-500 text-zinc-700 dark:text-zinc-300"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter' && filtered.length > 0) {
                          onChange(filtered[0].name);
                          setIsOpen(false);
                          setSearch('');
                      }
                  }}
                />
              </div>
           </div>
           
           {/* SCROLLABLE LIST AREA */}
           <div className="overflow-y-auto scrollbar-hide p-1 flex-1 overscroll-contain">
              {filtered.map((insurer, idx) => {
                  const isTop = activeList && idx < activeList.length && !search; 
                  const showSeparator = activeList && idx === activeList.length && !search;

                  return (
                    <React.Fragment key={insurer.id}>
                        {showSeparator && (
                            <div className="flex items-center gap-2 px-2 py-1">
                                <div className="h-px bg-zinc-200 flex-1"></div>
                                <span className="text-[8px] font-black text-zinc-300 uppercase">Pozostałe</span>
                                <div className="h-px bg-zinc-200 flex-1"></div>
                            </div>
                        )}
                        <button
                          type="button"
                          tabIndex={0}
                          onClick={() => { onChange(insurer.name); setIsOpen(false); setSearch(''); }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between group transition-colors focus:bg-zinc-100 dark:focus:bg-zinc-700 outline-none flex-shrink-0
                            ${value === insurer.name ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'}
                            ${isTop && value !== insurer.name ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                          `}
                        >
                           <div className="min-w-0">
                              <p className={`text-xs font-black uppercase truncate ${value === insurer.name ? 'text-white dark:text-zinc-900' : 'text-zinc-800 dark:text-zinc-200'}`}>{insurer.name}</p>
                              <p className={`text-[9px] truncate max-w-[250px] ${value === insurer.name ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-400'}`}>{insurer.currentLegalEntity}</p>
                           </div>
                           {value === insurer.name && <Check size={14} className="text-white dark:text-zinc-900 flex-shrink-0" />}
                        </button>
                    </React.Fragment>
                  );
              })}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-zinc-400 text-[10px] font-bold uppercase">Brak wyników.</div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
