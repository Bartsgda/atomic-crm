import React, { useEffect, useState, useMemo } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { 
    Home, Building2, Hammer, Palmtree, BrickWall, Trees, Layers, 
    AlertTriangle, Zap, Umbrella, Landmark, Lock, Ruler, Plus, X, Tag, 
    Calculator, Key, ShieldAlert, CheckCircle2, ChevronDown, ChevronUp,
    Briefcase, Building, Siren, Eye, Users, Waves, Package, Phone, Mail, Trash2
} from 'lucide-react';
import { STANDARD_INPUT_CLASS } from '../../modules/utils/window_utils';
import { parseHomeString } from '../../modules/utils/legacyParser';

interface Props {
    form: UseFormReturn<any>;
}

const SECTION_TITLE = "text-[10px] font-black uppercase tracking-widest mb-3";

// --- REUSABLE COLLAPSIBLE SECTION ---
const FormSection = ({ title, icon: Icon, children, defaultOpen = false, className = "" }: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean, className?: string }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden ${className}`}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                onFocus={() => setIsOpen(true)} // Auto-expand on tab focus
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:bg-emerald-50 dark:focus:bg-emerald-900/20 focus:text-emerald-600"
            >
                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest group-focus:text-emerald-600">
                    <Icon size={14} className={isOpen ? 'text-emerald-500' : 'text-zinc-400'} />
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

export const HomeForm: React.FC<Props> = ({ form }) => {
    const { register, watch, setValue, getValues, control } = form;
    const [customTagInput, setCustomTagInput] = useState('');
    const [showAssignment, setShowAssignment] = useState(!!getValues('homeDetails.assignmentBank'));
    
    // Co-Owners Field Array (Moved from AutoForm logic)
    const { fields: coOwnerFields, append: appendCoOwner, remove: removeCoOwner } = useFieldArray({ control, name: "homeDetails.coOwners" });

    const originalString = watch('originalProductString');

    // Watchers
    const objectType = watch('homeDetails.objectType');
    const constructionType = watch('homeDetails.constructionType');
    const ownershipType = watch('homeDetails.ownershipType');
    const securityType = watch('homeDetails.securityType');
    const historyClaims = watch('homeDetails.historyClaims');
    const businessActivity = watch('homeDetails.businessActivity');
    
    const flood = watch('homeDetails.flood');
    const theft = watch('homeDetails.theft');
    const oc = watch('homeDetails.ocPrivate');
    const customTags = watch('homeDetails.customTags') || [];
    
    const sumWalls = watch('homeDetails.sumWalls') || 0;
    const sumFixed = watch('homeDetails.sumFixedElements') || 0;
    const totalStructure = useMemo(() => (parseFloat(sumWalls) || 0) + (parseFloat(sumFixed) || 0), [sumWalls, sumFixed]);

    // --- AUTO-PARSER EFFECT ---
    useEffect(() => {
        if (originalString) {
            const detected = parseHomeString(originalString);
            const currentType = getValues('homeDetails.objectType');
            
            // Only update if current is MIESZKANIE (default) and we detected something else
            if (detected.objectType && currentType === 'MIESZKANIE') {
                setValue('homeDetails.objectType', detected.objectType);
            }
        }
    }, []);

    useEffect(() => {
        if (!watch('homeDetails')) {
            setValue('homeDetails', {
                objectType: 'MIESZKANIE',
                constructionType: 'MUROWANA',
                ownershipType: 'WLASNOSC',
                flood: true,
                theft: true,
                surges: true,
                ocPrivate: true,
                sumWalls: 0,
                sumFixedElements: 0,
                sumItems: 0,
                customTags: [],
                businessActivity: false,
                businessActivityOver50: false,
                securityType: 'STANDARD',
                historyClaims: 'BRAK',
                coOwners: []
            });
        }
        if (getValues('homeDetails.assignmentBank')) setShowAssignment(true);
    }, [setValue, watch, getValues]);

    const handleTileSelect = (field: string, value: string) => {
        setValue(field, value);
    };

    const toggleRisk = (field: string, currentVal: boolean) => {
        setValue(field, !currentVal);
    };

    const addCustomTag = () => {
        if (!customTagInput.trim()) return;
        const current = getValues('homeDetails.customTags') || [];
        if (!current.includes(customTagInput.trim())) {
            setValue('homeDetails.customTags', [...current, customTagInput.trim()]);
        }
        setCustomTagInput('');
    };

    const removeCustomTag = (tagToRemove: string) => {
        const current = getValues('homeDetails.customTags') || [];
        setValue('homeDetails.customTags', current.filter((t: string) => t !== tagToRemove));
    };

    const isHouse = ['DOM', 'BUDOWA', 'LETNISKOWY'].includes(objectType);

    return (
        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
            
            {/* 1. ADRES & TYP (ALWAYS VISIBLE) */}
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border-2 border-zinc-100 dark:border-zinc-800">
                <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'MIESZKANIE', label: 'Mieszkanie', icon: Building2 },
                            { id: 'DOM', label: 'Dom', icon: Home },
                            { id: 'BUDOWA', label: 'Budowa', icon: Hammer },
                            { id: 'LETNISKOWY', label: 'Letniskowy', icon: Palmtree },
                        ].map((item) => (
                            <button 
                                key={item.id}
                                type="button"
                                onClick={() => handleTileSelect('homeDetails.objectType', item.id)}
                                className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-1 h-20 ${
                                    objectType === item.id 
                                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-lg scale-[1.02]' 
                                    : 'bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                                }`}
                            >
                                <item.icon size={20} />
                                <span className="text-[8px] font-black uppercase tracking-wider text-center">{item.label}</span>
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-zinc-400 mb-1 block pl-2">Adres Ubezpieczenia</label>
                        <input 
                            {...register('propertyAddress', { required: true })} 
                            placeholder="Ulica, Numer, Kod Pocztowy, Miejscowość" 
                            className={STANDARD_INPUT_CLASS} 
                        />
                    </div>
                </div>
            </div>

            {/* 2. DANE TECHNICZNE (COLLAPSIBLE) */}
            <FormSection title="Dane Techniczne i Konstrukcja" icon={Ruler} defaultOpen={true}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Powierzchnia (m²)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                {...register('homeDetails.area')} 
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="0"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Rok Budowy</label>
                            <input 
                                type="number" 
                                inputMode="numeric"
                                {...register('homeDetails.yearBuilt')} 
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="RRRR"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    </div>

                    {/* KONSTRUKCJA - KAFELKI */}
                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Rodzaj Konstrukcji</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'MUROWANA', label: 'Murowana (Niepalna)', icon: BrickWall },
                                { id: 'DREWNIANA', label: 'Drewniana (Palna)', icon: Trees },
                                { id: 'INNA', label: 'Mieszana / Inna', icon: Layers },
                            ].map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setValue('homeDetails.constructionType', c.id)}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1 ${
                                        constructionType === c.id 
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400'
                                    }`}
                                >
                                    <c.icon size={16} />
                                    <span className="text-[8px] font-black uppercase text-center leading-tight">{c.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PIĘTRO (Dla Mieszkania - PRZYCISKI) */}
                    {!isHouse && (
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Kondygnacja (Mieszkanie)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['PARTER', 'SRODKOWE', 'OSTATNIE'].map(fl => (
                                    <button
                                        key={fl}
                                        type="button"
                                        onClick={() => setValue('homeDetails.floor', fl)}
                                        className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border-2 ${
                                            watch('homeDetails.floor') === fl 
                                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' 
                                            : 'bg-white dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                                        }`}
                                    >
                                        {fl === 'PARTER' ? 'PARTER' : (fl === 'SRODKOWE' ? 'PIĘTRO' : 'OSTATNIE')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DOM - KONDYGNACJE (LICZBA) + OZE */}
                    {isHouse && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Liczba Pięter</label>
                                <input 
                                    type="number" 
                                    inputMode="numeric"
                                    {...register('homeDetails.totalFloors')} 
                                    className={STANDARD_INPUT_CLASS} 
                                    placeholder="1"
                                />
                            </div>
                            <div className="flex items-end">
                                <label className={`w-full p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between h-[46px] ${watch('homeDetails.photovoltaics') ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'}`}>
                                    <span className="text-xs font-black uppercase flex items-center gap-2"><Zap size={14}/> Fotowoltaika</span>
                                    <input type="checkbox" {...register('homeDetails.photovoltaics')} className="w-5 h-5 rounded text-amber-500 focus:ring-0" />
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </FormSection>

            {/* REST OF THE FORM (Collapsibles 3-6) */}
            <FormSection title="Własność i Użytkowanie" icon={Key} defaultOpen={false}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: 'WLASNOSC', label: 'Własność', icon: Key },
                            { id: 'SPOLDZIELCZE', label: 'Spółdzielcze', icon: Building },
                            { id: 'NAJEMCA', label: 'Najemca (OC)', icon: Briefcase },
                            { id: 'WYNAJMUJACY', label: 'Pod Wynajem', icon: Users },
                        ].map((o) => (
                            <button
                                key={o.id}
                                type="button"
                                onClick={() => setValue('homeDetails.ownershipType', o.id)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all gap-1 h-16 ${
                                    ownershipType === o.id 
                                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400'
                                }`}
                            >
                                <o.icon size={16} />
                                <span className="text-[8px] font-black uppercase text-center leading-tight">{o.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${businessActivity ? 'bg-amber-50 border-amber-300' : 'border-zinc-200 dark:border-zinc-700'}`}>
                            <span className="text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                                <Briefcase size={14} className={businessActivity ? 'text-amber-500' : 'text-zinc-400'}/> 
                                Czy w lokalu jest działalność gosp.?
                            </span>
                            <input type="checkbox" {...register('homeDetails.businessActivity')} className="w-5 h-5 rounded text-amber-500 focus:ring-0" />
                        </label>
                        
                        {businessActivity && (
                            <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ml-4 ${watch('homeDetails.businessActivityOver50') ? 'bg-red-50 border-red-300' : 'border-zinc-200 bg-white'}`}>
                                <span className="text-[9px] font-bold uppercase text-red-600">Czy zajmuje {'>'} 50% powierzchni? (Zwyżka)</span>
                                <input type="checkbox" {...register('homeDetails.businessActivityOver50')} className="w-5 h-5 rounded text-red-500 focus:ring-0" />
                            </label>
                        )}
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Landmark size={14} className="text-zinc-400"/>
                                <label className="text-[10px] font-black uppercase text-zinc-500">Cesja Praw (Kredyt)</label>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showAssignment} onChange={(e) => setShowAssignment(e.target.checked)} className="rounded text-zinc-900 focus:ring-0" />
                                <span className="text-[10px] font-bold uppercase text-zinc-400">{showAssignment ? 'Tak' : 'Nie'}</span>
                            </label>
                        </div>
                        {showAssignment && (
                            <input 
                                {...register('homeDetails.assignmentBank')} 
                                placeholder="Nazwa Banku / Numer Umowy" 
                                className={STANDARD_INPUT_CLASS} 
                            />
                        )}
                    </div>
                </div>
            </FormSection>

            {/* NEW: CO-OWNERS SECTION FOR HOME */}
            <FormSection title="Współwłaściciele" icon={Users} defaultOpen={false}>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Users size={12}/> Lista Współwłaścicieli</label>
                            <button type="button" onClick={() => appendCoOwner({ name: '', pesel: '' })} className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100">+ Dodaj</button>
                        </div>
                        {coOwnerFields.map((field, index) => (
                            <div key={field.id} className="flex flex-col gap-2 mb-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
                                <div className="flex gap-2">
                                    <input 
                                        {...register(`homeDetails.coOwners.${index}.name`)} 
                                        className={`flex-1 ${STANDARD_INPUT_CLASS} p-2 text-xs`}
                                        placeholder="Imię i Nazwisko"
                                    />
                                    <input 
                                        {...register(`homeDetails.coOwners.${index}.pesel`)} 
                                        className={`w-32 ${STANDARD_INPUT_CLASS} p-2 text-xs font-mono`}
                                        placeholder="PESEL"
                                    />
                                    <button type="button" onClick={() => removeCoOwner(index)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <Phone size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input 
                                            {...register(`homeDetails.coOwners.${index}.phone`)} 
                                            className={`w-full ${STANDARD_INPUT_CLASS} pl-6 py-1.5 text-[10px]`}
                                            placeholder="Telefon (opcjonalnie)"
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <Mail size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                                        <input 
                                            {...register(`homeDetails.coOwners.${index}.email`)} 
                                            className={`w-full ${STANDARD_INPUT_CLASS} pl-6 py-1.5 text-[10px]`}
                                            placeholder="E-mail (opcjonalnie)"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {coOwnerFields.length === 0 && <p className="text-[10px] text-zinc-400 italic text-center">Brak współwłaścicieli.</p>}
                    </div>
                </div>
            </FormSection>

            <FormSection title="Zabezpieczenia i Ryzyko" icon={ShieldAlert} defaultOpen={false}>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Klasa Zabezpieczeń (Kradzież)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                                { id: 'STANDARD', label: '1 Zamek', icon: Key },
                                { id: 'DRZWI_ATEST', label: 'Atest / 2 Zamki', icon: Lock },
                                { id: 'ALARM', label: 'Alarm Lokalny', icon: Siren },
                                { id: 'MONITORING', label: 'Monitoring', icon: Eye },
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setValue('homeDetails.securityType', s.id)}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all gap-1 h-16 ${
                                        securityType === s.id 
                                        ? 'border-zinc-900 bg-zinc-900 text-white' 
                                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400'
                                    }`}
                                >
                                    <s.icon size={16} />
                                    <span className="text-[8px] font-black uppercase text-center leading-tight">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Historia Szkód (3 lata)</label>
                        <div className="flex bg-zinc-50 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                            {[
                                { id: 'BRAK', label: 'Brak Szkód', color: 'bg-emerald-500' },
                                { id: '1_SZKODA', label: '1 Szkoda', color: 'bg-amber-500' },
                                { id: 'WIELE', label: 'Szkodowy (2+)', color: 'bg-red-500' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setValue('homeDetails.historyClaims', opt.id)}
                                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                                        historyClaims === opt.id 
                                        ? `${opt.color} text-white shadow-sm` 
                                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-2 block pl-2">Zakres Ochrony</label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { id: 'flood', label: 'Powódź', icon: Waves, active: flood, color: 'bg-blue-500 border-blue-600 text-white' },
                                { id: 'theft', label: 'Kradzież', icon: Lock, active: theft, color: 'bg-zinc-800 border-zinc-900 text-white' },
                                { id: 'surges', label: 'Przepięcia', icon: Zap, active: watch('homeDetails.surges'), color: 'bg-amber-500 border-amber-600 text-white' },
                                { id: 'ocPrivate', label: 'OC w Życiu', icon: Umbrella, active: oc, color: 'bg-indigo-500 border-indigo-600 text-white' },
                            ].map((item) => (
                                <button 
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleRisk(`homeDetails.${item.id}`, item.active)}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                        item.active 
                                        ? item.color
                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400 hover:border-zinc-400'
                                    }`}
                                >
                                    <item.icon size={16} />
                                    <span className="text-[10px] font-black uppercase">{item.label}</span>
                                </button>
                            ))}
                        </div>
                        <label className={`flex items-center gap-2 p-3 mt-2 rounded-xl border-2 cursor-pointer transition-all ${watch('homeDetails.outbuildingsIncluded') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-zinc-200 text-zinc-500'}`}>
                            <input type="checkbox" {...register('homeDetails.outbuildingsIncluded')} className="rounded text-blue-500 w-4 h-4" />
                            <span className="text-[10px] font-black uppercase">Budynki gospodarcze / Garaż / Ogrodzenie</span>
                        </label>
                    </div>
                </div>
            </FormSection>

            <FormSection title="Sumy Ubezpieczenia" icon={Calculator} defaultOpen={true} className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/10">
                <div className="space-y-4">
                    <div className="flex justify-between items-center bg-emerald-100/50 dark:bg-emerald-900/30 p-2 rounded-lg">
                        <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">RAZEM (Mury + Stałe):</span>
                        <span className="text-sm font-black text-emerald-800 dark:text-emerald-300">{totalStructure.toLocaleString()} PLN</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Mury (Substancja)</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                {...register('homeDetails.sumWalls')} 
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="0 PLN"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Elementy Stałe</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                {...register('homeDetails.sumFixedElements')} 
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="0 PLN"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase text-zinc-500 dark:text-zinc-400 mb-1 block pl-2">Ruchomości Domowe</label>
                            <input 
                                type="number" 
                                inputMode="decimal"
                                {...register('homeDetails.sumItems')} 
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="0 PLN"
                                onFocus={(e) => e.target.select()}
                            />
                        </div>
                    </div>
                </div>
            </FormSection>

            {/* 6. OPCJE NIESTANDARDOWE */}
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-2xl border-2 border-dashed border-amber-200 dark:border-amber-800/50">
                <p className={`${SECTION_TITLE} text-amber-600 flex items-center justify-between`}>
                    <span className="flex items-center gap-2"><Tag size={14}/> Opcje Niestandardowe</span>
                </p>
                
                <div className="flex flex-wrap gap-2 mb-3">
                    {customTags.map((tag: string, idx: number) => (
                        <div key={idx} className="bg-white dark:bg-zinc-800 border border-amber-200 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                            {tag}
                            <button type="button" onClick={() => removeCustomTag(tag)} className="hover:text-red-500"><X size={12}/></button>
                        </div>
                    ))}
                    {customTags.length === 0 && <span className="text-[10px] text-zinc-400 italic py-1">Brak dodatkowych opcji (np. Konstrukcja ażurowa, Domek holenderski).</span>}
                </div>

                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                        placeholder="Wpisz opcję (np. Konstrukcja ażurowa)..."
                        className={`flex-1 ${STANDARD_INPUT_CLASS} text-xs font-bold`}
                    />
                    <button 
                        type="button"
                        onClick={addCustomTag}
                        disabled={!customTagInput.trim()}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-colors disabled:opacity-50"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

        </div>
    );
};