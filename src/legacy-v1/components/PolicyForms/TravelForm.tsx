
import React, { useEffect, useState } from 'react';
import { UseFormReturn, useFieldArray, Controller } from 'react-hook-form';
import { Plane, Map, Users, HeartPulse, Activity, Calendar, Plus, Trash2, Globe, Flag, AlertTriangle, FileText } from 'lucide-react';
import { STANDARD_INPUT_CLASS, STANDARD_SELECT_CLASS } from '../../modules/utils/window_utils';
import { SearchableSelect } from '../SearchableSelect';
import { COUNTRIES_DATA } from '../../data/countries';

interface Props {
    form: UseFormReturn<any>;
}

// Helper do budowania opcji z grupami (z def_travel.ts)
const COUNTRY_OPTIONS = COUNTRIES_DATA.sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    let groupLabel = 'ŚWIAT';
    if (c.region === 'UE') groupLabel = '🇪🇺 UNIA EUROPEJSKA (EKUZ)';
    else if (c.region === 'EUROPA') groupLabel = '🌍 EUROPA (POZOSTAŁE)';
    else if (c.region === 'AMERYKA_PN') groupLabel = '🇺🇸 AMERYKA PÓŁNOCNA (WYSOKIE KL)';
    else if (c.region === 'AZJA') groupLabel = '⛩️ AZJA';
    else if (c.region === 'AFRYKA') groupLabel = '🐫 AFRYKA';
    
    return {
        value: c.name,
        label: `${c.flag} ${c.name}`,
        group: groupLabel
    };
});

