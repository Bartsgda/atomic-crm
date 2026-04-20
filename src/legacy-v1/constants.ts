
import { TerminationBasis, SalesStage } from './types';
import { AlertCircle, Clock, Send, MessageSquare, CheckCircle2, Snowflake, FileQuestion, BadgeHelp, XCircle, PauseCircle } from 'lucide-react';

export const LEGAL_TEXTS = {
  [TerminationBasis.ART_28]: {
    title: "Wypowiedzenie umowy OC (Art. 28)",
    description: "Wypowiedzenie na koniec okresu ubezpieczenia.",
    clause: "Na podstawie art. 28 ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych z końcem okresu, na jaki została zawarta."
  },
  [TerminationBasis.ART_28A]: {
    title: "Wypowiedzenie umowy OC (Art. 28a)",
    description: "Wypowiedzenie w przypadku podwójnego ubezpieczenia (automatyczne wznowienie).",
    clause: "Na podstawie art. 28a ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych, która została zawarta w trybie automatycznego wznowienia. Jednocześnie informuję, że pojazd posiada ubezpieczenie w innym zakładzie ubezpieczeń."
  },
  [TerminationBasis.ART_31]: {
    title: "Wypowiedzenie umowy OC (Art. 31)",
    description: "Wypowiedzenie przez nabywcę pojazdu.",
    clause: "Na podstawie art. 31 ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych, jako nabywca pojazdu, wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych."
  },
  [TerminationBasis.OWU]: {
    title: "Wypowiedzenie umowy (Wg OWU)",
    description: "Wypowiedzenie dobrowolnego ubezpieczenia zgodnie z OWU.",
    clause: "Niniejszym wypowiadam umowę ubezpieczenia zgodnie z obowiązującymi Ogólnymi Warunkami Ubezpieczenia (OWU)."
  },
  [TerminationBasis.OTHER]: {
    title: "Wypowiedzenie umowy",
    description: "Wypowiedzenie inne.",
    clause: "Niniejszym wypowiadam umowę ubezpieczenia."
  }
};

// --- GLOBALNA PALETA KOLORÓW STATUSÓW (DESIGN SYSTEM) ---
// SŁOWNIK KANONICZNY:
// 1. 'of_do zrobienia' (Lead)
// 2. 'przeł kontakt' (W toku / Kalkulacja)
// 3. 'czekam na dane/dokum' (Oczekiwanie)
// 4. 'oferta_wysłana' (Wysłane)
// 5. 'sprzedaż' (Sukces)
// 6. 'ucięty kontakt' (Odrzut)
// 7. 'rez po ofercie_kont za rok' (Chłodnia)

export const STATUS_CONFIG: Record<string, { label: string, color: string, bg: string, border: string, icon: any, shadow?: string }> = {
  // 1. LEAD (DO ZROBIENIA) -> ROSE (Alarmujący, Pilny)
  'of_do zrobienia': { 
      label: 'Do Zrobienia', 
      color: 'text-rose-700', 
      bg: 'bg-rose-50', 
      border: 'border-rose-200', 
      icon: AlertCircle,
      shadow: 'shadow-rose-100'
  },
  
  // 2. W TOKU (KALKULACJA) -> BLUE (Biznesowy, Proces)
  'przeł kontakt': { 
      label: 'Kalkulacja / W toku', 
      color: 'text-blue-700', 
      bg: 'bg-blue-50', 
      border: 'border-blue-200', 
      icon: Clock,
      shadow: 'shadow-blue-100'
  },
  
  // 2b. CZEKAM NA DANE -> INDIGO (Oczekiwanie techniczne)
  'czekam na dane/dokum': { 
      label: 'Czekam na Dane', 
      color: 'text-indigo-700', 
      bg: 'bg-indigo-50', 
      border: 'border-indigo-200', 
      icon: FileQuestion 
  },
  
  // 3. OFERTA WYSŁANA -> VIOLET/PURPLE (Magia sprzedaży)
  'oferta_wysłana': { 
      label: 'Oferta Wysłana', 
      color: 'text-purple-700', 
      bg: 'bg-purple-50', 
      border: 'border-purple-200', 
      icon: Send,
      shadow: 'shadow-purple-100'
  },
  // Legacy mapping
  'of_przedst': {
      label: 'Oferta Wysłana',
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      icon: Send,
      shadow: 'shadow-purple-100'
  },
  
  // 4. CHŁODNIA (ZAMROŻONE) -> SKY/CYAN (Lód)
  'rez po ofercie_kont za rok': { 
      label: 'Chłodnia (Za rok)', 
      color: 'text-sky-700', 
      bg: 'bg-sky-50', 
      border: 'border-sky-200', 
      icon: Snowflake,
      shadow: 'shadow-sky-100'
  },
  
  // 5. ODRZUCONE / UCIĘTE -> ZINC/GRAY (Martwe, neutralne)
  'ucięty kontakt': { 
      label: 'Odrzucone / Ucięte', 
      color: 'text-zinc-500', 
      bg: 'bg-zinc-100', 
      border: 'border-zinc-200', 
      icon: XCircle 
  },
  
  // 6. SUKCES (SPRZEDAŻ) -> EMERALD (Zielony, Pieniądze)
  'sprzedaż': {
      label: 'Sprzedane',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: CheckCircle2,
      shadow: 'shadow-emerald-100'
  },
  // Legacy mapping
  'sprzedany': {
      label: 'Sprzedane',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: CheckCircle2,
      shadow: 'shadow-emerald-100'
  },
  
  // Fallbacks
  'zbycie_pojazdu': { label: 'Zbycie', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: MessageSquare },
  'inne': { label: 'Inne', color: 'text-zinc-500', bg: 'bg-zinc-100', border: 'border-zinc-200', icon: BadgeHelp }
};