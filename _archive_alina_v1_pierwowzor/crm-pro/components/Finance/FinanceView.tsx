
import React, { useMemo, useState } from 'react';
import { AppState, Policy } from '../../types';
import { 
    Wallet, TrendingUp, TrendingDown, Users, Calendar, 
    ChevronLeft, ChevronRight, BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Target, AlertCircle
} from 'lucide-react';
import { format, endOfMonth, eachMonthOfInterval, isSameMonth, getYear, isSameYear } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { roundCurrency } from '../../modules/utils/currencyUtils';

interface Props {
    state: AppState;
}

export const FinanceView: React.FC<Props> = ({ state }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

    // --- DATA PROCESSING ENGINE ---
    const yearlyData = useMemo(() => {
        // 1. Generate 12 months for selected year
        const months = Array.from({ length: 12 }, (_, i) => i);

        // 2. Aggregate Data
        const stats = months.map(monthIdx => {
            const monthStart = new Date(selectedYear, monthIdx, 1);
            
            // Filters
            const policiesInMonth = state.policies.filter(p => {
                const d = new Date(p.createdAt); // Używamy daty utworzenia
                return d.getMonth() === monthIdx && d.getFullYear() === selectedYear;
            });

            let revenueGross = 0; // Całość (Ty + Partner)
            let costPartners = 0; // Partnerzy
            let incomeNet = 0;    // Ty (Na rękę)
            
            let potentialLost = 0; // Prowizja utracona (Odrzuty)

            let countSold = 0;
            let countLost = 0;
            let countOpen = 0;

            policiesInMonth.forEach(p => {
                // Konwersja bezpieczna
                const commission = roundCurrency(typeof p.commission === 'number' ? p.commission : parseFloat(String(p.commission)) || 0);
                const premium = roundCurrency(typeof p.premium === 'number' ? p.premium : parseFloat(String(p.premium)) || 0);
                const subComm = roundCurrency(typeof p.subAgentCommission === 'number' ? p.subAgentCommission : parseFloat(String(p.subAgentCommission)) || 0);

                // Kalkulacja Finansowa
                const agentPart = commission;
                
                let partnerPart = 0;
                if (p.subAgentSplits && p.subAgentSplits.length > 0) {
                    partnerPart = p.subAgentSplits.reduce((acc, s) => acc + (parseFloat(String(s.amount)) || 0), 0);
                } else {
                    partnerPart = subComm;
                }
                partnerPart = roundCurrency(partnerPart);

                // Logika Statusów
                if (p.stage === 'sprzedaż' || p.stage === 'sprzedany') {
                    revenueGross += (agentPart + partnerPart);
                    costPartners += partnerPart;
                    incomeNet += agentPart;
                    countSold++;
                } else if (p.stage === 'ucięty kontakt' || p.stage === 'rez po ofercie_kont za rok') {
                    // Szacujemy utraconą prowizję (Agenta)
                    const lostVal = agentPart > 0 ? agentPart : (premium * 0.15);
                    potentialLost += lostVal;
                    countLost++;
                } else {
                    // Otwarte
                    countOpen++;
                }
            });

            const totalOffers = countSold + countLost + countOpen;
            const conversionRate = totalOffers > 0 ? Math.round((countSold / totalOffers) * 100) : 0;

            return {
                monthName: format(monthStart, 'LLL', { locale: pl }),
                fullMonthName: format(monthStart, 'MMMM', { locale: pl }),
                revenueGross: roundCurrency(revenueGross),
                costPartners: roundCurrency(costPartners),
                incomeNet: roundCurrency(incomeNet),
                potentialLost: roundCurrency(potentialLost),
                countSold,
                countLost,
                countOpen,
                totalOffers,
                conversionRate
            };
        });

        // 3. Yearly Totals
        const totalNet = roundCurrency(stats.reduce((acc, s) => acc + s.incomeNet, 0));
        const totalCost = roundCurrency(stats.reduce((acc, s) => acc + s.costPartners, 0));
        const totalGross = roundCurrency(stats.reduce((acc, s) => acc + s.revenueGross, 0));
        const totalPotential = roundCurrency(stats.reduce((acc, s) => acc + s.potentialLost, 0));
        
        // Find max value for chart scaling
        const maxChartValue = Math.max(...stats.map(s => s.incomeNet + s.potentialLost), 1000); 

        return { stats, totalNet, totalCost, totalGross, totalPotential, maxChartValue };
    }, [state.policies, selectedYear]);

    return (
        <div className="p-6 md:p-10 min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans flex flex-col">
            
            {/* --- HEADER & NAVIGATION --- */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
                <div>
                    <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-3">
                        <BarChart3 className="text-emerald-600" size={32} />
                        Wyniki Finansowe
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2 ml-1">
                        Analiza Rentowności i Konwersji
                    </p>
                </div>

                <div className="flex items-center bg-white dark:bg-zinc-900 p-1.5 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800">
                    <button onClick={() => setSelectedYear(y => y - 1)} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="px-6 text-center">
                        <span className="block text-xs font-black uppercase text-zinc-400 tracking-widest">Rok Obrotowy</span>
                        <span className="block text-2xl font-black text-zinc-900 dark:text-white tabular-nums">{selectedYear}</span>
                    </div>
                    <button onClick={() => setSelectedYear(y => y + 1)} className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* --- SUMMARY CARDS (YEARLY) --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {/* 1. NET INCOME (THE KING) */}
                <div className="bg-emerald-600 text-white p-6 rounded-[2rem] shadow-xl shadow-emerald-900/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Wallet size={80} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-emerald-100 tracking-widest mb-1">Zysk Netto (Na rękę)</p>
                    <h2 className="text-4xl font-black tracking-tighter">
                        {yearlyData.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-lg opacity-60">PLN</span>
                    </h2>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold bg-white/20 w-fit px-2 py-1 rounded-lg backdrop-blur-sm">
                        <ArrowUpRight size={12} /> Twój Czysty Zysk
                    </div>
                </div>

                {/* 2. COSTS (PARTNERS) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative group">
                    <div className="absolute top-4 right-4 text-zinc-200 dark:text-zinc-800 group-hover:text-blue-100 dark:group-hover:text-blue-900 transition-colors">
                        <Users size={32} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Koszty Pośredników</p>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                        {yearlyData.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-base text-zinc-400">PLN</span>
                    </h2>
                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">Prowizje wypłacone partnerom</p>
                </div>

                {/* 3. GROSS REVENUE */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative group">
                    <div className="absolute top-4 right-4 text-zinc-200 dark:text-zinc-800">
                        <TrendingUp size={32} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Przychód Brutto (Total)</p>
                    <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                        {yearlyData.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-base text-zinc-400">PLN</span>
                    </h2>
                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">Suma przypisu prowizji od TU</p>
                </div>

                {/* 4. LOST OPPORTUNITY */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative group border-t-4 border-t-amber-400">
                    <div className="absolute top-4 right-4 text-amber-100 dark:text-amber-900/30">
                        <TrendingDown size={32} />
                    </div>
                    <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Utracony Potencjał</p>
                    <h2 className="text-3xl font-black text-zinc-400 tracking-tighter decoration-amber-300 decoration-2 line-through">
                        {yearlyData.totalPotential.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-base">PLN</span>
                    </h2>
                    <p className="text-[10px] text-zinc-400 mt-2 font-medium">Wartość odrzuconych ofert</p>
                </div>
            </div>

            {/* --- MAIN CHART AREA --- */}
            <div className="flex-1 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl p-8 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                        <Calendar size={20} className="text-zinc-400"/> Roczny Wykres Sprzedaży
                    </h3>
                    
                    <div className="flex gap-4 text-[10px] font-bold uppercase">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                            <span className="text-zinc-500">Zysk Netto</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-sm border border-zinc-200 dark:border-zinc-700"></div>
                            <span className="text-zinc-400">Utracone</span>
                        </div>
                    </div>
                </div>

                {/* NO DATA STATE */}
                {yearlyData.totalGross === 0 && yearlyData.totalPotential === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                        <div className="text-center opacity-30">
                            <BarChart3 size={64} className="mx-auto mb-4 text-zinc-400"/>
                            <p className="text-xl font-black text-zinc-500 uppercase">Brak danych finansowych</p>
                            <p className="text-sm font-medium text-zinc-400">Dla roku {selectedYear}</p>
                        </div>
                    </div>
                )}

                {/* CHART CONTAINER - FIXED LAYOUT */}
                <div className="flex-1 flex items-stretch justify-between gap-2 md:gap-4 relative z-10 min-h-[300px]">
                    {/* Y-Axis Grid Lines (Background) */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-50 z-0">
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 border-t border-dashed border-zinc-200 dark:border-zinc-700"></div>
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 border-t border-dashed border-zinc-200 dark:border-zinc-700"></div>
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 border-t border-dashed border-zinc-200 dark:border-zinc-700"></div>
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-800 border-t border-dashed border-zinc-200 dark:border-zinc-700"></div>
                    </div>

                    {yearlyData.stats.map((month, idx) => {
                        // Calculate Heights (%)
                        const netHeight = Math.min((month.incomeNet / yearlyData.maxChartValue) * 100, 100);
                        const lostHeight = Math.min((month.potentialLost / yearlyData.maxChartValue) * 100, 100);
                        const isHovered = hoveredMonth === idx;

                        return (
                            <div 
                                key={idx} 
                                className="flex-1 flex flex-col items-center justify-end group cursor-pointer relative z-10"
                                onMouseEnter={() => setHoveredMonth(idx)}
                                onMouseLeave={() => setHoveredMonth(null)}
                            >
                                {/* HOVER TOOLTIP */}
                                {isHovered && (
                                    <div className="absolute bottom-[80%] left-1/2 -translate-x-1/2 mb-2 bg-zinc-900 text-white p-3 rounded-xl shadow-xl text-center z-50 animate-in slide-in-from-bottom-2 fade-in w-40 pointer-events-none border border-zinc-700">
                                        <p className="text-xs font-black uppercase text-zinc-400 mb-1">{month.fullMonthName}</p>
                                        <p className="text-lg font-black text-emerald-400 mb-1">+{month.incomeNet.toFixed(2)} zł</p>
                                        {month.potentialLost > 0 && <p className="text-xs font-bold text-red-400 line-through">-{month.potentialLost.toFixed(2)} zł</p>}
                                        <div className="mt-2 pt-2 border-t border-zinc-700 flex justify-between text-[9px] font-mono">
                                            <span>Sprzedaż: {month.countSold}</span>
                                            <span className="text-zinc-500">Odrzut: {month.countLost}</span>
                                        </div>
                                    </div>
                                )}

                                {/* BARS WRAPPER */}
                                <div className="w-full max-w-[60px] flex-1 flex flex-col justify-end relative pb-2">
                                    
                                    {/* Lost Bar (Stacked) */}
                                    {lostHeight > 0 && (
                                        <div 
                                            style={{ height: `${Math.max(lostHeight, 2)}%` }} 
                                            className="w-full bg-zinc-200 dark:bg-zinc-800 border-t border-zinc-300 dark:border-zinc-700 rounded-t-sm mb-0.5 opacity-60 group-hover:opacity-100 transition-all duration-300"
                                        ></div>
                                    )}
                                    
                                    {/* Net Bar (Main) */}
                                    <div 
                                        style={{ height: `${Math.max(netHeight, 2)}%` }} 
                                        className={`w-full rounded-t-lg transition-all duration-500 relative ${
                                            isHovered 
                                            ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-105' 
                                            : (month.incomeNet > 0 ? 'bg-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800')
                                        }`}
                                    >
                                        {/* Value Label inside bar if tall enough */}
                                        {netHeight > 15 && (
                                            <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-black text-emerald-100 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {month.incomeNet.toFixed(0)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* X-AXIS LABELS */}
                                <div className="h-10 text-center w-full">
                                    <p className={`text-[10px] font-black uppercase transition-colors ${isHovered ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                                        {month.monthName}
                                    </p>
                                    
                                    {/* CONVERSION PILL */}
                                    {month.countSold > 0 && (
                                        <div className="flex justify-center mt-1">
                                            <div className="px-1.5 py-0.5 rounded text-[8px] font-bold border bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-900/20 dark:border-blue-900 dark:text-blue-400 flex items-center gap-1">
                                                <Target size={8} />
                                                {month.countSold}/{month.totalOffers}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};
