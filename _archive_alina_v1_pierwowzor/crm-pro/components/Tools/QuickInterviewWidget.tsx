
import React, { useState } from 'react';
import { Home, Car, Heart, Building2, Key, Shield, AlertTriangle, User, Activity, Stethoscope, Briefcase, Baby, Plane } from 'lucide-react';
import { PolicyType } from '../../types';

interface Props {
    type: PolicyType;
    onAppend: (text: string) => void;
    className?: string;
}

export const QuickInterviewWidget: React.FC<Props> = ({ type, onAppend, className = '' }) => {
    
    const handleClick = (category: string, value: string) => {
        onAppend(`${category}: ${value}`);
    };

    const renderAutoContent = () => (
        <>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Kierowca</p>
                <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleClick("Kierowca", "Właściciel jedyny")} className="interview-btn flex-1">Jedyny</button>
                    <button onClick={() => handleClick("Kierowca", "Współwłaściciel")} className="interview-btn flex-1">Współwł.</button>
                    <button onClick={() => handleClick("Młody", "TAK (<26 lat)")} className="interview-btn w-full bg-amber-50 text-amber-700 border-amber-200">Młody Kierowca</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Użytkowanie</p>
                <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => handleClick("Użytek", "Prywatny")} className="interview-btn">Prywatny</button>
                    <button onClick={() => handleClick("Użytek", "Firma/Działalność")} className="interview-btn">Firma</button>
                    <button onClick={() => handleClick("Przebieg", "do 10 tys. km")} className="interview-btn">Mało km</button>
                    <button onClick={() => handleClick("Wyjazd", "Polska")} className="interview-btn">Tylko PL</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Historia</p>
                <div className="flex gap-1">
                    <button onClick={() => handleClick("Historia", "Bezszkodowa")} className="interview-btn flex-1 bg-emerald-50 text-emerald-700 border-emerald-100">Czysta</button>
                    <button onClick={() => handleClick("Szkoda", "Ostatni rok")} className="interview-btn flex-1 bg-red-50 text-red-700 border-red-100">Szkoda</button>
                </div>
            </div>
        </>
    );

    const renderHomeContent = () => (
        <>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Przedmiot</p>
                <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => handleClick("Typ", "Mieszkanie")} className="interview-btn"><Building2 size={10}/> Lokal</button>
                    <button onClick={() => handleClick("Typ", "Dom Jednorodzinny")} className="interview-btn"><Home size={10}/> Dom</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Konstrukcja</p>
                <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => handleClick("Konstr.", "Murowana")} className="interview-btn text-emerald-600 bg-emerald-50 border-emerald-100">Murowana</button>
                    <button onClick={() => handleClick("Konstr.", "Drewniana")} className="interview-btn text-amber-600 bg-amber-50 border-amber-100">Drewniana</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Zabezpieczenia</p>
                <div className="space-y-1">
                    <button onClick={() => handleClick("Zabezp.", "1 Zamek")} className="interview-btn w-full justify-start">1 Zamek</button>
                    <button onClick={() => handleClick("Zabezp.", "2 Zamki / Atest")} className="interview-btn w-full justify-start">2 Zamki</button>
                </div>
            </div>
        </>
    );

    const renderLifeContent = () => (
        <>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Osoba</p>
                <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => handleClick("Zawód", "Praca Biurowa")} className="interview-btn"><Briefcase size={10}/> Biuro</button>
                    <button onClick={() => handleClick("Zawód", "Praca Fizyczna")} className="interview-btn"><Activity size={10}/> Fizyczna</button>
                    <button onClick={() => handleClick("Rodzina", "Małżonek + Dzieci")} className="interview-btn col-span-2"><Baby size={10}/> Rodzina</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Zdrowie</p>
                <div className="space-y-1">
                    <button onClick={() => handleClick("Zdrowie", "Bez Chorób Przewlekłych")} className="interview-btn w-full justify-start text-emerald-600 bg-emerald-50 border-emerald-100"><Shield size={10}/> Zdrowy</button>
                    <button onClick={() => handleClick("Zdrowie", "Choroby Przewlekłe")} className="interview-btn w-full justify-start text-red-600 bg-red-50 border-red-100"><Stethoscope size={10}/> Choruje</button>
                </div>
            </div>
            <div>
                <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Zakres</p>
                <div className="flex flex-wrap gap-1">
                    <button onClick={() => handleClick("Opcja", "Pobyt w Szpitalu")} className="interview-btn px-1">Szpital</button>
                    <button onClick={() => handleClick("Opcja", "Poważne Zachorowanie")} className="interview-btn px-1">Poważne</button>
                    <button onClick={() => handleClick("Opcja", "Uraz / NNW")} className="interview-btn px-1">NNW</button>
                </div>
            </div>
        </>
    );

    const getIcon = () => {
        if (['OC', 'AC', 'BOTH'].includes(type)) return Car;
        if (type === 'DOM') return Home;
        if (type === 'ZYCIE') return Heart;
        return AlertTriangle;
    }

    const Icon = getIcon();

    return (
        <div className={`w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl flex flex-col overflow-hidden ${className}`}>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <Icon size={12} className="text-red-500" /> Szybki Wywiad
                </span>
            </div>
            
            <div className="p-2 space-y-3 overflow-y-auto max-h-[300px] scrollbar-hide">
                {['OC', 'AC', 'BOTH'].includes(type) && renderAutoContent()}
                {type === 'DOM' && renderHomeContent()}
                {type === 'ZYCIE' && renderLifeContent()}
                {/* Fallback for others */}
                {!['OC', 'AC', 'BOTH', 'DOM', 'ZYCIE'].includes(type) && (
                    <p className="text-[10px] text-zinc-400 italic text-center py-4">Wybierz typ oferty, aby zobaczyć pytania.</p>
                )}
            </div>

            <style>{`
                .interview-btn {
                    @apply px-2 py-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-[10px] font-bold text-zinc-600 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95;
                }
                .dark .interview-btn {
                    @apply bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700;
                }
            `}</style>
        </div>
    );
};
