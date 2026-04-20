
import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { Client } from '../types';
import { X, User, Save, MapPin, Phone, Mail, Plus, Trash2, Building2, Sparkles, Loader2, ShieldCheck, Info, AlertCircle, ChevronDown, ChevronUp, FileText, Fingerprint, Check, AlertTriangle } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { KaratekaInput } from './AI/KaratekaInput';
import { KaratekaTextarea } from './AI/KaratekaTextarea';
import { VisualDiffState } from '../ai/KaratekaTypes';
import { STANDARD_INPUT_CLASS, STANDARD_SELECT_CLASS } from '../modules/utils/window_utils';
import { Validators, Formatters, getValidationStatusClass } from '../modules/validators/unifiedValidators';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Client) => void;
  initialData?: Client | null;
  aiDiffs?: Record<string, VisualDiffState>; // Sugestie AI
  onUserCorrect?: (field: string, value: any) => void; // Callback poprawki
}

interface FormData {
  firstName: string;
  lastName: string;
  pesel: string;
  birthDate: string;
  gender: 'M' | 'F' | '';
  notes: string;
  phones: { prefix: string; customPrefix?: string; value: string }[];
  emails: { value: string }[];
  street: string;
  zipCode: string;
  city: string;
  businesses: {
    name: string;
    nip: string;
    regon: string;
    krs: string;
    street: string;
    city: string;
    zipCode: string;
    representation: string;
    notes: string; // New field
    phones: { value: string }[];
    emails: { value: string }[];
  }[];
}

const COUNTRIES = [
  { name: 'Polska', code: '+48', flag: '🇵🇱' },
  { name: 'Ukraina', code: '+380', flag: '🇺🇦' },
  { name: 'Niemcy', code: '+49', flag: '🇩🇪' },
  { name: 'Wlk. Brytania', code: '+44', flag: '🇬🇧' },
  { name: 'Białoruś', code: '+375', flag: '🇧🇾' },
  { name: 'Inny...', code: 'OTHER', flag: '🌍' },
];

// --- FORMATTERS (UI ONLY - Local Helpers) ---

const parsePeselToDate = (pesel: string) => {
  const digits = (pesel || '').replace(/\D/g, '');
  if (digits.length !== 11) return { birthDate: '', gender: '' as any };
  const year = parseInt(digits.substring(0, 2), 10);
  let month = parseInt(digits.substring(2, 4), 10);
  const day = parseInt(digits.substring(4, 6), 10);
  const genderDigit = parseInt(digits.substring(9, 10), 10);
  let fullYear = 1900 + year;
  if (month > 80) { fullYear = 1800 + year; month -= 80; }
  else if (month > 60) { fullYear = 2200 + year; month -= 60; }
  else if (month > 40) { fullYear = 2100 + year; month -= 40; }
  else if (month > 20) { fullYear = 2000 + year; month -= 20; }
  const birthDate = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return { birthDate, gender: genderDigit % 2 === 0 ? 'F' : 'M' };
};

