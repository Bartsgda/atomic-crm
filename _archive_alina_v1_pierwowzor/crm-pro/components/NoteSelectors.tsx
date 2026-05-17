
import React, { useState } from 'react';
import { FileText, Mail, Sparkles, Clock, RefreshCcw } from 'lucide-react';
import { SalesStage } from '../types';

export const STATUS_OPTS = [
  { label: "Oczekiwanie", color: "bg-amber-500 text-white", prefix: "[ST: OCZEKIWANIE]" },
  { label: "W toku", color: "bg-blue-500 text-white", prefix: "[ST: W TOKU]" },
  { label: "Zaakceptowana", color: "bg-emerald-500 text-white", prefix: "[ST: OK]" },
  { label: "Odrzucona", color: "bg-rose-500 text-white", prefix: "[ST: ODRZUT]" },
  { label: "Brak kontaktu", color: "bg-zinc-500 text-white", prefix: "[ST: BRAK TEL]" }
];

export const MAIL_OPTS = [
  { label: "Do wysłania", color: "bg-indigo-400 text-white", prefix: "[MAIL: DO WYSŁANIA]", icon: <Clock size={12} /> },
  { label: "Wysłany", color: "bg-indigo-600 text-white", prefix: "[MAIL: WYSŁANY]", icon: <Clock size={12} /> }
];

export const OFFER_TEMPLATES = [
  { label: "Pojazd", color: "bg-rose-500 text-white", prefix: "[OFERTA: POJAZD]", icon: "🚗" },
  { label: "Dom", color: "bg-amber-500 text-white", prefix: "[OFERTA: DOM]", icon: "🏠" },
  { label: "Życie", color: "bg-purple-500 text-white", prefix: "[OFERTA: ŻYCIE]", icon: "❤️" },
  { label: "Podróż", color: "bg-sky-500 text-white", prefix: "[OFERTA: PODRÓŻ]", icon: "✈️" }
];

export const REMINDER_OPTS = [
  { label: "1 dzień (Jutro)", val: 1 },
  { label: "3 dni", val: 3 },
  { label: "7 dni (Tydzień)", val: 7 },
  { label: "30 dni (Miesiąc)", val: 30 }
];

export const SALES_STAGES: { val: SalesStage; label: string; color: string }[] = [
  { val: 'of_do zrobienia', label: 'Do zrobienia', color: 'bg-red-500 text-white' },
  { val: 'przeł kontakt', label: 'W toku', color: 'bg-blue-500 text-white' },
  { val: 'sprzedaż', label: 'Sprzedane', color: 'bg-emerald-500 text-white' },
  { val: 'rez po ofercie_kont za rok', label: 'Rezygnacja', color: 'bg-zinc-500 text-white' }
];

interface Props {
  onStatusChange: (prefix: string | null) => void;
  onMailChange: (prefix: string | null) => void;
  onOfferChange: (prefix: string | null) => void;
  onReminderChange: (days: number | null) => void;
  onStageChange: (stage: SalesStage | null) => void;
  activeStatus: string | null;
  activeMail: string | null;
  activeOffer: string | null;
  activeReminder: number | null;
  activeStage: SalesStage | null;
}

export const NoteSelectors: React.FC<Props> = (props) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggle = (menu: string) => setOpenMenu(openMenu === menu ? null : menu);

  const curStatus = STATUS_OPTS.find(o => o.prefix === props.activeStatus);
  const curMail = MAIL_OPTS.find(o => o.prefix === props.activeMail);
  const curOffer = OFFER_TEMPLATES.find(o => o.prefix === props.activeOffer);
  const curStage = SALES_STAGES.find(o => o.val === props.activeStage);

  return (
    <div className="flex flex-wrap gap-2 relative">
      {/* STATUS */}
      <div className="relative">
        <button type="button" onClick={() => toggle('status')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${curStatus ? curStatus.color + ' border-transparent' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
          <FileText size={12} /> {curStatus ? curStatus.label : 'Status'}
        </button>
        {openMenu === 'status' && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-[90] py-1 overflow-hidden ring-1 ring-black/5">
            {STATUS_OPTS.map(s => (
              <button key={s.label} type="button" onClick={() => { props.onStatusChange(s.prefix); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-50 flex items-center justify-between text-zinc-700">
                 {s.label} <div className={`w-2 h-2 rounded-full ${s.color.split(' ')[0]}`}></div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MAIL */}
      <div className="relative">
        <button type="button" onClick={() => toggle('mail')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${curMail ? curMail.color + ' border-transparent' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
          <Mail size={12} /> {curMail ? curMail.label : 'Mail'}
        </button>
        {openMenu === 'mail' && (
          <div className="absolute bottom-full left-0 mb-2 w-40 bg-white border border-zinc-200 rounded-xl shadow-xl z-[90] py-1 overflow-hidden ring-1 ring-black/5">
            {MAIL_OPTS.map(o => (
              <button key={o.label} type="button" onClick={() => { props.onMailChange(o.prefix); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-50 text-zinc-700 flex items-center gap-2">
                 {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* OFERTA */}
      <div className="relative">
        <button type="button" onClick={() => toggle('offer')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${curOffer ? curOffer.color + ' border-transparent' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
          <Sparkles size={12} /> {curOffer ? curOffer.label : '+Oferta'}
        </button>
        {openMenu === 'offer' && (
          <div className="absolute bottom-full left-0 mb-2 w-40 bg-white border border-zinc-200 rounded-xl shadow-xl z-[90] py-1 overflow-hidden ring-1 ring-black/5">
            {OFFER_TEMPLATES.map(o => (
              <button key={o.label} type="button" onClick={() => { props.onOfferChange(o.prefix); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-50 text-zinc-700 flex items-center gap-2">
                 <span>{o.icon}</span> {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* TERMIN */}
      <div className="relative">
        <button type="button" onClick={() => toggle('rem')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${props.activeReminder ? 'bg-rose-500 text-white border-rose-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}>
          <Clock size={12} /> {props.activeReminder ? `Za ${props.activeReminder} dni` : 'Przypomnij'}
        </button>
        {openMenu === 'rem' && (
          <div className="absolute bottom-full left-0 mb-2 w-40 bg-white border border-zinc-200 rounded-xl shadow-xl z-[90] py-1 overflow-hidden ring-1 ring-black/5">
            {REMINDER_OPTS.map(d => (
              <button key={d.label} type="button" onClick={() => { props.onReminderChange(d.val); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-50 text-zinc-700">{d.label}</button>
            ))}
          </div>
        )}
      </div>

      {/* ETAP SPRZEDAŻY */}
      <div className="relative">
        <button type="button" onClick={() => toggle('stage')} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm border ${curStage ? curStage.color + ' border-transparent' : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-900'}`}>
          <RefreshCcw size={12} /> {curStage ? curStage.label : 'Etap'}
        </button>
        {openMenu === 'stage' && (
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-zinc-200 rounded-xl shadow-xl z-[90] py-1 overflow-hidden ring-1 ring-black/5">
            {SALES_STAGES.map(s => (
              <button key={s.val} type="button" onClick={() => { props.onStageChange(s.val); setOpenMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-zinc-50 text-zinc-700">{s.label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
