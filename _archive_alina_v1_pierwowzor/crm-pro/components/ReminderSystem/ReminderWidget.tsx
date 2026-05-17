
import React, { useRef } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { ReminderUtils } from './ReminderUtils';

interface Props {
    onSetDate: (date: Date) => void;
    activeDate: Date | null;
}

export const ReminderWidget: React.FC<Props> = ({ onSetDate, activeDate }) => {
    const dateInputRef = useRef<HTMLInputElement>(null);

    const handleQuick = (days: number) => {
        const date = ReminderUtils.calcDate(days);
        onSetDate(date);
    };

    const handleCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const date = new Date(e.target.value);
            // Domyślnie godzina 10:00 jeśli wybieramy z date pickera (chyba że datetime-local)
            date.setHours(10, 0, 0, 0); 
            onSetDate(date);
        }
    };

    return (
        <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <div className="px-2 text-zinc-400">
                <Clock size={14} />
            </div>
            
            {[1, 2, 3, 7].map(days => (
                <button
                    key={days}
                    type="button"
                    onClick={() => handleQuick(days)}
                    className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                        activeDate && activeDate.getDate() === ReminderUtils.calcDate(days).getDate()
                        ? 'bg-red-500 text-white shadow-md'
                        : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                >
                    {days}d
                </button>
            ))}

            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1"></div>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => dateInputRef.current?.showPicker()}
                    className={`p-1.5 rounded-lg transition-all ${activeDate ? 'text-red-600 bg-red-50' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'}`}
                    title="Wybierz datę"
                >
                    <Calendar size={16} />
                </button>
                <input 
                    ref={dateInputRef}
                    type="date" 
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleCustom}
                />
            </div>
            
            {activeDate && (
                <span className="text-[9px] font-bold text-red-600 ml-1 pr-2 animate-in fade-in">
                    {activeDate.toLocaleDateString()}
                </span>
            )}
        </div>
    );
};
