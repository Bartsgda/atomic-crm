import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  ShieldAlert,
  FileWarning,
  ArrowRight,
  Stamp,
  Car,
  Home,
  User,
  Info,
  Banknote,
} from "lucide-react";
import { Policy, Client, TerminationBasis } from "../types";

export type TerminationReason =
  | "koniec_okresu"
  | "zbycie_pojazdu"
  | "podwojne_oc"
  | "inne";

export interface TerminationConfirmPayload {
  actualDate: string;
  reason: TerminationReason;
  /** Tylko gdy reason === 'zbycie_pojazdu' */
  saleDate?: string;
  /** Tylko gdy reason === 'zbycie_pojazdu' (może być undefined jeśli Alina zostawi puste) */
  commissionCorrection?: number;
}

interface Props {
  policy: Policy;
  client: Client;
  onConfirm: (payload: TerminationConfirmPayload) => void;
  onCancel: () => void;
}

const REASON_OPTIONS: { value: TerminationReason; label: string }[] = [
  { value: "koniec_okresu", label: "Koniec okresu ubezpieczenia (Art. 28)" },
  {
    value: "zbycie_pojazdu",
    label: "Zbycie pojazdu — sprzedaż auta (Art. 31)",
  },
  { value: "podwojne_oc", label: "Podwójne OC (Art. 28a)" },
  { value: "inne", label: "Inne" },
];

// Powód wypowiedzenia -> podstawa prawna (Policy.terminationBasis), żeby TerminationPreview.tsx
// (PDF) automatycznie dobrał właściwy artykuł. Współdzielone przez WSZYSTKIE miejsca, które
// obsługują onConfirm z tego modala (ClientDetails.tsx, PolicyFormModal.tsx) - jedno źródło
// prawdy, nie duplikować mapowania.
export const terminationBasisFromReason = (
  reason: TerminationReason,
): TerminationBasis => {
  switch (reason) {
    case "zbycie_pojazdu":
      return TerminationBasis.ART_31;
    case "podwojne_oc":
      return TerminationBasis.ART_28A;
    case "koniec_okresu":
      return TerminationBasis.ART_28;
    default:
      return TerminationBasis.OTHER;
  }
};

const getIcon = (type: string) => {
  if (["OC", "AC", "BOTH"].includes(type)) return Car;
  if (type === "DOM") return Home;
  return User;
};

// Sugestia proporcjonalna: commission * (dni od startu do sprzedaży) / (dni od startu do końca).
// Clamp do [0, commission]. Braki danych -> 0 (nie wywala).
function suggestProportionalCommission(
  policy: Policy,
  saleDate: string,
): number {
  if (
    !policy.commission ||
    !policy.policyStartDate ||
    !policy.policyEndDate ||
    !saleDate
  )
    return 0;
  const start = new Date(policy.policyStartDate).getTime();
  const end = new Date(policy.policyEndDate).getTime();
  const sale = new Date(saleDate).getTime();
  if (!isFinite(start) || !isFinite(end) || !isFinite(sale) || end <= start)
    return 0;

  const totalDays = (end - start) / 86400000;
  let usedDays = (sale - start) / 86400000;
  if (usedDays < 0) usedDays = 0;
  if (usedDays > totalDays) usedDays = totalDays;

  const raw = policy.commission * (usedDays / totalDays);
  const clamped = Math.min(Math.max(raw, 0), policy.commission);
  return Math.round(clamped * 100) / 100;
}

