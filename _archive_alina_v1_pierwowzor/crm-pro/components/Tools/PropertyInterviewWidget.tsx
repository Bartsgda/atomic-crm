
import React from 'react';
import { Home, Building2, Key, Shield, AlertTriangle, Layers, Hammer, CheckSquare } from 'lucide-react';

interface Props {
    onAppend: (text: string) => void;
    className?: string;
}

export const PropertyInterviewWidget: React.FC<Props> = ({ onAppend, className = '' }) => {
    
    const handleClick = (category: string, value: string) => {
        onAppend(`${category}: ${value}`);
    };

    return (
        <div className={`w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl flex flex-col overflow-hidden ${className}`}>
            <div className="bg-zinc-100 dark:bg-zinc-800 p-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <Home size={12} /> Szybki Wywiad
                </span>
            </div>
            
            <div className="p-2 space-y-3 overflow-y-auto max-h-[300px] scrollbar-hide">
                
                {/* 1. PRZEDMIOT */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Przedmiot</p>
                    <div className="grid grid-cols-2 gap-1">
                        <button onClick={() => handleClick("Typ", "Mieszkanie")} className="interview-btn"><Building2 size={10}/> Mieszkanie</button>
                        <button onClick={() => handleClick("Typ", "Dom Jednorodzinny")} className="interview-btn"><Home size={10}/> Dom</button>
                        <button onClick={() => handleClick("Typ", "Dom w Budowie")} className="interview-btn"><Hammer size={10}/> Budowa</button>
                        <button onClick={() => handleClick("Typ", "Letniskowy")} className="interview-btn"><Home size={10}/> Letniskowy</button>
                    </div>
                </div>

                {/* 2. KONSTRUKCJA */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Konstrukcja</p>
                    <div className="grid grid-cols-2 gap-1">
                        <button onClick={() => handleClick("Konstr.", "Murowana (Niepalna)")} className="interview-btn text-emerald-600 bg-emerald-50 border-emerald-100">Murowana</button>
                        <button onClick={() => handleClick("Konstr.", "Drewniana (Palna)")} className="interview-btn text-amber-600 bg-amber-50 border-amber-100">Drewniana</button>
                    </div>
                </div>

                {/* 3. WŁASNOŚĆ */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Własność / Użytek</p>
                    <div className="flex flex-wrap gap-1">
                        <button onClick={() => handleClick("Własność", "Prywatna")} className="interview-btn flex-1"><Key size={10}/> Prywatna</button>
                        <button onClick={() => handleClick("Własność", "Wynajem (Najemca)")} className="interview-btn flex-1">Najemca</button>
                        <button onClick={() => handleClick("Własność", "Wynajem (Właściciel)")} className="interview-btn flex-1">Pod Wynajem</button>
                    </div>
                </div>

                {/* 4. BEZPIECZEŃSTWO */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Zabezpieczenia</p>
                    <div className="space-y-1">
                        <button onClick={() => handleClick("Zabezp.", "1 Zamek (Standard)")} className="interview-btn w-full text-left justify-start">1 Zamek (Standard)</button>
                        <button onClick={() => handleClick("Zabezp.", "2 Zamki / Atest")} className="interview-btn w-full text-left justify-start">2 Zamki / Atest</button>
                        <button onClick={() => handleClick("Zabezp.", "Alarm + Monitoring")} className="interview-btn w-full text-left justify-start text-blue-600 bg-blue-50 border-blue-100"><Shield size={10}/> Alarm + Monitoring</button>
                    </div>
                </div>

                {/* 5. HISTORIA */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Szkodowość (3 lata)</p>
                    <div className="flex gap-1">
                        <button onClick={() => handleClick("Historia", "BRAK SZKÓD")} className="interview-btn flex-1 bg-emerald-50 text-emerald-700 border-emerald-100">BRAK</button>
                        <button onClick={() => handleClick("Historia", "1 SZKODA")} className="interview-btn flex-1 bg-amber-50 text-amber-700 border-amber-100">1 SZKODA</button>
                        <button onClick={() => handleClick("Historia", "SZKODOWY (>1)")} className="interview-btn flex-1 bg-red-50 text-red-700 border-red-100">WIĘCEJ</button>
                    </div>
                </div>

                {/* 6. DODATKI */}
                <div>
                    <p className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Rozszerzenia</p>
                    <div className="flex flex-wrap gap-1">
                        <button onClick={() => handleClick("Opcja", "Powódź")} className="interview-btn text-[9px] px-2">Powódź</button>
                        <button onClick={() => handleClick("Opcja", "Przepięcia")} className="interview-btn text-[9px] px-2">Przepięcia</button>
                        <button onClick={() => handleClick("Opcja", "OC w Życiu")} className="interview-btn text-[9px] px-2">OC Prywatne</button>
                        <button onClick={() => handleClick("Opcja", "OC Najemcy")} className="interview-btn text-[9px] px-2">OC Najemcy</button>
                        <button onClick={() => handleClick("Opcja", "Przedmioty Szklane")} className="interview-btn text-[9px] px-2">Szyby</button>
                    </div>
                </div>

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
