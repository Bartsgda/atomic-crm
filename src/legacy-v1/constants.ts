import { TerminationBasis, SalesStage } from "./types";
import {
  AlertCircle,
  Clock,
  Send,
  MessageSquare,
  CheckCircle2,
  Snowflake,
  FileQuestion,
  BadgeHelp,
  XCircle,
  PauseCircle,
  PhoneCall,
} from "lucide-react";

export const LEGAL_TEXTS = {
  [TerminationBasis.ART_28]: {
    title: "Wypowiedzenie umowy OC (Art. 28)",
    description: "Wypowiedzenie na koniec okresu ubezpieczenia.",
    clause:
      "Na podstawie art. 28 ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych z końcem okresu, na jaki została zawarta.",
  },
  [TerminationBasis.ART_28A]: {
    title: "Wypowiedzenie umowy OC (Art. 28a)",
    description:
      "Wypowiedzenie w przypadku podwójnego ubezpieczenia (automatyczne wznowienie).",
    clause:
      "Na podstawie art. 28a ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych, która została zawarta w trybie automatycznego wznowienia. Jednocześnie informuję, że pojazd posiada ubezpieczenie w innym zakładzie ubezpieczeń.",
  },
  [TerminationBasis.ART_31]: {
    title: "Wypowiedzenie umowy OC (Art. 31)",
    description: "Wypowiedzenie przez nabywcę pojazdu.",
    clause:
      "Na podstawie art. 31 ust. 1 ustawy z dnia 22 maja 2003 r. o ubezpieczeniach obowiązkowych, Ubezpieczeniowym Funduszu Gwarancyjnym i Polskim Biurze Ubezpieczycieli Komunikacyjnych, jako nabywca pojazdu, wypowiadam umowę ubezpieczenia OC posiadaczy pojazdów mechanicznych.",
  },
  [TerminationBasis.OWU]: {
    title: "Wypowiedzenie umowy (Wg OWU)",
    description: "Wypowiedzenie dobrowolnego ubezpieczenia zgodnie z OWU.",
    clause:
      "Niniejszym wypowiadam umowę ubezpieczenia zgodnie z obowiązującymi Ogólnymi Warunkami Ubezpieczenia (OWU).",
  },
  [TerminationBasis.OTHER]: {
    title: "Wypowiedzenie umowy",
    description: "Wypowiedzenie inne.",
    clause: "Niniejszym wypowiadam umowę ubezpieczenia.",
  },
};

// --- GLOBALNA PALETA KOLORÓW STATUSÓW (DESIGN SYSTEM) ---
// Ujednolicona 2026-07-25 wg ORYGINALNEJ palety Aliny z dropdownu statusów w Excelu
// (kolumna 2 "etap" -> `stage`, zob. XLSX_MAPPING.md pkt 2, wiersz "etap"/"stage").
// SŁOWNIK KANONICZNY (kolejność jak w dropdownie Aliny, kolor = jej oryginalny kolor):
// 1. 'czekam na dane/dokum'            -> CYAN    (czekam_na_dane / "czekar")
// 2. 'przeł kontakt'                   -> BLUE    (przel_kontakt / "przeł k")
// 3. 'of_przedst' / 'oferta_wysłana'   -> LIME    (oferta / "of_prz")
// 4. 'sprzedaż'                        -> GREEN   (sprzedaż / "sprzed" - SUKCES)
// 5. 'rez po ofercie_kont za rok'      -> SLATE   (rez_po_ofercie / "rez po")
// 6. 'of_do zrobienia'                 -> YELLOW  (of_do_zrobienia / "of_do")
// 7. 'pierwszy kontakt'                -> ROSE    (dodane 2026-07-25, wcześniej brak w enumie;
//    Bartek: "przy nowej bazie takie pozycje się pojawią" - lead świeży, jeszcze niedzwoniony)
// 8. 'ucięty kontakt'                  -> AMBER   (uciety_kontakt / "ucięty" - brąz/ochra)
// 9. 'sprzedany'                       -> VIOLET, biały tekst (klient sprzedał AUTO,
//    polisa NIEAKTUALNA - to jest INNY status niż 'sprzedaż'! Nie mylić kolorów.
//    NIE proponujemy wznowienia dla 'sprzedany' - patrz `isRenewable` w clientInsights.ts.)
// `inne`/`zbycie_pojazdu` to fallbacki spoza oryginalnej 9-elementowej listy Aliny.

export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: any;
    shadow?: string;
  }
