
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { FileText, Building2, Briefcase, Truck, Stethoscope, Building } from 'lucide-react';
import { STANDARD_INPUT_CLASS, STANDARD_SELECT_CLASS } from '../../modules/utils/window_utils';

interface Props {
    form: UseFormReturn<any>;
    type: string;
}

const BUSINESS_TYPES = [
    { value: 'MAJATEK', label: 'Majątek Firmy', icon: Building },
    { value: 'OC_DZIALALNOSCI', label: 'OC Działalności', icon: Briefcase },
    { value: 'OC_ZAWODOWE', label: 'OC Zawodowe (Lekarz, Prawnik)', icon: Stethoscope },
    { value: 'OCPD', label: 'OC Przewoźnika (OCPD)', icon: Truck },
    { value: 'FLOTA', label: 'Flota Pojazdów', icon: Truck },
    { value: 'INNE', label: 'Inne / Grupowe', icon: FileText }
];

export const OtherForm: React.FC<Props> = ({ form, type }) => {
    const { register, watch, setValue } = form;
    const isCompany = type === 'FIRMA';
    const businessType = watch('businessType');

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
                <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-zinc-100/50 dark:bg-zinc-800/50">
                    {isCompany ? <Building2 size={14} className="text-zinc-500" /> : <FileText size={14} className="text-zinc-500" />}
                    <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest">
                        {isCompany ? 'Szczegóły Działalności' : 'Przedmiot Ubezpieczenia'}
                    </span>
                </div>
                <div className="p-4 space-y-4">
                    
                    {isCompany && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Rodzaj Polisy Firmowej</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {BUSINESS_TYPES.map(bt => (
                                        <button 
                                            key={bt.value}
                                            type="button"
                                            onClick={() => setValue('businessType', bt.value)}
                                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-[9px] font-black uppercase ${
                                                businessType === bt.value 
                                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' 
                                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                                            }`}
                                        >
                                            <bt.icon size={12} />
                                            {bt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Kod PKD / Branża</label>
                                <input 
                                    {...register('businessPKD')} 
                                    className={STANDARD_INPUT_CLASS} 
                                    placeholder="np. Usługi Budowlane, 41.20.Z"
                                />
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Opis Przedmiotu / Uwagi</label>
                        <textarea 
                            {...register('originalProductString')} 
                            className={`${STANDARD_INPUT_CLASS} min-h-[100px]`} 
                            placeholder={isCompany ? "Opis mienia, zakres terytorialny, suma gwarancyjna..." : "Opisz co ubezpieczamy..."}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
