
import React from 'react';
import { Palette, Sun, Moon, Monitor, ZoomIn, ZoomOut, Type, Briefcase, Zap, Leaf, LayoutTemplate } from 'lucide-react';
import { UiPreferences } from '../types';

interface Props {
    prefs: UiPreferences;
    onUpdate: (newPrefs: UiPreferences) => void;
}

const COLORS = [
    { label: 'Czerwony (Standard)', val: '#dc2626' }, // red-600
    { label: 'Niebieski (Korpo)', val: '#2563eb' },   // blue-600
    { label: 'Szmaragdowy (Eco)', val: '#059669' },   // emerald-600
    { label: 'Fioletowy (Premium)', val: '#7c3aed' }, // violet-600
    { label: 'Bursztynowy (Warm)', val: '#d97706' },  // amber-600
    { label: 'Pomarańczowy (Midnight)', val: '#fb923c' }, // orange-400
    { label: 'Onyx (Minimal)', val: '#18181b' },      // zinc-900
];

export const ThemeSettings: React.FC<Props> = ({ prefs, onUpdate }) => {
    
    const handleColorChange = (color: string) => {
        onUpdate({ ...prefs, primaryColor: color });
        // Set CSS variable for immediate effect
        document.documentElement.style.setProperty('--primary-color', color);
    };

    const handleScaleChange = (scale: number) => {
        onUpdate({ ...prefs, fontScale: scale });
        document.documentElement.style.fontSize = `${16 * scale}px`;
    };

    const applySkin = (skin: 'default' | 'warm' | 'midnight') => {
        let newPrefs = { ...prefs, skin };
        
        if (skin === 'warm') {
            newPrefs = { ...newPrefs, theme: 'light', primaryColor: '#d97706' };
        } else if (skin === 'midnight') {
            newPrefs = { ...newPrefs, theme: 'dark', primaryColor: '#fb923c' };
        } else if (skin === 'default') {
            newPrefs = { ...newPrefs, theme: 'dark', primaryColor: '#dc2626' };
        }

        onUpdate(newPrefs);
        document.documentElement.style.setProperty('--primary-color', newPrefs.primaryColor);
        document.documentElement.setAttribute('data-v1-skin', skin);
    };

    const applyPreset = (type: 'EXEC' | 'ONYX' | 'FOREST') => {
        let newPrefs = { ...prefs };
        
        if (type === 'EXEC') {
            newPrefs = { ...prefs, theme: 'light', primaryColor: '#2563eb', density: 'comfortable', fontScale: 1.0 };
        } else if (type === 'ONYX') {
            newPrefs = { ...prefs, theme: 'dark', primaryColor: '#ef4444', density: 'compact', fontScale: 0.95 };
        } else if (type === 'FOREST') {
            newPrefs = { ...prefs, theme: 'light', primaryColor: '#059669', density: 'comfortable', fontScale: 1.05 };
        }

        onUpdate(newPrefs);
        document.documentElement.style.setProperty('--primary-color', newPrefs.primaryColor);
        document.documentElement.style.fontSize = `${16 * newPrefs.fontScale}px`;
    };

    return (
        <div className="px-3 py-4 border-t border-zinc-900 mt-2 bg-zinc-950/40 rounded-xl space-y-6 animate-in slide-in-from-left-4 duration-300">
            
            {/* SKINS SECTION */}
            <div>
                <p className="text-[9px] uppercase font-black text-zinc-500 mb-3 tracking-wider flex items-center gap-2 px-1">
                    <Zap size={10} className="text-yellow-500" /> Skórki Główne (Skins)
                </p>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => applySkin('default')}
                        className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === 'default' ? 'border-red-600 bg-red-950/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                    >
                         <div className="w-8 h-8 rounded-lg bg-zinc-800 border-2 border-red-600 flex items-center justify-center shadow-sm overflow-hidden">
                            <div className="w-full h-full bg-zinc-900 relative">
                                <div className="absolute top-0 left-0 w-2 h-full bg-zinc-800 border-r border-red-600/30"></div>
                            </div>
                        </div>
                        <span className="text-[9px] font-black uppercase text-zinc-400">Zinc</span>
                    </button>

                    <button 
                        onClick={() => applySkin('warm')}
                        className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === 'warm' ? 'border-amber-600 bg-amber-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                    >
                         <div className="w-8 h-8 rounded-lg bg-[#FDFAF6] border border-amber-200 flex items-center justify-center shadow-sm overflow-hidden">
                            <div className="w-full h-full relative">
                                <div className="absolute top-0 left-0 w-2 h-full bg-[#F5EDD9]"></div>
                            </div>
                        </div>
                        <span className="text-[9px] font-black uppercase text-zinc-400">Warm</span>
                    </button>

                    <button 
                        onClick={() => applySkin('midnight')}
                        className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === 'midnight' ? 'border-orange-500 bg-orange-500/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                    >
                         <div className="w-8 h-8 rounded-lg bg-[#1C1917] border border-orange-900 flex items-center justify-center shadow-sm overflow-hidden">
                            <div className="w-full h-full relative">
                                <div className="absolute top-0 left-0 w-2 h-full bg-[#292524]"></div>
                            </div>
                        </div>
                        <span className="text-[9px] font-black uppercase text-zinc-400">Night</span>
                    </button>
                </div>
            </div>

            <div className="h-px bg-zinc-900 w-full"></div>

            {/* PRESETS SECTION */}
            <div>
                <p className="text-[9px] uppercase font-black text-zinc-500 mb-3 tracking-wider flex items-center gap-2 px-1">
                    <LayoutTemplate size={10} /> Presety Funkcyjne
                </p>
                <div className="grid grid-cols-3 gap-2">
                    <button 
                        onClick={() => applyPreset('EXEC')}
                        className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-white hover:border-blue-500 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                            <Briefcase size={14} />
                        </div>
                        <span className="text-[9px] font-black uppercase text-zinc-900">Exec</span>
                    </button>

                    <button 
                        onClick={() => applyPreset('ONYX')}
                        className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-red-500 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 text-red-500 border border-zinc-700 flex items-center justify-center shadow-sm">
                            <Zap size={14} />
                        </div>
                        <span className="text-[9px] font-black uppercase text-zinc-400 group-hover:text-white">Onyx</span>
                    </button>

                    <button 
                        onClick={() => applyPreset('FOREST')}
                        className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-emerald-50 hover:border-emerald-500 transition-all group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                            <Leaf size={14} />
                        </div>
                        <span className="text-[9px] font-black uppercase text-emerald-900">Eco</span>
                    </button>
                </div>
            </div>

            <div className="h-px bg-zinc-900 w-full"></div>

            <p className="text-[9px] uppercase font-black text-zinc-500 mb-2 tracking-wider flex items-center gap-2 px-1">
                <Palette size={10} /> Manualna Korekta
            </p>

            {/* Tryb Jasny / Ciemny */}
            <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <button 
                    onClick={() => onUpdate({ ...prefs, theme: 'light' })} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${prefs.theme === 'light' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Sun size={12} /> Jasny
                </button>
                <button 
                    onClick={() => onUpdate({ ...prefs, theme: 'dark' })} 
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${prefs.theme === 'dark' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Moon size={12} /> Ciemny
                </button>
            </div>

            {/* Kolor Wiodący */}
            <div>
                <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1">KOLOR WIODĄCY</p>
                <div className="grid grid-cols-6 gap-2">
                    {COLORS.map(c => (
                        <button 
                            key={c.val} 
                            onClick={() => handleColorChange(c.val)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${prefs.primaryColor === c.val ? 'border-white scale-110 shadow-md' : 'border-transparent opacity-50 hover:opacity-100'}`}
                            style={{ backgroundColor: c.val }}
                            title={c.label}
                        />
                    ))}
                </div>
            </div>

            {/* Skalowanie Czcionki */}
            <div>
                <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1 flex items-center gap-2">
                    <Type size={10} /> SKALA INTERFEJSU: {Math.round(prefs.fontScale * 100)}%
                </p>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleScaleChange(0.85)} className="p-1 text-zinc-500 hover:text-white"><ZoomOut size={14}/></button>
                    <input 
                        type="range" 
                        min="0.85" 
                        max="1.15" 
                        step="0.05" 
                        value={prefs.fontScale}
                        onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                        className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                    />
                    <button onClick={() => handleScaleChange(1.15)} className="p-1 text-zinc-500 hover:text-white"><ZoomIn size={14}/></button>
                </div>
            </div>
        </div>
    );
};