const FormSection = ({ title, icon: Icon, children, defaultOpen = true, className = "" }: any) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-4 ${className}`}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-800/50 hover:bg-zinc-200 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Icon size={14} className="text-rose-500" />
                    <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest">{title}</span>
                </div>
            </button>
            {isOpen && <div className="p-4">{children}</div>}
        </div>
    );
};

export const TravelForm: React.FC<Props> = ({ form }) => {
    const { register, control, watch, setValue, getValues } = form;
    const { fields, append, remove } = useFieldArray({ control, name: "travelDetails.participants" });
    
    const zone = watch('travelDetails.zone');
    const purpose = watch('travelDetails.purpose');
    const duration = watch('travelDetails.durationDays') || 7;
    const selectedCountry = watch('destinationCountry');

    useEffect(() => {
        if (!watch('travelDetails')) {
            setValue('travelDetails', {
                zone: 'EUROPA',
                durationDays: 7,
                participants: [],
                participantsCount: 1,
                purpose: 'WYPOCZYNEK',
                skiing: false,
                chronicDiseases: false,
                alcoholClause: false,
                sumMedical: 200000
            });
        }
    }, [setValue, watch]);

    // Risk Insight
    const countryInfo = COUNTRIES_DATA.find(c => c.name === selectedCountry);

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            
            {/* 1. KIERUNEK I CZAS */}
            <FormSection title="Kierunek i Czas" icon={Map}>
                <div className="space-y-4">
                    {/* KRAJ (SEARCHABLE) */}
                    <div>
                        <Controller
                            control={control}
                            name="destinationCountry"
                            render={({ field: { onChange, value } }) => (
                                <SearchableSelect
                                    label="Kraj Docelowy"
                                    value={value}
                                    onChange={onChange}
                                    options={COUNTRY_OPTIONS}
                                    placeholder="Wpisz kraj (np. Włochy)..."
                                    required
                                />
                            )}
                        />
                        {countryInfo && (
                            <div className={`mt-2 p-2 rounded-lg text-[10px] font-medium flex items-start gap-2 ${countryInfo.riskLevel === 'HIGH' || countryInfo.riskLevel === 'EXTREME' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5"/>
                                <span>{countryInfo.tips}</span>
                            </div>
                        )}
                    </div>

                    {/* STREFA */}
                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 mb-1 block pl-1">Strefa Geograficzna</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'EUROPA', label: 'Europa + Basen M.Ś.' },
                                { id: 'SWIAT', label: 'Świat (Bez USA)' },
                                { id: 'SWIAT_USA', label: 'Świat + USA' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setValue('travelDetails.zone', opt.id)}
                                    className={`p-2 rounded-xl border-2 text-[9px] font-black uppercase transition-all ${
                                        zone === opt.id 
                                        ? 'bg-zinc-900 text-white border-zinc-900' 
                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SUWAK DNI */}
                    <div>
                        <div className="flex justify-between items-end mb-2 px-1">
                            <label className="text-[9px] font-bold uppercase text-zinc-500">Długość pobytu</label>
                            <span className="text-lg font-black text-rose-600 dark:text-rose-400">{duration} dni</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" max="30" step="1"
                            {...register('travelDetails.durationDays')}
                            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                        />
                        <div className="flex justify-between text-[8px] text-zinc-400 mt-1 font-mono uppercase px-1">
                            <span>1 dzień</span>
                            <span>2 tygodnie</span>
                            <span>Miesiąc+</span>
                        </div>
                    </div>
                </div>
            </FormSection>

            {/* 2. ZAKRES I RYZYKA */}
            <FormSection title="Aktywność i Zdrowie" icon={Activity}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="text-[9px] font-bold uppercase text-zinc-500 mb-1 block pl-1">Cel Wyjazdu</label>
                        <select {...register('travelDetails.purpose')} className={STANDARD_SELECT_CLASS}>
                            <option value="WYPOCZYNEK">Wypoczynek / Zwiedzanie</option>
                            <option value="PRACA">Praca Fizyczna</option>
                            <option value="SPORT">Sporty Amatorskie (Narty/Rower)</option>
                            <option value="SPORT_EXTREME">Sporty Ekstremalne / Wysokiego Ryzyka</option>
                        </select>
                    </div>

                    {/* TOGGLES */}
                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${watch('travelDetails.skiing') ? 'bg-sky-50 border-sky-200' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                        <input type="checkbox" {...register('travelDetails.skiing')} className="w-4 h-4 rounded text-sky-500" />
                        <span className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">Narty / Snowboard</span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${watch('travelDetails.chronicDiseases') ? 'bg-red-50 border-red-200' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                        <input type="checkbox" {...register('travelDetails.chronicDiseases')} className="w-4 h-4 rounded text-red-500" />
                        <span className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">Choroby Przewlekłe</span>
                    </label>

                    <label className={`md:col-span-2 flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${watch('travelDetails.alcoholClause') ? 'bg-amber-50 border-amber-200' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                        <input type="checkbox" {...register('travelDetails.alcoholClause')} className="w-4 h-4 rounded text-amber-500" />
                        <span className="text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">Klauzula Alkoholowa</span>
                    </label>
                </div>
            </FormSection>

            {/* 3. UCZESTNICY */}
            <FormSection title="Lista Uczestników" icon={Users}>
                <div className="space-y-2">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-center">
                            <span className="text-[10px] font-mono text-zinc-400 w-4">{index + 1}.</span>
                            <input 
                                {...register(`travelDetails.participants.${index}.fullName` as const)} 
                                placeholder="Imię i Nazwisko" 
                                className={`flex-1 ${STANDARD_INPUT_CLASS} p-2 text-xs`} 
                            />
                            <input 
                                {...register(`travelDetails.participants.${index}.birthDate` as const)} 
                                placeholder="Data ur. / PESEL" 
                                className={`w-32 ${STANDARD_INPUT_CLASS} p-2 text-xs font-mono`} 
                            />
                            <button type="button" onClick={() => remove(index)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    <button 
                        type="button" 
                        onClick={() => append({ fullName: '', birthDate: '' })}
                        className="w-full py-2 border-2 border-dashed border-zinc-300 rounded-xl text-xs font-bold text-zinc-500 uppercase hover:border-rose-500 hover:text-rose-500 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={14}/> Dodaj Osobę
                    </button>
                </div>
                
                <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <label className="text-[9px] font-bold uppercase text-zinc-500 mb-1 block pl-1">Suma Kosztów Leczenia (KL)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            {...register('travelDetails.sumMedical')}
                            className={`${STANDARD_INPUT_CLASS} text-rose-600 font-black`}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">EUR</span>
                    </div>
                </div>
            </FormSection>

            {/* 4. IMPORT / NOTES (THE MISSING 5TH ELEMENT) */}
            <FormSection title="Dane Źródłowe / Notatki" icon={FileText} className="bg-yellow-50/50 border-yellow-100">
                <div>
                     <label className="text-[9px] font-bold uppercase text-zinc-500 mb-1 block pl-2">Treść z Importu (Excel) / Uwagi</label>
                     <textarea 
                        {...register('originalProductString')} 
                        className={`${STANDARD_INPUT_CLASS} min-h-[100px] text-xs font-mono`}
                        placeholder="Wklej tutaj dane z Excela..."
                    />
                </div>
            </FormSection>

        </div>
    );
};
