
import React, { useState } from 'react';
import { Lightbulb, ListChecks, Code, ShieldCheck, Paintbrush, Cpu, Briefcase, History, ArrowRight, Flame } from 'lucide-react';
import { REQUIREMENTS_LEDGER, VISION_MARKDOWN, PROJECT_HISTORY } from '../data/projectLedger';

export const VisionBoard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'VISION' | 'LEDGER' | 'HISTORY'>('VISION'); // Domyślnie otwieramy WIZJĘ (zgodnie z życzeniem)

    const getIcon = (cat: string) => {
        switch(cat) {
            case 'CORE': return <Cpu size={14} className="text-blue-500" />;
            case 'SECURITY': return <ShieldCheck size={14} className="text-red-500" />;
            case 'UI': return <Paintbrush size={14} className="text-purple-500" />;
            case 'AI': return <SparklesIcon />;
            case 'BUSINESS': return <Briefcase size={14} className="text-emerald-500" />;
            default: return <ListChecks size={14} />;
        }
    };

    const SparklesIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>
    );

    return (
        <div className="p-6 md:p-10 max-w-5xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter flex items-center gap-3">
                        <Lightbulb className="text-amber-500" size={36} /> Vision Labs
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                        Centrum Strategiczne Projektu
                    </p>
                </div>
                
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button 
                        onClick={() => setActiveTab('VISION')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'VISION' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                    >
                        Wizja (BartsGda)
                    </button>
                    <button 
                        onClick={() => setActiveTab('LEDGER')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'LEDGER' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                    >
                        <Code size={12} /> Wymagania (UI/UX)
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                    >
                        <History size={12} /> Dziennik Zmian
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[1.75rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col relative">
                
                {activeTab === 'VISION' && (
                    <div className="flex-1 overflow-y-auto p-8 md:p-12 scrollbar-hide">
                        <div className="prose prose-zinc dark:prose-invert max-w-none">
                            <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                                {VISION_MARKDOWN}
                            </div>
                        </div>
                        <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl">
                            <p className="text-xs font-black text-amber-700 dark:text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Cpu size={14} /> Status Implementacji
                            </p>
                            <p className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                                Obecna wersja (v4.3) realizuje fundamenty Local-First. Pełna wizja "Autonomicznego Systemu" wymaga zewnętrznego backendu Python (Phase 5).
                            </p>
                        </div>
                    </div>
                )}

                {activeTab === 'LEDGER' && (
                    <div className="flex-1 overflow-y-auto p-0">
                        <div className="grid grid-cols-1 divide-y divide-zinc-100 dark:divide-zinc-800">
                            {REQUIREMENTS_LEDGER.map((req) => (
                                <div key={req.id} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono text-[10px] text-zinc-300 font-bold">{req.id}</span>
                                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border bg-white dark:bg-zinc-800 flex items-center gap-1.5 ${
                                                req.category === 'SECURITY' ? 'border-red-200 text-red-600' :
                                                req.category === 'CORE' ? 'border-blue-200 text-blue-600' :
                                                req.category === 'UI' ? 'border-purple-200 text-purple-600' :
                                                'border-zinc-200 text-zinc-500'
                                            }`}>
                                                {getIcon(req.category)} {req.category}
                                            </span>
                                        </div>
                                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                                            req.status === 'DONE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                                            req.status === 'ACTIVE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                                            'bg-zinc-100 text-zinc-500'
                                        }`}>
                                            {req.status}
                                        </div>
                                    </div>
                                    <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-1">{req.title}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-3xl font-medium">{req.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="flex-1 overflow-y-auto p-0 bg-zinc-50 dark:bg-zinc-900/50">
                        <div className="max-w-3xl mx-auto p-8">
                            <div className="absolute left-[3.25rem] top-8 bottom-8 w-px bg-zinc-200 dark:bg-zinc-800"></div>
                            <div className="space-y-8">
                                {PROJECT_HISTORY.map((entry, idx) => {
                                    const isLatest = idx === 0;
                                    return (
                                        <div key={idx} className="relative flex gap-6 group">
                                            <div className="flex-shrink-0 w-24 text-right pt-2">
                                                <p className={`text-[10px] font-mono font-bold ${isLatest ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>{entry.date}</p>
                                                <p className="text-[9px] font-black text-zinc-300 dark:text-zinc-600">v{entry.version}</p>
                                            </div>
                                            <div className={`relative z-10 w-4 h-4 mt-2 rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center shadow-sm ${
                                                entry.action === 'MODIFIED' || entry.action === 'CRITICAL_FIX' ? 'bg-amber-500' : 
                                                entry.action === 'ADDED' ? 'bg-emerald-500' : 'bg-blue-500'
                                            }`}>
                                                {isLatest && <div className="absolute inset-0 rounded-full bg-inherit animate-ping opacity-75"></div>}
                                            </div>
                                            <div className={`flex-1 p-4 rounded-2xl border shadow-sm group-hover:shadow-md transition-all ${
                                                isLatest 
                                                ? 'bg-white dark:bg-zinc-800 border-red-200 dark:border-red-900/50 ring-1 ring-red-50 dark:ring-red-900/20' 
                                                : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'
                                            }`}>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                                        entry.action.includes('FIX') ? 'bg-amber-100 text-amber-700' : 
                                                        entry.action === 'MODIFIED' ? 'bg-blue-100 text-blue-700' : 
                                                        'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {entry.action}
                                                    </span>
                                                    {isLatest && <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1"><Flame size={10}/> Latest Update</span>}
                                                </div>
                                                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                                    {entry.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Footer Status */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 text-center">
                    <p className="text-[9px] font-mono text-zinc-400 uppercase">
                        Rejestr jest prawnie wiążący dla Architekta. • Signed by: BartsGda
                    </p>
                </div>
            </div>
        </div>
    );
};
