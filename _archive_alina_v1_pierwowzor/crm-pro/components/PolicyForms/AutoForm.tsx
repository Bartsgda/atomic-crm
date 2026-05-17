
import React, { useEffect, useState } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Shield, Car, PenTool, Truck, Disc, Bike, Tractor, Bus, Container, Calendar, Zap, Gauge, LayoutGrid, ChevronDown, ChevronUp, AlertTriangle, Users, Package, Banknote, Sparkles, Gamepad2, Trash2, Phone, Mail } from 'lucide-react';
import { VehicleSubType, PolicyType } from '../../types';
import { POPULAR_BRANDS } from '../../data/brands';
import { KaratekaInput } from '../AI/KaratekaInput';
import { KaratekaTextarea } from '../AI/KaratekaTextarea';
import { STANDARD_INPUT_CLASS, STANDARD_SELECT_CLASS } from '../../modules/utils/window_utils';
import { parseAutoString } from '../../modules/utils/legacyParser';

interface Props {
    form: UseFormReturn<any>;
    policyType: PolicyType;
    aiDiffs?: Record<string, any>; 
    onUserCorrect?: (field: string, val: string) => void;
}

const VEHICLE_TYPES: { id: VehicleSubType; label: string; icon: any }[] = [
    { id: 'OSOBOWY', label: 'Osob.', icon: Car },
    { id: 'CIEZAROWY', label: 'Cięż.', icon: Truck },
    { id: 'MOTOCYKL', label: 'Moto', icon: Bike },
    { id: 'QUAD', label: 'Quad', icon: Gamepad2 },
    { id: 'CIAGNIK', label: 'Ciągnik', icon: Tractor },
    { id: 'PRZYCZEPA', label: 'Przycz.', icon: Container },
    { id: 'AUTOBUS', label: 'Bus', icon: Bus },
    { id: 'FLOTA', label: 'Flota', icon: LayoutGrid },
];

const isStandardPlPlate = (reg: string) => /^[A-Z]{1,3}[0-9A-Z]{3,6}$/.test(reg.replace(/\s/g, ''));