export const TerminationFormModal: React.FC<Props> = ({
  policy,
  client,
  onConfirm,
  onCancel,
}) => {
  const [actualDate, setActualDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [reason, setReason] = useState<TerminationReason>("koniec_okresu");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [commissionCorrection, setCommissionCorrection] = useState<string>("");
  const [correctionTouched, setCorrectionTouched] = useState(false);
  const Icon = getIcon(policy.type);

  // Esc zamyka (2026-07-27) — ten modal bywa zagnieżdżony w PolicyFormModal (który
  // ma WŁASNY Esc wyłączony dopóki ten jest otwarty), więc tu wystarczy zamknąć siebie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const suggestedCommission = useMemo(
    () => suggestProportionalCommission(policy, saleDate),
    [policy.commission, policy.policyStartDate, policy.policyEndDate, saleDate],
  );

  // Dopóki Alina nie nadpisała ręcznie -> wartość startowa/na-żywo = sugestia proporcjonalna.
  useEffect(() => {
    if (reason === "zbycie_pojazdu" && !correctionTouched) {
      setCommissionCorrection(
        suggestedCommission > 0 ? String(suggestedCommission) : "",
      );
    }
  }, [reason, suggestedCommission, correctionTouched]);

  const handleConfirm = () => {
    if (reason === "zbycie_pojazdu") {
      const parsed = parseFloat(commissionCorrection.replace(",", "."));
      onConfirm({
        actualDate,
        reason,
        saleDate,
        commissionCorrection: isFinite(parsed) ? parsed : undefined,
      });
    } else {
      onConfirm({ actualDate, reason });
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
        onClick={onCancel}
      ></div>

      <div className="bg-white dark:bg-zinc-900 rounded-[1.75rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide animate-in zoom-in-95 duration-200 border-2 border-zinc-100 dark:border-zinc-800 relative z-10 flex flex-col">
        {/* Header - Serious Red Tone */}
        <div className="bg-gradient-to-br from-red-50 to-white dark:from-red-900/20 dark:to-zinc-900 p-6 border-b border-red-100 dark:border-red-900/30 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
                Rejestracja
                <br />
                Wypowiedzenia
              </h3>
            </div>
            <p className="text-[10px] font-bold text-red-600/80 uppercase tracking-widest pl-1">
              Procedura Zatrzymania Wznowienia
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 bg-white dark:bg-zinc-800 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-400 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Policy Summary Card */}
          <div className="bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Icon size={64} className="text-zinc-900 dark:text-white" />
            </div>

            <div className="relative z-10">
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">
                Przedmiot Wypowiedzenia
              </p>
              <h4 className="text-lg font-black text-zinc-900 dark:text-white leading-tight">
                {policy.vehicleBrand || policy.propertyAddress || policy.type}
              </h4>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-1 rounded text-[10px] font-bold text-zinc-600 dark:text-zinc-300 font-mono uppercase">
                  {policy.vehicleReg || policy.policyNumber}
                </span>
                <span className="text-[10px] text-zinc-500 font-bold">
                  {policy.insurerName}
                </span>
              </div>
            </div>
          </div>

          {/* Reason Select */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 flex items-center gap-2 pl-1">
              <ShieldAlert size={14} className="text-red-600" /> Podstawa /
              Powód
            </label>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as TerminationReason);
                setCorrectionTouched(false);
              }}
              className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20 transition-all cursor-pointer"
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Input */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 mb-2 flex items-center gap-2 pl-1">
              <Calendar size={14} className="text-red-600" /> Data złożenia /
              Nadania
            </label>
            <div className="relative group">
              <input
                type="date"
                value={actualDate}
                onChange={(e) => setActualDate(e.target.value)}
                className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 rounded-2xl text-lg font-black text-zinc-900 dark:text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-50 dark:focus:ring-red-900/20 transition-all cursor-pointer"
                onClick={(e) => e.currentTarget.showPicker()}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400 group-hover:text-red-500 transition-colors">
                <Stamp size={20} />
              </div>
            </div>
            <div className="flex gap-2 mt-3 px-2">
              <Info size={14} className="text-blue-500 flex-shrink-0" />
              <p className="text-[10px] font-medium text-zinc-500 leading-relaxed">
                Data systemowa operacji zostanie zapisana jako{" "}
                <strong>Dzisiaj</strong>. Data powyżej to data widniejąca na
                dokumencie (stemplu pocztowym), ważna dla biegu terminów (np. 1
                dzień przed końcem).
              </p>
            </div>
          </div>

          {/* ZBYCIE POJAZDU — pola dodatkowe */}
          {reason === "zbycie_pojazdu" && (
            <div className="p-4 bg-violet-50 dark:bg-violet-900/10 border-2 border-violet-100 dark:border-violet-900/30 rounded-2xl space-y-4 animate-in fade-in duration-200">
              <div>
                <label className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-2 pl-1">
                  <Calendar size={14} /> Data sprzedaży auta
                </label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-violet-200 dark:border-violet-800 rounded-2xl text-lg font-black text-zinc-900 dark:text-white outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 dark:focus:ring-violet-900/20 transition-all cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker()}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-violet-700 dark:text-violet-300 mb-2 flex items-center gap-2 pl-1">
                  <Banknote size={14} /> Skorygowana prowizja (PLN)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={commissionCorrection}
                  onChange={(e) => {
                    setCorrectionTouched(true);
                    setCommissionCorrection(e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-full p-4 bg-white dark:bg-zinc-800 border-2 border-violet-200 dark:border-violet-800 rounded-2xl text-lg font-black text-zinc-900 dark:text-white outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-50 dark:focus:ring-violet-900/20 transition-all"
                />
                <p className="text-[10px] font-medium text-violet-600 dark:text-violet-400 leading-relaxed mt-2 px-1">
                  Sugerowane z proporcji za wykorzystany okres — wpisz faktyczną
                  kwotę z rozliczenia towarzystwa.
                </p>
              </div>

              <div className="flex gap-2 px-1">
                <Info
                  size={14}
                  className="text-violet-500 flex-shrink-0 mt-0.5"
                />
                <p className="text-[10px] font-medium text-violet-700 dark:text-violet-400 leading-relaxed">
                  Polisa dostanie status <strong>„Sprzedany"</strong> (auto
                  zbyte) i zniknie z propozycji wznowień. Przychód z pierwotnej
                  sprzedaży zostaje w finansach — liczy się skorygowana kwota
                  zamiast pełnej prowizji.
                </p>
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl flex gap-3 items-center">
            <FileWarning size={20} className="text-red-600 flex-shrink-0" />
            <p className="text-[10px] font-bold text-red-800 dark:text-red-300 leading-tight">
              Akcja zablokuje automatyczne wznowienie tej polisy w systemie i
              ustawi status <strong>"Wypowiedziane"</strong>.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-900 hover:bg-white border border-transparent hover:border-zinc-200 transition-all"
          >
            Anuluj
          </button>
          <button
            onClick={handleConfirm}
            className="flex-[2] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl hover:bg-black dark:hover:bg-zinc-200"
          >
            Zatwierdź w Rejestrze <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