// --- REUSABLE SECTION COMPONENT (WITH FOCUS FRAME) ---
const FormSection = ({ title, icon: Icon, children, defaultOpen = false, className = "" }: { title: string, icon: any, children?: React.ReactNode, defaultOpen?: boolean, className?: string }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden ${className}`}>
            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between p-4 transition-all focus:outline-none focus:ring-4 focus:ring-blue-500/30 focus:bg-blue-50 dark:focus:bg-blue-900/20 focus:border-blue-300 focus:z-10 relative ${isOpen ? 'bg-zinc-50 dark:bg-zinc-900' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
            >
                <div className="flex items-center gap-2 text-xs font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-widest">
                    <Icon size={14} className={isOpen ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'} />
                    {title}
                </div>
                {isOpen ? <ChevronUp size={16} className="text-zinc-400"/> : <ChevronDown size={16} className="text-zinc-400"/>}
            </button>
            {isOpen && <div className="p-4 pt-0 animate-in slide-in-from-top-2 duration-200 border-t border-zinc-100 dark:border-zinc-800/50">{children}</div>}
        </div>
    );
};

export const ClientFormModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, aiDiffs = {}, onUserCorrect }) => {
  const [isAiLoading, setIsAiLoading] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { register, control, handleSubmit, watch, setValue, reset, getValues, formState: { errors } } = useForm<FormData>();
  const { fields: phoneFields, append: appendPhone, remove: removePhone } = useFieldArray({ control, name: "phones" });
  const { fields: emailFields, append: appendEmail, remove: removeEmail } = useFieldArray({ control, name: "emails" });
  const { fields: businessFields, append: appendBusiness, remove: removeBusiness } = useFieldArray({ control, name: "businesses" });

  const peselValue = watch('pesel');

  // Auto-fill DOB & Gender from PESEL
  useEffect(() => {
    if (peselValue && Validators.isPeselValid(peselValue)) {
      const { birthDate, gender } = parsePeselToDate(peselValue);
      if (birthDate) setValue('birthDate', birthDate);
      if (gender) setValue('gender', gender);
    }
  }, [peselValue, setValue]);

  // Init form
  useEffect(() => {
    if (isOpen) {
      setValidationError(null);
      if (initialData) {
        reset({
          firstName: initialData.firstName || '',
          lastName: initialData.lastName || '',
          pesel: initialData.pesel || '',
          birthDate: initialData.birthDate || '',
          gender: initialData.gender || '',
          notes: initialData.notes || '',
          street: initialData.street || '',
          zipCode: initialData.zipCode || '',
          city: initialData.city || '',
          phones: initialData.phones?.map(p => {
             const match = p.match(/^(\+\d{1,4})\s?(.*)$/);
             const knownPrefix = match ? COUNTRIES.find(c => c.code === match[1]) : null;
             return match ? 
                { prefix: knownPrefix ? match[1] : 'OTHER', customPrefix: knownPrefix ? '' : match[1], value: match[2] } : 
                { prefix: '+48', value: p };
          }) || [{ prefix: '+48', value: '' }],
          emails: initialData.emails?.map(v => ({ value: v })) || [{ value: '' }],
          businesses: initialData.businesses?.map(b => ({
            name: b.name || '',
            nip: Formatters.nip(b.nip || ''), 
            regon: b.regon || '',
            krs: b.krs || '',
            street: b.street || '',
            city: b.city || '',
            zipCode: b.zipCode || '',
            representation: b.representation || '',
            notes: b.notes || '', // Restore notes
            phones: b.phones?.map(p => ({ value: p })) || [],
            emails: b.emails?.map(e => ({ value: e })) || [],
          })) || [],
        });
      } else {
        reset({
          firstName: '', lastName: '', pesel: '', birthDate: '', gender: '', notes: '',
          phones: [{ prefix: '+48', value: '' }], emails: [{ value: '' }],
          street: '', zipCode: '', city: '', businesses: []
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const constructClientObject = (data: FormData): Client => {
      return {
          id: initialData?.id || `c_${Date.now()}`,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          pesel: data.pesel || '',
          birthDate: data.birthDate || undefined,
          gender: data.gender === '' ? undefined : (data.gender as 'M' | 'F'),
          notes: data.notes || '',
          street: data.street || '',
          city: data.city || '',
          zipCode: data.zipCode || '',
          phones: (data.phones || []).map(p => {
              const prefix = p.prefix === 'OTHER' ? (p.customPrefix || '') : p.prefix;
              if (!p.value) return '';
              return `${prefix} ${p.value}`.trim();
          }).filter(Boolean),
          emails: (data.emails || []).map(e => e.value).filter(Boolean),
          businesses: (data.businesses || []).map(b => ({
              name: b.name || '',
              nip: b.nip || '',
              regon: b.regon || '',
              krs: b.krs || '',
              street: b.street || '',
              city: b.city || '',
              zipCode: b.zipCode || '',
              representation: b.representation || '',
              notes: b.notes || '', // Save notes
              phones: (b.phones || []).map(p => p.value).filter(Boolean),
              emails: (b.emails || []).map(e => e.value).filter(Boolean),
          })),
          createdAt: initialData?.createdAt || new Date().toISOString()
      };
  };

  const handleFormSubmit = (data: FormData) => {
      setValidationError(null);

      // 1. Imię i Nazwisko
      if (!data.firstName.trim() || !data.lastName.trim()) {
          setValidationError("Imię i nazwisko są wymagane.");
          return;
      }

      // 2. Kontakt (Telefon LUB Email)
      const hasPhone = data.phones.some(p => p.value && p.value.length >= 7 && p.value.length <= 15); 
      const hasEmail = data.emails.some(e => e.value && e.value.includes('@'));

      if (!hasPhone && !hasEmail) {
          setValidationError("Wymagany jest co najmniej jeden poprawny kontakt: Telefon lub E-mail.");
          return;
      }

      // 3. Walidacja Identyfikatorów (Jeśli są wpisane)
      if (data.pesel && !Validators.isPeselValid(data.pesel)) {
          setValidationError("Błędny numer PESEL (nieprawidłowa suma kontrolna lub długość).");
          return;
      }
      
      if (data.zipCode && !Validators.isZipCodeValid(data.zipCode)) {
          setValidationError("Błędny kod pocztowy. Wymagany format: XX-XXX.");
          return;
      }

      // Sukces
      const clientObj = constructClientObject(data);
      onSave(clientObj);
      onClose();
  };

  const handleAiLookup = async (index: number) => {
    const vals = getValues();
    const business = vals.businesses?.[index];
    if (!business) return;

    const nip = (business.nip || '').replace(/-/g, '');
    const bName = business.name;
    const krs = business.krs;
    
    if (!nip && !bName && !krs) return;

    setIsAiLoading(index);
    const data = await geminiService.fetchCompanyData(nip, bName, krs);
    setIsAiLoading(null);

    if (data) {
      if (data.legalName) setValue(`businesses.${index}.name`, data.legalName);
      if (data.regon) setValue(`businesses.${index}.regon`, data.regon);
      if (data.krs) setValue(`businesses.${index}.krs`, data.krs);
      if (data.street) setValue(`businesses.${index}.street`, data.street);
      if (data.city) setValue(`businesses.${index}.city`, data.city);
      if (data.zipCode) setValue(`businesses.${index}.zipCode`, Formatters.zipCode(data.zipCode));
      if (data.representation) setValue(`businesses.${index}.representation`, data.representation);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl h-[90vh] rounded-[1.75rem] shadow-2xl flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
        
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950">
          <div>
            <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
               <User className="text-red-600" />
               {initialData ? `Edycja: ${initialData.lastName}` : 'Nowy Klient'}
            </h3>
            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">
               Kompletna Kartoteka Osobowa
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl text-zinc-400 transition-colors"><X size={24} /></button>
        </div>

        {/* VALIDATION ERROR */}
        {validationError && (
            <div className="px-8 py-3 bg-red-100 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 flex items-center gap-3 text-red-700 dark:text-red-400 font-bold text-xs animate-pulse">
                <AlertCircle size={16} /> {validationError}
            </div>
        )}

        {/* MAIN SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-zinc-900 scrollbar-hide space-y-6">
            <form id="client-form" onSubmit={handleSubmit(handleFormSubmit)}>
                
                {/* 1. SEKCJA GŁÓWNA: TOŻSAMOŚĆ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block pl-2">Imię <span className="text-red-500">*</span></label>
                        <KaratekaInput 
                            register={register('firstName', { required: "Wymagane" })}
                            diffState={aiDiffs['firstName']}
                            onUserCorrect={(val) => onUserCorrect?.('firstName', val)}
                            className={STANDARD_INPUT_CLASS} 
                            placeholder="Jan" 
                            autoFocus 
                        />
                        {errors.firstName && <p className="text-red-500 text-[9px] font-bold pl-2 mt-1">{errors.firstName.message}</p>}
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block pl-2">Nazwisko <span className="text-red-500">*</span></label>
                        <KaratekaInput 
                            register={register('lastName', { required: "Wymagane" })}
                            diffState={aiDiffs['lastName']}
                            onUserCorrect={(val) => onUserCorrect?.('lastName', val)}
                            className={STANDARD_INPUT_CLASS} 
                            placeholder="Kowalski" 
                        />
                        {errors.lastName && <p className="text-red-500 text-[9px] font-bold pl-2 mt-1">{errors.lastName.message}</p>}
                    </div>
                </div>

                {/* 2. KONTAKT ZINTEGROWANY (MOVE UP) */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* TELEFONY */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1"><Phone size={12}/> Telefony</label>
                                <button type="button" onClick={() => appendPhone({ prefix: '+48', value: '' })} className="text-[9px] font-bold text-blue-600 hover:underline">+ Dodaj</button>
                            </div>
                            {phoneFields.map((field, index) => {
                                const val = watch(`phones.${index}.value`);
                                const prefix = watch(`phones.${index}.prefix`);
                                const custom = watch(`phones.${index}.customPrefix`);
                                const isValid = Validators.isPhoneValid(val, prefix === 'OTHER' ? custom : prefix);
                                
                                // DYNAMIC LENGTH LIMIT BASED ON PREFIX
                                const maxLen = (prefix === '+48' || prefix === 'PL') ? 9 : 15;

                                return (
                                    <div key={field.id} className="flex gap-2 relative">
                                        <select 
                                            {...register(`phones.${index}.prefix`)} 
                                            className="w-20 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold outline-none"
                                        >
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                                        </select>
                                        <KaratekaInput 
                                            register={register(`phones.${index}.value`, {
                                                onChange: (e) => {
                                                    const clean = Formatters.onlyDigits(e.target.value, maxLen);
                                                    setValue(`phones.${index}.value`, clean);
                                                }
                                            })}
                                            diffState={index === 0 ? aiDiffs['phone'] : undefined}
                                            className={getValidationStatusClass(isValid, !val, `${STANDARD_INPUT_CLASS} py-2 pl-4`)}
                                            placeholder={prefix === '+48' ? "123456789" : "Max 15 cyfr"}
                                            maxLength={maxLen} // DYNAMIC MAX LENGTH (9 for PL, 15 for Other)
                                            inputMode="numeric"
                                        />
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {val && isValid && <Check size={14} className="text-emerald-500"/>}
                                            {val && !isValid && <AlertTriangle size={14} className="text-red-500"/>}
                                        </div>
                                        <button type="button" onClick={() => removePhone(index)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* EMAILE */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 flex items-center gap-1"><Mail size={12}/> E-maile</label>
                                <button type="button" onClick={() => appendEmail({ value: '' })} className="text-[9px] font-bold text-zinc-500 hover:underline">+ Dodaj</button>
                            </div>
                            {emailFields.map((field, index) => {
                                const val = watch(`emails.${index}.value`);
                                const isValid = Validators.isEmailValid(val);

                                return (
                                    <div key={field.id} className="flex gap-2 relative">
                                        <KaratekaInput 
                                            register={register(`emails.${index}.value`)}
                                            diffState={index === 0 ? aiDiffs['email'] : undefined}
                                            type="email"
                                            className={getValidationStatusClass(isValid, !val, `${STANDARD_INPUT_CLASS} py-2 pl-4`)}
                                            placeholder="adres@email.com" 
                                        />
                                        <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                                            {val && isValid && <Check size={14} className="text-emerald-500"/>}
                                            {val && !isValid && <AlertTriangle size={14} className="text-red-500"/>}
                                        </div>
                                        <button type="button" onClick={() => removeEmail(index)} className="text-zinc-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. ADRES ZAMIESZKANIA (OPEN BY DEFAULT) */}
                <FormSection title="Adres Zamieszkania" icon={MapPin} defaultOpen={true}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-[9px] font-bold text-zinc-400 uppercase mb-1 pl-1">Ulica i numer</label>
                            <KaratekaInput 
                                register={register('street')}
                                diffState={aiDiffs['street']}
                                onUserCorrect={(val) => onUserCorrect?.('street', val)}
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="Ulica i numer domu" 
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-zinc-400 uppercase mb-1 pl-1">Kod Pocztowy</label>
                            <div className="relative">
                                <KaratekaInput 
                                    register={register('zipCode', {
                                        onChange: (e) => {
                                            // STREFA OCHRONY - FORMATOWANIE W LOCIE
                                            const formatted = Formatters.zipCode(e.target.value);
                                            setValue('zipCode', formatted);
                                        }
                                    })}
                                    diffState={aiDiffs['zipCode']}
                                    inputMode="numeric"
                                    maxLength={6} // Enforce XX-XXX
                                    className={getValidationStatusClass(Validators.isZipCodeValid(watch('zipCode')), !watch('zipCode'), STANDARD_INPUT_CLASS)} 
                                    placeholder="80-180" 
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    {watch('zipCode') && Validators.isZipCodeValid(watch('zipCode')) ? <Check size={14} className="text-emerald-500"/> : null}
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-zinc-400 uppercase mb-1 pl-1">Miejscowość</label>
                            <KaratekaInput 
                                register={register('city')}
                                diffState={aiDiffs['city']}
                                className={STANDARD_INPUT_CLASS} 
                                placeholder="Miejscowość" 
                            />
                        </div>
                    </div>
                </FormSection>

                {/* 4. DANE OSOBISTE (COLLAPSIBLE - CLOSED) */}
                <FormSection title="Dane Osobiste (PESEL, Urodziny)" icon={Fingerprint} defaultOpen={false}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="relative">
                            <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block pl-2">PESEL</label>
                            <KaratekaInput 
                                register={register('pesel', {
                                    onChange: (e) => {
                                        const clean = Formatters.onlyDigits(e.target.value, 11);
                                        setValue('pesel', clean);
                                    }
                                })}
                                diffState={aiDiffs['pesel']}
                                onUserCorrect={(val) => onUserCorrect?.('pesel', val)}
                                maxLength={11} // Enforce 11
                                inputMode="numeric" 
                                className={getValidationStatusClass(Validators.isPeselValid(peselValue), !peselValue, `${STANDARD_INPUT_CLASS} font-mono tracking-widest pl-4`)} 
                                placeholder="00000000000"
                            />
                            <div className="absolute right-3 top-[34px] -translate-y-1/2 pointer-events-none">
                                {peselValue && Validators.isPeselValid(peselValue) ? <Check size={14} className="text-emerald-500"/> : (peselValue ? <AlertTriangle size={14} className="text-red-500"/> : null)}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block pl-2">Data Urodzenia</label>
                            <input 
                                type="date" 
                                {...register('birthDate')} 
                                className={STANDARD_INPUT_CLASS} 
                                onClick={(e) => e.currentTarget.showPicker()}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-zinc-500 mb-1 block pl-2">Płeć</label>
                            <div className="flex bg-zinc-50 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700 h-[42px]">
                                {['M', 'F'].map((g) => (
                                    <label key={g} className={`flex-1 flex items-center justify-center rounded-lg cursor-pointer transition-all font-black text-xs ${watch('gender') === g ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}>
                                        <input type="radio" value={g} {...register('gender')} className="hidden" />
                                        {g === 'M' ? 'Mężczyzna' : 'Kobieta'}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </FormSection>

                {/* 5. DZIAŁALNOŚĆ GOSPODARCZA (COLLAPSIBLE - CLOSED) */}
                <FormSection title="Firmy / B2B" icon={Building2} defaultOpen={false}>
                    <div className="space-y-6">
                        {businessFields.map((field, index) => {
                            const nip = watch(`businesses.${index}.nip`);
                            const regon = watch(`businesses.${index}.regon`);
                            const krs = watch(`businesses.${index}.krs`);
                            
                            return (
                                <div key={field.id} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black uppercase text-xs flex items-center gap-2"><Building2 size={14}/> Firma #{index+1}</h4>
                                        <button type="button" onClick={() => removeBusiness(index)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1"><Trash2 size={12}/> Usuń</button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        {/* DANE IDENTYFIKACYJNE FIRMY */}
                                        <div>
                                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">NIP (Pobiera dane z GUS)</label>
                                            <div className="flex gap-2 relative">
                                                <input 
                                                    {...register(`businesses.${index}.nip`, {
                                                        onChange: (e) => {
                                                            const formatted = Formatters.nip(e.target.value);
                                                            setValue(`businesses.${index}.nip`, formatted);
                                                        }
                                                    })} 
                                                    inputMode="numeric"
                                                    maxLength={13} // with dashes
                                                    className={getValidationStatusClass(Validators.isNipValid(nip), !nip, `${STANDARD_INPUT_CLASS} font-mono tracking-wider`)} 
                                                    placeholder="000-000-00-00"
                                                />
                                                <div className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none">
                                                    {nip && Validators.isNipValid(nip) ? <Check size={14} className="text-emerald-500"/> : (nip ? <AlertTriangle size={14} className="text-red-500"/> : null)}
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleAiLookup(index)}
                                                    disabled={isAiLoading === index}
                                                    className="px-3 bg-zinc-900 text-white rounded-xl hover:bg-black transition-all shadow-sm"
                                                    title="Pobierz z GUS"
                                                >
                                                    {isAiLoading === index ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-400" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">Pełna Nazwa</label>
                                            <input {...register(`businesses.${index}.name`)} className={STANDARD_INPUT_CLASS} placeholder="Nazwa Firmy" />
                                        </div>

                                        {/* DANE ADRESOWE FIRMY */}
                                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-zinc-200 dark:border-zinc-700 pt-4 mt-2">
                                            <div className="md:col-span-3">
                                                <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">Adres Siedziby</p>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">Ulica</label>
                                                <input {...register(`businesses.${index}.street`)} className={STANDARD_INPUT_CLASS} placeholder="Ulica firmy" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">Kod + Miasto</label>
                                                <div className="flex gap-2">
                                                    <input 
                                                        {...register(`businesses.${index}.zipCode`, {
                                                            onChange: (e) => {
                                                                const formatted = Formatters.zipCode(e.target.value);
                                                                setValue(`businesses.${index}.zipCode`, formatted);
                                                            }
                                                        })} 
                                                        className={`${STANDARD_INPUT_CLASS} w-20`} placeholder="00-000" maxLength={6}
                                                    />
                                                    <input {...register(`businesses.${index}.city`)} className={STANDARD_INPUT_CLASS} placeholder="Miasto" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* DETALE URZĘDOWE */}
                                        <div className="relative">
                                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">REGON</label>
                                            <input 
                                                {...register(`businesses.${index}.regon`, {
                                                    onChange: (e) => {
                                                        const clean = Formatters.onlyDigits(e.target.value, 14);
                                                        setValue(`businesses.${index}.regon`, clean);
                                                    }
                                                })} 
                                                inputMode="numeric"
                                                maxLength={14}
                                                className={getValidationStatusClass(Validators.isRegonValid(regon), !regon, `${STANDARD_INPUT_CLASS} font-mono`)} 
                                                placeholder="REGON (9/14 cyfr)"
                                            />
                                            <div className="absolute right-3 top-[26px] pointer-events-none">
                                                {regon && Validators.isRegonValid(regon) ? <Check size={14} className="text-emerald-500"/> : null}
                                            </div>
                                        </div>
                                        <div className="relative">
                                            <label className="text-[9px] font-bold uppercase text-zinc-400 mb-1 block">KRS</label>
                                            <input 
                                                {...register(`businesses.${index}.krs`, {
                                                    onChange: (e) => {
                                                        const clean = Formatters.onlyDigits(e.target.value, 10);
                                                        setValue(`businesses.${index}.krs`, clean);
                                                    }
                                                })} 
                                                inputMode="numeric"
                                                maxLength={10}
                                                className={getValidationStatusClass(Validators.isKrsValid(krs), !krs, `${STANDARD_INPUT_CLASS} font-mono`)} 
                                                placeholder="KRS (10 cyfr)"
                                            />
                                            <div className="absolute right-3 top-[26px] pointer-events-none">
                                                {krs && Validators.isKrsValid(krs) ? <Check size={14} className="text-emerald-500"/> : null}
                                            </div>
                                        </div>

                                        {/* POLE NOTATKI FIRMOWEJ (NOWE) */}
                                        <div className="md:col-span-2 mt-2">
                                            <label className="text-[9px] font-bold uppercase text-blue-500 mb-1 block flex items-center gap-1">
                                                <Sparkles size={10} /> Opis Działalności (dla AI)
                                            </label>
                                            <KaratekaTextarea 
                                                register={register(`businesses.${index}.notes`)}
                                                className={`${STANDARD_INPUT_CLASS} min-h-[60px] text-xs`}
                                                placeholder="Opisz czym zajmuje się firma (np. Transport Międzynarodowy, Budowlanka)..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <button 
                            type="button" 
                            onClick={() => appendBusiness({ name: '', nip: '', regon: '', krs: '', street: '', city: '', zipCode: '', representation: '', notes: '', phones: [], emails: [] })}
                            className="w-full py-3 rounded-xl border border-dashed border-zinc-300 text-zinc-400 font-black uppercase text-xs hover:border-zinc-900 hover:text-zinc-900 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={14} /> Dodaj kolejną firmę
                        </button>
                    </div>
                </FormSection>

                {/* 6. NOTATKI PRYWATNE (MOVED TO BOTTOM) */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-[10px] font-black uppercase text-amber-500 dark:text-amber-400 mb-1 block pl-2 flex items-center gap-1"><FileText size={12}/> Notatki Prywatne (Hobby, Rodzina)</label>
                    <KaratekaTextarea 
                        register={register('notes')}
                        diffState={aiDiffs['notes']}
                        className={`${STANDARD_INPUT_CLASS} min-h-[80px] bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-900 dark:text-amber-100 placeholder:text-amber-300`}
                        placeholder="Np. Lubi wędkować, ma psa Reksia..." 
                    />
                </div>

            </form>
        </div>

        {/* FOOTER */}
        <div className="p-6 md:p-8 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex justify-between items-center">
            <div className="text-[10px] font-black uppercase text-zinc-400 tracking-widest flex items-center gap-2">
                <Info size={14}/> Pola z * są wymagane
            </div>
            <div className="flex gap-4">
                <button onClick={onClose} className="px-8 py-3 rounded-lg text-[11px] font-black uppercase text-zinc-500 hover:bg-zinc-100 transition-all">Anuluj</button>
                <button 
                    onClick={() => document.getElementById('client-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))}
                    className="px-10 py-3 bg-zinc-900 text-white rounded-lg text-[11px] font-black uppercase flex items-center gap-2 shadow-xl hover:bg-black transition-all tracking-widest"
                >
                    <Save size={16} /> Zapisz Klienta
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};