const FormSection = ({ title, icon: Icon, children, defaultOpen = false }: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onFocus={() => setIsOpen(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-red-50 dark:focus:bg-red-900/20 focus:text-red-600"
            >
                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest group-focus:text-red-600">
                    <Icon size={14} className={isOpen ? 'text-red-500' : 'text-zinc-400'} />
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

export const AutoForm: React.FC<Props> = ({ form, policyType, aiDiffs = {}, onUserCorrect }) => {
    const { register, watch, setValue, control, getValues, formState: { errors } } = form;
    const { fields: coOwnerFields, append: appendCoOwner, remove: removeCoOwner } = useFieldArray({ control, name: "autoDetails.coOwners" });
    
    const vehicleType = watch('autoDetails.vehicleType');
    const originalString = watch('originalProductString');
    const stage = watch('stage');
    
    // Logic: Offer stages allow loose data
    const isOffer = ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana', 'ucięty kontakt', 'czekam na dane/dokum', 'of_przedst'].includes(stage);
    
    const [regWarning, setRegWarning] = useState<string | null>(null);
    const showAC = policyType === 'AC' || policyType === 'BOTH';

    // --- AUTO-PARSER EFFECT ---
    useEffect(() => {
        if (originalString) {
            const currentDetails = getValues('autoDetails');
            // Jeśli autoDetails są puste lub mają domyślny typ, spróbuj sparsować
            // Ale jeśli mamy już dane (np. z Importu Legacy), to NIE NADPISUJ
            const isFresh = !currentDetails.engineCapacity && !currentDetails.productionYear && currentDetails.vehicleType === 'OSOBOWY';
            
            if (isFresh) {
                const detected = parseAutoString(originalString);
                
                if (detected.vehicleType) setValue('autoDetails.vehicleType', detected.vehicleType);
                if (detected.fuelType) setValue('autoDetails.fuelType', detected.fuelType);
                if (detected.engineCapacity) setValue('autoDetails.engineCapacity', detected.engineCapacity);
                if (detected.enginePower) setValue('autoDetails.enginePower', detected.enginePower);
                if (detected.productionYear) setValue('autoDetails.productionYear', detected.productionYear);
            }
        }
    }, []); 

    useEffect(() => {
        if (!watch('autoDetails')) {
            setValue('autoDetails', {
                vehicleType: 'OSOBOWY',
                assistanceVariant: 'PODSTAWOWY',
                towingLimitPL: '100KM',
                towingLimitEU: 'BRAK',
                replacementCar: 'ACCIDENT_3',
                tires: false,
                windows: false,
                acVariant: 'KOSZTORYS',
                acAmortization: true,
                acDeductible: 500,
                coOwners: [],
                vehicleValueType: 'BRUTTO',
                ownership: 'PRYWATNA'
            });
        }
    }, [setValue, watch]);

    const handleRegInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.toUpperCase();
        const cleanVal = val.replace(/[^A-Z0-9]/g, '');
        setValue('vehicleReg', val);

        if (cleanVal.length > 0) {
            if (cleanVal.length < 4) {
                setRegWarning('Za krótki numer');
            } else if (!isStandardPlPlate(cleanVal)) {
                setRegWarning('Nietypowy format / Zagranica');
            } else {
                setRegWarning(null);
            }
        } else {
            setRegWarning(null);
        }
        
        if(onUserCorrect) onUserCorrect('vehicleReg', val);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            
            {/* 0. VEHICLE TYPE SELECTOR */}
            <div>
                <p className="text-[10px] font-black uppercase text-zinc-400 mb-3 tracking-widest flex items-center gap-2">
                    Rodzaj Pojazdu
                    {aiDiffs['autoDetails.vehicleType']?.status === 'PENDING' && (
                        <span className="text-purple-600 bg-purple-100 px-2 py-0.5 rounded text-[8px] flex items-center gap-1">
                            <Sparkles size={10} /> Sugestia AI
                        </span>
                    )}
                </p>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                    {VEHICLE_TYPES.map(vt => {
                        const isAiSuggested = aiDiffs['autoDetails.vehicleType']?.aiValue === vt.id;
                        const isSelected = vehicleType === vt.id;
                        
                        let btnClass = 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-red-400 hover:text-red-500';
                        
                        if (isSelected) {
                            if (isAiSuggested) {
                                btnClass = 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-200 scale-105 ring-2 ring-purple-300';
                            } else {
                                btnClass = 'bg-zinc-900 text-white border-zinc-900 shadow-md scale-105';
                            }
                        } else if (isAiSuggested) {
                            btnClass = 'bg-purple-50 text-purple-700 border-purple-400 border-dashed animate-pulse';
                        }

                        return (
                            <button 
                                key={vt.id}
                                type="button"
                                onClick={() => {
                                    setValue('autoDetails.vehicleType', vt.id);
                                    if(onUserCorrect) onUserCorrect('autoDetails.vehicleType', vt.id);
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 cursor-pointer transition-all gap-1 h-16 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 ${btnClass}`}
                            >
                                <vt.icon size={18} />
                                <span className="text-[8px] font-black uppercase tracking-wider">{vt.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 1. IDENTITY */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                    <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Marka {isOffer ? '' : '*'}</label>
                    <KaratekaInput 
                        register={register('vehicleBrand', { required: !isOffer })}
                        diffState={aiDiffs['vehicleBrand']}
                        onUserCorrect={(val) => onUserCorrect?.('vehicleBrand', val)}
                        list="brands"
                        placeholder="np. Toyota" 
                        className={STANDARD_INPUT_CLASS}
                    />
                    <datalist id="brands">
                        {POPULAR_BRANDS.map(b => <option key={b} value={b} />)}
                    </datalist>
                </div>
                <div className="md:col-span-1">
                    <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Model</label>
                    <KaratekaInput 
                        register={register('vehicleModel')}
                        diffState={aiDiffs['vehicleModel']}
                        onUserCorrect={(val) => onUserCorrect?.('vehicleModel', val)}
                        placeholder="np. Yaris"
                        className={STANDARD_INPUT_CLASS}
                    />
                </div>
                <div>
                    <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2 flex justify-between">
                        <span>Nr Rejestracyjny {isOffer ? '(Opcja)' : '*'}</span>
                        {regWarning && <span className="text-amber-500 flex items-center gap-1"><AlertTriangle size={10} /> {regWarning}</span>}
                    </label>
                    <KaratekaInput 
                        register={register('vehicleReg', { required: !isOffer })} 
                        onChange={handleRegInput}
                        diffState={aiDiffs['vehicleReg']}
                        onUserCorrect={(val) => onUserCorrect?.('vehicleReg', val)}
                        placeholder="GD 12345" 
                        className={`${STANDARD_INPUT_CLASS} uppercase ${regWarning ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10 focus:border-amber-500' : ''}`}
                    />
                </div>
            </div>

            {/* 2. DANE TECHNICZNE */}
            <FormSection title="Dane Techniczne (Rocznik, Przebieg, Silnik)" icon={Gauge} defaultOpen={true}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Calendar size={10}/> Rok Prod. {isOffer ? '' : '*'}</label>
                            <KaratekaInput 
                                register={register('autoDetails.productionYear', { required: !isOffer })}
                                diffState={aiDiffs['autoDetails.productionYear']}
                                onUserCorrect={(val) => onUserCorrect?.('autoDetails.productionYear', val)}
                                placeholder="RRRR" inputMode="numeric" maxLength={4} 
                                className={STANDARD_INPUT_CLASS}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Gauge size={10}/> Przebieg (km)</label>
                            <KaratekaInput 
                                type="number" inputMode="numeric"
                                register={register('autoDetails.mileage')}
                                diffState={aiDiffs['autoDetails.mileage']}
                                onUserCorrect={(val) => onUserCorrect?.('autoDetails.mileage', val)}
                                placeholder="km"
                                className={STANDARD_INPUT_CLASS}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Numer VIN</label>
                            <KaratekaInput 
                                register={register('vehicleVin')}
                                diffState={aiDiffs['vehicleVin']}
                                onUserCorrect={(val) => onUserCorrect?.('vehicleVin', val)}
                                placeholder="XXXXXXXXXXXXXXXXX" 
                                maxLength={17} 
                                className={`${STANDARD_INPUT_CLASS} uppercase font-mono tracking-widest`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Pojemność</label>
                            <KaratekaInput 
                                register={register('autoDetails.engineCapacity')}
                                diffState={aiDiffs['autoDetails.engineCapacity']}
                                onUserCorrect={(val) => onUserCorrect?.('autoDetails.engineCapacity', val)}
                                placeholder="cm3" inputMode="numeric" maxLength={5} 
                                className={STANDARD_INPUT_CLASS}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2 flex items-center gap-1"><Zap size={10}/> Moc (kW)</label>
                            <KaratekaInput 
                                register={register('autoDetails.enginePower')}
                                diffState={aiDiffs['autoDetails.enginePower']}
                                onUserCorrect={(val) => onUserCorrect?.('autoDetails.enginePower', val)}
                                placeholder="kW" inputMode="numeric" maxLength={4} 
                                className={STANDARD_INPUT_CLASS}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Paliwo</label>
                            <select 
                                {...register('autoDetails.fuelType')}
                                className={STANDARD_SELECT_CLASS}
                            >
                                <option value="">-</option>
                                <option value="BENZYNA">Benzyna</option>
                                <option value="DIESEL">Diesel</option>
                                <option value="LPG">LPG</option>
                                <option value="HYBRYDA">Hybryda</option>
                                <option value="ELEKTRYK">Elektryk</option>
                            </select>
                        </div>
                    </div>
                </div>
            </FormSection>

            {/* 3. WARTOŚĆ I STATUS */}
            <FormSection title="Wartość i Własność" icon={Banknote} defaultOpen={false}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2 flex justify-between">
                            <span>Suma Ubezpieczenia (AC)</span>
                            <span className="text-[8px] text-zinc-400">Netto/Brutto</span>
                        </label>
                        <div className="flex">
                            <KaratekaInput 
                                type="number" inputMode="decimal"
                                register={register('autoDetails.vehicleValue')}
                                diffState={aiDiffs['autoDetails.vehicleValue']}
                                onUserCorrect={(val) => onUserCorrect?.('autoDetails.vehicleValue', val)}
                                placeholder="Wartość pojazdu" 
                                className={`${STANDARD_INPUT_CLASS} rounded-r-none border-r-0`}
                            />
                            <select 
                                {...register('autoDetails.vehicleValueType')}
                                className="bg-zinc-100 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 rounded-r-xl text-xs font-black px-2 outline-none cursor-pointer text-zinc-900 dark:text-zinc-300"
                            >
                                <option value="BRUTTO">Brutto</option>
                                <option value="NETTO">Netto</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Forma Własności</label>
                        <select 
                            {...register('autoDetails.ownership')}
                            className={STANDARD_SELECT_CLASS}
                        >
                            <option value="PRYWATNA">Własność Prywatna</option>
                            <option value="LEASING">Leasing (Cesja)</option>
                            <option value="KREDYT">Kredyt (Przewłaszczenie)</option>
                        </select>
                    </div>
                </div>
            </FormSection>

            {/* 4. ASSISTANCE & ADDONS */}
            <FormSection title="Zakres Ochrony & Assistance" icon={Truck} defaultOpen={false}>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Wariant ASS</label>
                            <select {...register('autoDetails.assistanceVariant')} className={STANDARD_SELECT_CLASS}>
                                <option value="PODSTAWOWY">Podstawowy (Wypadek)</option>
                                <option value="ROZSZERZONY">Rozszerzony (Awaria)</option>
                                <option value="VIP">VIP / MAX</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Limit PL</label>
                            <select {...register('autoDetails.towingLimitPL')} className={STANDARD_SELECT_CLASS}>
                                <option value="BRAK">Brak</option>
                                <option value="100KM">100 km</option>
                                <option value="200KM">200 km</option>
                                <option value="500KM">500 km</option>
                                <option value="NO_LIMIT">Bez Limitu</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Limit UE</label>
                            <select {...register('autoDetails.towingLimitEU')} className={STANDARD_SELECT_CLASS}>
                                <option value="BRAK">Brak</option>
                                <option value="500KM">500 km</option>
                                <option value="1000KM">1000 km</option>
                                <option value="NO_LIMIT">Bez Limitu</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Auto Zastępcze</label>
                            <select {...register('autoDetails.replacementCar')} className={STANDARD_SELECT_CLASS}>
                                <option value="BRAK">Brak</option>
                                <option value="ACCIDENT_3">Wypadek (3 dni)</option>
                                <option value="ALL_7">Awaria/Wypadek (7 dni)</option>
                                <option value="MAX_21">Max (do 21 dni)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <label className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-red-300">
                            <input type="checkbox" {...register('autoDetails.tires')} className="w-4 h-4 rounded text-red-600 focus:ring-0" />
                            <div className="flex items-center gap-2 font-bold text-xs uppercase text-zinc-600 dark:text-zinc-300">
                                <Disc size={14} /> Opony
                            </div>
                        </label>
                        <label className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-red-300">
                            <input type="checkbox" {...register('autoDetails.windows')} className="w-4 h-4 rounded text-red-600 focus:ring-0" />
                            <div className="flex items-center gap-2 font-bold text-xs uppercase text-zinc-600 dark:text-zinc-300">
                                <PenTool size={14} /> Szyby
                            </div>
                        </label>
                    </div>
                </div>
            </FormSection>

            {/* 5. AC CONFIG */}
            {showAC && (
                <FormSection title="Autocasco (AC)" icon={Shield} defaultOpen={true}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Wariant Likwidacji</label>
                                <select {...register('autoDetails.acVariant')} className={STANDARD_SELECT_CLASS}>
                                    <option value="KOSZTORYS">Kosztorys (Gotówka)</option>
                                    <option value="PARTNER">Sieć Partnerska</option>
                                    <option value="ASO">ASO (Serwis Autoryzowany)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Amortyzacja Części</label>
                                <select 
                                    className={STANDARD_SELECT_CLASS} 
                                    value={watch('autoDetails.acAmortization') ? 'YES' : 'NO'} 
                                    onChange={e => setValue('autoDetails.acAmortization', e.target.value === 'YES')}
                                >
                                    <option value="NO">Potrącana (Taniej)</option>
                                    <option value="YES">Zniesiona (Nowe części)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block">Udział Własny</label>
                                <div className="relative">
                                    <KaratekaInput 
                                        type="number" inputMode="decimal"
                                        register={register('autoDetails.acDeductible')}
                                        diffState={aiDiffs['autoDetails.acDeductible']}
                                        onUserCorrect={(val) => onUserCorrect?.('autoDetails.acDeductible', val)}
                                        placeholder="0" className={`${STANDARD_INPUT_CLASS} pr-8`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400">PLN</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </FormSection>
            )}

            {/* 6. ADDITIONAL DETAILS (Współwłaściciele) */}
            <FormSection title="Współwłaściciele i Dodatki" icon={Users} defaultOpen={true}>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Users size={12}/> Współwłaściciele</label>
                            <button type="button" onClick={() => appendCoOwner({ name: '', pesel: '' })} className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">+ Dodaj</button>
                        </div>
                        {coOwnerFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col gap-2 mb-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div className="flex gap-2">
                                    <input 
                                        {...register(`autoDetails.coOwners.${index}.name`)} 
                                        className={`flex-1 ${STANDARD_INPUT_CLASS} p-2 text-xs`}
                                        placeholder="Imię i Nazwisko"
                                    />
                                    <input 
                                        {...register(`autoDetails.coOwners.${index}.pesel`)} 
                                        className={`w-32 ${STANDARD_INPUT_CLASS} p-2 text-xs font-mono`}
                                        placeholder="PESEL"
                                    />
                                    <button type="button" onClick={() => removeCoOwner(index)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Phone size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input 
                                            {...register(`autoDetails.coOwners.${index}.phone`)} 
                                            className={`w-full ${STANDARD_INPUT_CLASS} pl-6 py-1.5 text-[10px]`}
                                            placeholder="Telefon (opcjonalnie)"
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <Mail size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input 
                                            {...register(`autoDetails.coOwners.${index}.email`)} 
                                            className={`w-full ${STANDARD_INPUT_CLASS} pl-6 py-1.5 text-[10px]`}
                                            placeholder="E-mail (opcjonalnie)"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div>
                        <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 mb-1 flex items-center gap-1"><Package size={12}/> Ubezpieczenie Rzeczy (Fotelik, Sprzęt) / AI Info</label>
                        <KaratekaTextarea 
                            register={register('autoDetails.insuranceItems')}
                            diffState={aiDiffs['autoDetails.insuranceItems']}
                            onUserCorrect={(val) => onUserCorrect?.('autoDetails.insuranceItems', val)}
                            className={`${STANDARD_INPUT_CLASS} text-xs font-medium`}
                            placeholder="Np. Fotelik dziecięcy (500zł), Laptop w bagażniku..."
                            rows={3}
                        />
                    </div>
                </div>
            </FormSection>
        </div>
    );
};
