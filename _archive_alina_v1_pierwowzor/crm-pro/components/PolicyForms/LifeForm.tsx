
import React, { useEffect, useState } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Heart, Activity, User, Users, Cross, Stethoscope, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Plus, Trash2, Baby } from 'lucide-react';
import { STANDARD_INPUT_CLASS } from '../../modules/utils/window_utils';

interface Props {
    form: UseFormReturn<any>;
}

// --- REUSABLE COLLAPSIBLE SECTION ---
const FormSection = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden mb-4">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onFocus={() => setIsOpen(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-rose-50 dark:focus:bg-rose-900/20 focus:text-rose-600"
            >
                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest group-focus:text-rose-600">
                    <Icon size={14} className={isOpen ? 'text-rose-500' : 'text-zinc-400'} />
                    {title}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-zinc-400"/> : <ChevronDown size={16} className="text-zinc-400"/>}
            </button>
            
            {isOpen && (
                <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

export const LifeForm: React.FC<Props> = ({ form }) => {
    const { register, watch, setValue, control } = form;
    
    const { fields: insuredFields, append: appendInsured, remove: removeInsured } = useFieldArray({ control, name: "lifeDetails.insuredPersons" });
    const { fields: beneficiaryFields, append: appendBeneficiary, remove: removeBeneficiary } = useFieldArray({ control, name: "lifeDetails.beneficiaries" });

    const lifeType = watch('lifeDetails.lifeType');
    const hospital = watch('lifeDetails.hospital');
    const seriousIllness = watch('lifeDetails.seriousIllness');
    const hasMedicalSurvey = watch('hasMedicalSurvey');

    useEffect(() => {
        if (!watch('lifeDetails')) {
            setValue('lifeDetails', {
                lifeType: 'INDYWIDUALNA',
                sumDeath: 0,
                hospital: false,
                seriousIllness: false,
                insuredPersons: [],
                beneficiaries: []
            });
        }
    }, [setValue, watch]);

    const handleTypeSelect = (id: string) => setValue('lifeDetails.lifeType', id);

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            
            {/* 1. RODZAJ POLISY */}
            <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 mb-2 pl-2">Rodzaj Ochrony</p>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { id: 'INDYWIDUALNA', label: 'Indywidualna', icon: User },
                        { id: 'GRUPOWA', label: 'Grupowa (Otwarta)', icon: Users },
                        { id: 'SZKOLNA', label: 'NNW Szkolne', icon: Activity },
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleTypeSelect(item.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 h-20 ${
                                lifeType === item.id 
                                ? 'bg-zinc-900 text-white border-zinc-900 shadow-md scale-[1.02]' 
                                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-rose-300 hover:text-rose-500'
                            }`}
                        >
                            <item.icon size={20} />
                            <span className="text-[8px] font-black uppercase text-center leading-tight">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. OSOBY UBEZPIECZONE */}
            <FormSection title="Osoby Ubezpieczone (np. Dzieci)" icon={Users} defaultOpen={lifeType === 'SZKOLNA'}>
                <div className="space-y-2">
                    <p className="text-[9px] text-zinc-400 font-medium mb-2 pl-1">
                        Dodaj osoby objęte ochroną, jeśli są inne niż Ubezpieczający (Klient).
                    </p>
                    {insuredFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-center bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700">
                            <span className="text-[10px] font-mono text-zinc-400 w-4">{index + 1}.</span>
                            <input 
                                {...register(`lifeDetails.insuredPersons.${index}.name` as const)} 
                                placeholder="Imię i Nazwisko" 
                                className={`flex-1 ${STANDARD_INPUT_CLASS} p-1.5 text-xs`} 
                            />
                            <input 
                                {...register(`lifeDetails.insuredPersons.${index}.pesel` as const)} 
                                placeholder="PESEL" 
                                className={`w-32 ${STANDARD_INPUT_CLASS} p-1.5 text-xs font-mono`} 
                            />
                            <input type="hidden" {...register(`lifeDetails.insuredPersons.${index}.role` as const)} value="UBEZPIECZONY" />
                            <button type="button" onClick={() => removeInsured(index)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    <button 
                        type="button" 
                        onClick={() => appendInsured({ name: '', role: 'UBEZPIECZONY' })}
                        className="w-full py-2 border-2 border-dashed border-rose-200 rounded-xl text-xs font-bold text-rose-500 uppercase hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={14}/> Dodaj Osobę
                    </button>
                </div>
            </FormSection>

            {/* 3. ZAKRES I SUMY */}
            <FormSection title="Zakres Ubezpieczenia" icon={Heart} defaultOpen={true}>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Suma na wypadek Śmierci (Główna)</label>
                        <input 
                            type="number" 
                            inputMode="decimal"
                            {...register('lifeDetails.sumDeath')} 
                            className={`${STANDARD_INPUT_CLASS} text-rose-600 dark:text-rose-400 font-black`}
                            placeholder="0 PLN"
                            onFocus={(e) => e.target.select()}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${hospital ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                            <span className="text-[10px] font-bold uppercase flex items-center gap-2">
                                <Stethoscope size={14}/> Pobyt w Szpitalu
                            </span>
                            <input type="checkbox" {...register('lifeDetails.hospital')} className="w-4 h-4 rounded text-rose-500 focus:ring-0" />
                        </label>

                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${seriousIllness ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                            <span className="text-[10px] font-bold uppercase flex items-center gap-2">
                                <Activity size={14}/> Poważne Zachor.
                            </span>
                            <input type="checkbox" {...register('lifeDetails.seriousIllness')} className="w-4 h-4 rounded text-rose-500 focus:ring-0" />
                        </label>
                    </div>
                </div>
            </FormSection>

            {/* 4. UPOSAŻENI */}
            <FormSection title="Uposażeni (Beneficjenci)" icon={Baby} defaultOpen={false}>
                 <div className="space-y-2">
                    {beneficiaryFields.map((field, index) => (
                        <div key={field.id} className="flex gap-2 items-center bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-100 dark:border-zinc-700">
                            <input 
                                {...register(`lifeDetails.beneficiaries.${index}.name` as const)} 
                                placeholder="Imię i Nazwisko" 
                                className={`flex-1 ${STANDARD_INPUT_CLASS} p-1.5 text-xs`} 
                            />
                            <div className="relative w-20">
                                <input 
                                    type="number"
                                    {...register(`lifeDetails.beneficiaries.${index}.percentShare` as const)} 
                                    placeholder="%" 
                                    className={`w-full ${STANDARD_INPUT_CLASS} p-1.5 text-xs text-center`} 
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                            </div>
                            <input type="hidden" {...register(`lifeDetails.beneficiaries.${index}.role` as const)} value="UPOSAZONY" />
                            <button type="button" onClick={() => removeBeneficiary(index)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    <button 
                        type="button" 
                        onClick={() => appendBeneficiary({ name: '', role: 'UPOSAZONY' })}
                        className="w-full py-2 border-2 border-dashed border-zinc-300 rounded-xl text-xs font-bold text-zinc-500 uppercase hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={14}/> Dodaj Uposażonego
                    </button>
                </div>
            </FormSection>

            {/* 5. WYMAGANIA MEDYCZNE */}
            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                <p className="text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest flex items-center gap-2">
                    <Cross size={14} /> Wymogi Formalne
                </p>
                <div className="flex gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${hasMedicalSurvey ? 'bg-emerald-500' : 'bg-zinc-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hasMedicalSurvey ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                        <input type="checkbox" {...register('hasMedicalSurvey')} className="hidden" />
                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Ankieta Medyczna Wypełniona</span>
                    </label>
                </div>
                {hasMedicalSurvey ? (
                    <div className="mt-3 p-2 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg flex items-center gap-2">
                        <CheckCircle2 size={12} /> Klient potwierdził stan zdrowia.
                    </div>
                ) : (
                    <div className="mt-3 p-2 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg flex items-center gap-2">
                        <AlertCircle size={12} /> Brak ankiety może skutkować odmową wypłaty!
                    </div>
                )}
            </div>

        </div>
    );
};