> = {
  // 1. LEAD (DO ZROBIENIA) -> YELLOW (paleta Aliny)
  "of_do zrobienia": {
    label: "of_do zrobienia",
    color: "text-yellow-950",
    bg: "bg-yellow-400 dark:bg-yellow-500",
    border: "border-yellow-500 dark:border-yellow-600",
    icon: AlertCircle,
    shadow: "shadow-yellow-200",
  },

  // 1b. PIERWSZY KONTAKT -> ROSE (paleta Aliny: różowy/łososiowy)
  "pierwszy kontakt": {
    label: "pierwszy kontakt",
    color: "text-rose-950",
    bg: "bg-rose-300 dark:bg-rose-400",
    border: "border-rose-400 dark:border-rose-500",
    icon: PhoneCall,
    shadow: "shadow-rose-200",
  },

  // 2. W TOKU (KALKULACJA) -> BLUE (paleta Aliny)
  "przeł kontakt": {
    label: "przeł kontakt",
    color: "text-white",
    bg: "bg-blue-500 dark:bg-blue-600",
    border: "border-blue-600 dark:border-blue-700",
    icon: Clock,
    shadow: "shadow-blue-200",
  },

  // 2b. CZEKAM NA DANE -> CYAN (paleta Aliny)
  "czekam na dane/dokum": {
    label: "czekam na dane/dokum",
    color: "text-cyan-950",
    bg: "bg-cyan-400 dark:bg-cyan-500",
    border: "border-cyan-500 dark:border-cyan-600",
    icon: FileQuestion,
    shadow: "shadow-cyan-200",
  },

  // 3. OFERTA WYSŁANA -> LIME (paleta Aliny: limonkowy/jasnozielony)
  oferta_wysłana: {
    label: "oferta_wysłana",
    color: "text-lime-950",
    bg: "bg-lime-400 dark:bg-lime-500",
    border: "border-lime-500 dark:border-lime-600",
    icon: Send,
    shadow: "shadow-lime-200",
  },
  // Legacy mapping (of_przedst = "oferta przedstawiona", ten sam realny etap co oferta_wysłana)
  of_przedst: {
    label: "of_przedst",
    color: "text-lime-950",
    bg: "bg-lime-400 dark:bg-lime-500",
    border: "border-lime-500 dark:border-lime-600",
    icon: Send,
    shadow: "shadow-lime-200",
  },

  // 4. CHŁODNIA (ZAMROŻONE) -> SLATE (paleta Aliny: szary jasny)
  "rez po ofercie_kont za rok": {
    label: "rez po ofercie_kont za rok",
    color: "text-slate-900",
    bg: "bg-slate-300 dark:bg-slate-400",
    border: "border-slate-400 dark:border-slate-500",
    icon: Snowflake,
    shadow: "shadow-slate-200",
  },

  // 5. ODRZUCONE / UCIĘTE -> AMBER/BRĄZ (paleta Aliny: brązowy/ochra)
  "ucięty kontakt": {
    label: "ucięty kontakt",
    color: "text-white",
    bg: "bg-amber-600 dark:bg-amber-700",
    border: "border-amber-700 dark:border-amber-800",
    icon: XCircle,
    shadow: "shadow-amber-200",
  },

  // 6. SUKCES (SPRZEDAŻ) -> GREEN (paleta Aliny: zielony - sukces sprzedaży)
  sprzedaż: {
    label: "sprzedaż",
    color: "text-white",
    bg: "bg-green-500 dark:bg-green-600",
    border: "border-green-600 dark:border-green-700",
    icon: CheckCircle2,
    shadow: "shadow-green-200",
  },
  // UWAGA: "sprzedany" != "sprzedaż" w palecie Aliny (dwa różne statusy, nie zlewać):
  // "sprzedaż"  = polisa sprzedana (sukces Aliny)              -> ZIELONY
  // "sprzedany" = klient sprzedał AUTO / polisa nieaktualna    -> FIOLETOWY, biały tekst
  // Logika isSold (ClientDetails/Dashboard/ClientsList) nadal grupuje oba stany razem
  // do liczenia "sprzedanych polis" - to NIE jest zmieniane tutaj (tylko kolorystyka).
  sprzedany: {
    label: "sprzedany",
    color: "text-white dark:text-white",
    bg: "bg-violet-700 dark:bg-violet-600",
    border: "border-violet-800 dark:border-violet-500",
    icon: PauseCircle,
    shadow: "shadow-violet-200",
  },

  // Fallbacks (spoza oryginalnej 9-elementowej listy Aliny)
  zbycie_pojazdu: {
    label: "Zbycie",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-900/20",
    border: "border-orange-200 dark:border-orange-800",
    icon: MessageSquare,
  },
  inne: {
    label: "Inne",
    color: "text-zinc-500 dark:text-zinc-400",
    bg: "bg-zinc-100 dark:bg-zinc-800/40",
    border: "border-zinc-200 dark:border-zinc-700",
    icon: BadgeHelp,
  },
};

// --- DESIGNER CZCIONEK (2026-07-25) ---
// 4 rodziny czcionek dostępne w Ustawieniach → Personalizacja czcionki.
// Wyłącznie czcionki systemowe / już samo-hostowane w projekcie (@fontsource-variable/inter)
// — ŻADNYCH zewnętrznych CDN (offline/CSP), zgodnie z DESIGN_SYSTEM.md.
export const FONT_FAMILY_OPTIONS: Record<
  "system" | "humanist" | "serif" | "accessible",
  { label: string; description: string; stack: string }
> = {
  system: {
    label: "Systemowa",
    description: "Domyślna czcionka systemu (Windows/macOS)",
    stack:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  humanist: {
    label: "Inter",
    description: "Humanistyczna sans-serif, dobra do liczb",
    stack: '"Inter Variable", ui-sans-serif, system-ui, sans-serif',
  },
  serif: {
    label: "Georgia",
    description: "Szeryfowa, klasyczna, dobra do dłuższego czytania",
    stack: 'Georgia, "Times New Roman", serif',
  },
  accessible: {
    label: "Duża czytelność",
    description: "Tahoma — szerokie znaki, wysoka czytelność",
    stack: 'Tahoma, Verdana, "Segoe UI", sans-serif',
  },
};
