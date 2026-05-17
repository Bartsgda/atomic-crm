
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { SelectOption } from '../types/module_types';
import { STANDARD_INPUT_CLASS } from '../modules/utils/window_utils';

interface Props {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    label?: string;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

export const SearchableSelect: React.FC<Props> = ({ value, onChange, options = [], label, placeholder = "Wybierz...", className = "", required }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedOption = options.find(o => o.value === value);

    // --- SMART POSITIONING (With Dynamic Height) ---
    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const spaceBelow = viewportHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            const PREFERRED_HEIGHT = 250; 
            const MARGIN = 10;

            let style: React.CSSProperties = {
                position: 'fixed',
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            };

            // Logic: If less space below than preferred AND more space above -> Flip Up
            if (spaceBelow < PREFERRED_HEIGHT && spaceAbove > spaceBelow) {
                const availableHeight = Math.min(PREFERRED_HEIGHT, spaceAbove - MARGIN);
                style.bottom = viewportHeight - rect.top + 4;
                style.maxHeight = `${availableHeight}px`;
            } else {
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
            const handleScroll = () => setIsOpen(false);
            const handleResize = () => updatePosition();
            
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleResize);
            
            // Focus search
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus();
            }, 50);

            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleResize);
            };
        } else {
            setSearchTerm(''); // Reset search on close
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                 const target = e.target as HTMLElement;
                 // Don't close if clicked inside the dropdown itself
                 if (!target.closest('[data-searchable-dropdown]')) {
                    setIsOpen(false);
                 }
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleGlobalClick);
        }
        return () => document.removeEventListener('mousedown', handleGlobalClick);
    }, [isOpen]);

    // Normalize helper
    const normalize = (str: string) => {
        if (!str) return '';
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "");
    };

    const filteredOptions = options.filter(opt => {
        if (!searchTerm) return true;
        const search = normalize(searchTerm);
        return normalize(opt.label).includes(search) || normalize(opt.group || '').includes(search) || normalize(opt.value).includes(search);
    });

    const groupedOptions = filteredOptions.reduce((acc, opt) => {
        const group = opt.group || 'Pozostałe';
        if (!acc[group]) acc[group] = [];
        acc[group].push(opt);
        return acc;
    }, {} as Record<string, SelectOption[]>);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            {label && (
                <label className="text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400 pl-1 mb-1 block">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Trigger */}
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={`${STANDARD_INPUT_CLASS} flex items-center justify-between cursor-pointer ${isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : ''}`}
            >
                <span className={`text-sm font-bold truncate ${selectedOption ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <div className="flex items-center gap-1">
                    {value && (
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(''); }}
                            className="p-1 text-zinc-400 hover:text-red-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        >
                            <X size={14} />
                        </button>
                    )}
                    <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Smart Dropdown */}
            {isOpen && (
                <div 
                    style={menuStyle}
                    data-searchable-dropdown="true"
                    className="fixed bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col"
                >
                    {/* Fixed Header (Search) */}
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input 
                                ref={inputRef}
                                type="text"
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold outline-none focus:border-blue-500 text-zinc-900 dark:text-white"
                                placeholder="Szukaj..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="overflow-y-auto flex-1 p-1 scrollbar-hide overscroll-contain">
                        {Object.keys(groupedOptions).length === 0 ? (
                            <div className="p-4 text-center text-zinc-400 text-xs font-bold">Brak wyników</div>
                        ) : (
                            (Object.entries(groupedOptions) as [string, SelectOption[]][]).map(([group, opts]) => (
                                <div key={group}>
                                    {group !== 'Pozostałe' && (
                                        <div className="px-3 py-1.5 text-[9px] font-black uppercase text-zinc-400 bg-zinc-50/50 dark:bg-zinc-900/50 mt-1 first:mt-0 tracking-widest sticky top-0 backdrop-blur-sm z-10">
                                            {group}
                                        </div>
                                    )}
                                    {opts.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors flex-shrink-0 ${
                                                value === opt.value 
                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                                            }`}
                                        >
                                            <span className="text-xs font-bold truncate">{opt.label}</span>
                                            {value === opt.value && <Check size={14} className="flex-shrink-0"/>}
                                        </button>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
