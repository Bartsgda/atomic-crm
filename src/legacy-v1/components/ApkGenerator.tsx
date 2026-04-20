
import React, { useState } from 'react';
import { Client, Policy } from '../types';
import { FileText, Check, X, Printer, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  client: Client;
  policy?: Policy;
  onClose: () => void;
}

export const ApkGenerator: React.FC<Props> = ({ client, policy, onClose }) => {
  const [needs, setNeeds] = useState({
    scope: 'standard', // standard / full / budget
    payment: 'once', // once / installments
    assets: true, // ochrona mienia
    liability: true, // oc w życiu
    life: false, // życie/zdrowie
  });

  const [notes, setNotes] = useState(
    policy ? `Klient poszukuje ochrony dla: ${policy.vehicleBrand || policy.type}.` : ''
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-white overflow-auto">
      {/* SCREEN ONLY HEADER */}
      <div className="print:hidden sticky top-0 bg-white border-b border-zinc-200 p-4 flex justify-between items-center shadow-sm z-50">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center">
                <ShieldCheck size={20} />
            </div>
            <div>
                <h2 className="font-black text-lg text-zinc-900">Generator APK (IDD)</h2>
                <p className="text-xs text-zinc-500">Analiza Potrzeb Klienta</p>
            </div>
        </div>
        <div className="flex gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all">
                <Printer size={16} /> Drukuj / PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500">
                <X size={24} />
            </button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW (A4) */}
      <div className="max-w-[210mm] mx-auto bg-white p-[15mm] min-h-[297mm] print:p-0 print:w-full">
        
        <div className="text-center border-b-2 border-zinc-900 pb-4 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-widest">Analiza Potrzeb Klienta (APK)</h1>
            <p className="text-sm mt-1">Zgodnie z ustawą o dystrybucji ubezpieczeń (IDD)</p>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
            <div>
                <p className="font-bold uppercase text-xs text-zinc-500 mb-1">Klient:</p>
                <p className="font-bold text-lg">{client.firstName} {client.lastName}</p>
                <p>{client.street}, {client.zipCode} {client.city}</p>
                <p>PESEL: {client.pesel || '___________________'}</p>
            </div>
            <div className="text-right">
                <p className="font-bold uppercase text-xs text-zinc-500 mb-1">Data i Miejsce:</p>
                <p className="font-bold">{client.city || '...................'}, {format(new Date(), 'yyyy-MM-dd')}</p>
                <p className="mt-4 font-bold uppercase text-xs text-zinc-500 mb-1">Pośrednik:</p>
                <p>Biuro Ubezpieczeń</p>
                <p>(Pieczątka Agenta)</p>
            </div>
        </div>

        {/* SECTION 1 */}
        <div className="mb-8">
            <h3 className="bg-zinc-100 p-2 font-bold text-sm uppercase mb-4 border-l-4 border-zinc-900">1. Przedmiot i Zakres Ubezpieczenia</h3>
            <div className="space-y-4 text-sm">
                <div className="flex items-start gap-4">
                    <div className="w-6 text-center font-bold">A.</div>
                    <div className="flex-1">
                        <p className="font-bold mb-1">Czego dotyczy poszukiwana ochrona?</p>
                        <div className="p-3 border border-zinc-300 rounded min-h-[40px]">
                            {policy ? `${policy.type} - ${policy.vehicleBrand || policy.propertyAddress} ${policy.vehicleReg || ''}` : '..........................................................................................'}
                        </div>
                    </div>
                </div>
                <div className="flex items-start gap-4">
                    <div className="w-6 text-center font-bold">B.</div>
                    <div className="flex-1">
                        <p className="font-bold mb-1">Preferowany zakres ochrony (zaznaczono na podstawie wywiadu):</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <label className="flex items-center gap-2 print:accent-black">
                                <input type="checkbox" checked={needs.assets} readOnly /> Utrata/uszkodzenie mienia (AC/Dom)
                            </label>
                            <label className="flex items-center gap-2 print:accent-black">
                                <input type="checkbox" checked={needs.liability} readOnly /> Odpowiedzialność Cywilna (OC)
                            </label>
                            <label className="flex items-center gap-2 print:accent-black">
                                <input type="checkbox" checked={needs.life} readOnly /> Życie i Zdrowie (NNW)
                            </label>
                            <label className="flex items-center gap-2 print:accent-black">
                                <input type="checkbox" checked={true} readOnly /> Assistance / Pomoc w podróży
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* SECTION 2 */}
        <div className="mb-8">
            <h3 className="bg-zinc-100 p-2 font-bold text-sm uppercase mb-4 border-l-4 border-zinc-900">2. Wymagania i Preferencje</h3>
            <div className="text-sm space-y-2">
                <p>Na podstawie przeprowadzonego wywiadu, ustalono następujące preferencje Klienta:</p>
                <div className="print:hidden space-y-2 mb-4 bg-yellow-50 p-4 rounded border border-yellow-200">
                    <p className="text-xs font-bold text-yellow-800 uppercase">Edytor Preferencji (Tylko na ekranie)</p>
                    <textarea 
                        className="w-full p-2 border border-yellow-300 rounded bg-white" 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                    />
                </div>
                <div className="p-4 border border-zinc-300 rounded min-h-[80px] whitespace-pre-wrap italic">
                    {notes}
                </div>
            </div>
        </div>

        {/* SECTION 3 */}
        <div className="mb-8">
            <h3 className="bg-zinc-100 p-2 font-bold text-sm uppercase mb-4 border-l-4 border-zinc-900">3. Rekomendacja Agenta</h3>
            <div className="text-sm">
                <p className="mb-2">Na podstawie powyższej analizy, przedstawiono ofertę ubezpieczenia:</p>
                <div className="grid grid-cols-1 gap-2 border border-zinc-300 p-4 rounded mb-4">
                    <p><strong>Towarzystwo:</strong> {policy?.insurerName || '..............................'}</p>
                    <p><strong>Produkt:</strong> {policy?.type || '..............................'}</p>
                    <p><strong>Uzasadnienie:</strong> Oferta spełnia wymagania klienta w zakresie {needs.scope === 'budget' ? 'najniższej ceny' : 'szerokiego zakresu ochrony'}. Jest zgodna z ustalonymi potrzebami.</p>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs">
            <div>
                <div className="h-16 border-b border-zinc-300 mb-2"></div>
                <p>Data i podpis Agenta</p>
            </div>
            <div>
                <div className="h-16 border-b border-zinc-300 mb-2"></div>
                <p>Data i podpis Klienta</p>
                <p className="text-[10px] text-zinc-400 mt-1">Oświadczam, że otrzymałem/am ofertę zgodną z moimi potrzebami.</p>
            </div>
        </div>

      </div>
    </div>
  );
};
