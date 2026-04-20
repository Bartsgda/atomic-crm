
import React, { useMemo, useState } from 'react';
import { AppState, InsurerConfig } from '../types';
import { FileSpreadsheet, Download, Search, Database, Layers, Users } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { ReverseMapper } from '../services/reverseMapper';
import { INSURERS } from '../towarzystwa';
import { roundCurrency } from '../modules/utils/currencyUtils';

interface Props {
  state: AppState;
}

const POLICY_COLUMNS = [
    { id: 0, label: 'Imię i nazwisko', width: 'min-w-[200px]' },
    { id: 1, label: 'kontakt / sprzedaż', width: 'min-w-[120px]' },
    { id: 2, label: 'etap', width: 'min-w-[150px]' },
    { id: 3, label: 'kol kont', width: 'min-w-[120px]' },
    { id: 4, label: 'nr tel', width: 'min-w-[120px]' },
    { id: 5, label: '@', width: 'min-w-[150px]' },
    { id: 6, label: 'adres', width: 'min-w-[250px]' },
    { id: 7, label: 'pesel nip regon', width: 'min-w-[120px]' },
    { id: 8, label: 'co (produkt)', width: 'min-w-[200px]' },
    { id: 9, label: 'start polisy', width: 'min-w-[120px]' },
    { id: 10, label: 'nr pol', width: 'min-w-[150px]' },
    { id: 11, label: 'gdzie (TU)', width: 'min-w-[100px]' },
    { id: 12, label: 'przyp (składka)', width: 'min-w-[100px]' },
    { id: 13, label: 'kogo (źródło)', width: 'min-w-[100px]' },
    { id: 14, label: 'prow (agent)', width: 'min-w-[100px]' },
    { id: 15, label: 'rozl (pośrednik)', width: 'min-w-[100px]' },
    { id: 16, label: 'stara składka', width: 'min-w-[100px]' }, 
    { id: 17, label: 'stara polisa', width: 'min-w-[150px]' }, 
    { id: 18, label: 'współwł.', width: 'min-w-[150px]' }, 
    { id: 19, label: 'notatki', width: 'min-w-[400px]' },
    { id: 20, label: 'dok', width: 'min-w-[80px]' }, 
    { id: 21, label: 'załączono', width: 'min-w-[80px]' }, 
    { id: 22, label: 'płatność', width: 'min-w-[100px]' }
];

const POLICY_SYSTEM_HEADERS = {
    30: 'SYS_CLIENT_ID',
    31: 'SYS_POLICY_ID',
    32: 'SYS_FULL_CLIENT_JSON',
    33: 'SYS_FULL_POLICY_JSON',
    34: 'SYS_FULL_NOTES_JSON'
};

const CLIENT_COLUMNS = [
    'ID (System)', 'Imię', 'Nazwisko', 'PESEL/NIP', 'Telefony', 'E-maile', 'Ulica', 'Kod Poczt.', 'Miasto', 'Notatki (Klienta)', 'JSON Backup', 'JSON Notes'
];

const SUBAGENT_COLUMNS = [
    'ID (System)', 'Nazwa', 'Telefon', 'Email', 'Stawki Domyślne (JSON)', 'SUMA (Historia)'
];

const INSURER_COLUMNS = [
    'ID (Nazwa)', 'Pełna Nazwa Prawna', 'Adres', 'Kod Pocztowy', 'Miasto', 'Opiekun (Imię Nazwisko)', 'Telefon Opiekuna', 'Email Opiekuna', 'Infolinia / Helpdesk'
];

// Helper to convert index to Column Letter (0 -> A, 8 -> I)
const getColLetter = (colIndex: number) => {
    return String.fromCharCode(65 + colIndex);
};

const SMART_SHEETS_CONFIG = [
    {
        name: 'POJAZDY',
        keywords: ['samochód', 'pojazd', 'auto', 'motocykl', 'skuter', 'quad', 'przyczepa', 'naczepa', 'ciągnik', 'autobus', 'oc ', 'ac ', 'pakiet', 'toyota', 'bmw', 'audi', 'opel', 'ford']
    },
    {
        name: 'MAJATEK',
        keywords: ['dom', 'mieszkanie', 'lokal', 'budowa', 'nieruchomość', 'garaż', 'domek', 'majątek', 'ogień']
    },
    {
        name: 'ZYCIE',
        keywords: ['życie', 'zycie', 'nnw', 'szpital', 'śmierć', 'zdrowie', 'grupow']
    },
    {
        name: 'PODROZ',
        keywords: ['podróż', 'podroz', 'wyjazd', 'turyst', 'narty', 'kl']
    }
];

export const RawDataView: React.FC<Props> = ({ state }) => {
    const [filter, setFilter] = useState('');

    const policyRows = useMemo(() => {
        if (!state || !state.policies) return [];

        return state.policies.map(policy => {
            const client = state.clients?.find(c => c.id === policy.clientId);
            const notes = (state.notes || [])
                .filter(n => n.linkedPolicyIds?.includes(policy.id) || n.clientId === policy.clientId);

            let subAgentName = undefined;
            if (policy.subAgentId) {
                const sa = state.subAgents?.find(a => a.id === policy.subAgentId);
                if (sa) subAgentName = sa.name;
            } else if (policy.subAgentSplits?.[0]?.agentId) {
                const sa = state.subAgents?.find(a => a.id === policy.subAgentSplits[0].agentId);
                if (sa) subAgentName = sa.name;
            }

            return ReverseMapper.mapPolicyToRow(policy, client, notes, subAgentName);
        });
    }, [state?.policies, state?.clients, state?.notes, state?.subAgents]);

    const clientRows = useMemo(() => {
        if (!state || !state.clients) return [];
        return state.clients.map(client => {
            // Find notes that belong to this client BUT are NOT linked to any policy
            const unlinkedNotes = (state.notes || []).filter(n => 
                n.clientId === client.id && 
                (!n.linkedPolicyIds || n.linkedPolicyIds.length === 0)
            );
            return ReverseMapper.mapClientToRow(client, unlinkedNotes);
        });
    }, [state?.clients, state?.notes]);

    const filteredPolicyRows = policyRows.filter(r => 
        r.slice(0, 23).some((cell: any) => cell && String(cell).toLowerCase().includes(filter.toLowerCase()))
    );

    const handleExport = () => {
        const wb = XLSX.utils.book_new();

        // --- SHEET 1: KLIENCI (MASTER DATA) ---
        const clientData = [CLIENT_COLUMNS, ...clientRows];
        const wsClients = XLSX.utils.aoa_to_sheet(clientData);
        XLSX.utils.book_append_sheet(wb, wsClients, "KLIENCI");

        // --- SHEET 2: POLISY (TRANSACTIONS) ---
        const policyHeader: string[] = [];
        POLICY_COLUMNS.forEach(col => policyHeader[col.id] = col.label);
        for(let i=23; i<30; i++) policyHeader[i] = `(buffer_${i})`;
        Object.entries(POLICY_SYSTEM_HEADERS).forEach(([idx, label]) => {
            policyHeader[parseInt(idx)] = label;
        });

        const policyData = [policyHeader, ...filteredPolicyRows];
        const wsPolicies = XLSX.utils.aoa_to_sheet(policyData);
        
        // Auto-width for policies
        const wscols = policyHeader.map((_, i) => {
            if (i >= 30) return { hidden: true }; 
            return { wch: 15 };
        });
        wscols[0] = { wch: 25 }; 
        wscols[6] = { wch: 30 }; 
        wscols[8] = { wch: 40 }; 
        wscols[19] = { wch: 50 }; 
        wsPolicies['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, wsPolicies, "POLISY");

        // --- SHEETS 3-6: INTELIGENTNE ARKUSZE (SMART FORMULAS) ---
        SMART_SHEETS_CONFIG.forEach(sheetConfig => {
            const sheetRows: any[][] = [];
            sheetRows.push(policyHeader.slice(0, 23)); 

            for (let r = 2; r <= 201; r++) { 
                const rowData: any[] = [];
                const conditions = sheetConfig.keywords.map(kw => 
                    `ISNUMBER(SEARCH("${kw}", 'POLISY'!$I${r}))`
                ).join(',');
                const logicTest = `OR(${conditions})`;

                for (let c = 0; c < 23; c++) {
                    const colLetter = getColLetter(c);
                    const formula = `IF(${logicTest}, 'POLISY'!${colLetter}${r}, "")`;
                    rowData.push({ t: 'n', f: formula, v: undefined }); 
                }
                sheetRows.push(rowData);
            }

            const wsSmart = XLSX.utils.aoa_to_sheet(sheetRows);
            wsSmart['!cols'] = wscols.slice(0, 23); 
            XLSX.utils.book_append_sheet(wb, wsSmart, sheetConfig.name);
        });


        // --- SHEET 7: POSREDNICY (SUB AGENTS & FINANCIAL REPORT) ---
        const subAgents = state.subAgents || [];
        
        // 1. Generate Month Headers (2025.01 - 2026.12)
        const years = [2025, 2026];
        const monthKeys: string[] = [];
        years.forEach(y => {
            for(let m=1; m<=12; m++) {
                monthKeys.push(`${y}.${m.toString().padStart(2, '0')}`);
            }
        });

        // 2. Pre-Calculate Totals per Agent per Month
        const agentStats: Record<string, Record<string, number>> = {};
        
        // Init stats
        subAgents.forEach(sa => {
            agentStats[sa.id] = {};
            monthKeys.forEach(k => agentStats[sa.id][k] = 0);
        });

        // Fill stats
        state.policies.forEach(p => {
            if (p.stage !== 'sprzedaż') return; // Only sold policies count
            
            const d = new Date(p.createdAt);
            const key = `${d.getFullYear()}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            
            // Check legacy commission
            if (p.subAgentId && agentStats[p.subAgentId]) {
                const val = parseFloat(String(p.subAgentCommission)) || 0;
                if (agentStats[p.subAgentId][key] !== undefined) {
                    agentStats[p.subAgentId][key] += val;
                }
            }
            
            // Check new splits
            if (p.subAgentSplits) {
                p.subAgentSplits.forEach(split => {
                    if (agentStats[split.agentId]) {
                        const val = parseFloat(String(split.amount)) || 0;
                        if (agentStats[split.agentId][key] !== undefined) {
                            agentStats[split.agentId][key] += val;
                        }
                    }
                });
            }
        });

        // 3. Build Rows
        const subAgentData = subAgents.map(sa => {
            const stats = agentStats[sa.id] || {};
            const monthlyValues = monthKeys.map(k => roundCurrency(stats[k] || 0));
            const totalSum = roundCurrency(monthlyValues.reduce((a, b) => a + b, 0));

            return [
                sa.id,
                sa.name,
                sa.phone || '',
                sa.email || '',
                JSON.stringify(sa.defaultRates || {}),
                totalSum, // SUMA CAŁKOWITA
                ...monthlyValues
            ];
        });

        const wsSubAgents = XLSX.utils.aoa_to_sheet([
            [...SUBAGENT_COLUMNS, ...monthKeys], // Header
            ...subAgentData
        ]);
        XLSX.utils.book_append_sheet(wb, wsSubAgents, "POSREDNICY");

        // --- SHEET 8: TOWARZYSTWA (INSURERS) ---
        const userConfigs = state.insurerConfigs || {};
        const activeNames = new Set(state.insurers || []);
        
        const staticRows = INSURERS.map(i => {
            const config = userConfigs[i.name] || {} as Partial<InsurerConfig>;
            return [
                i.name,
                i.currentLegalEntity,
                i.address,
                i.zipCode,
                i.city,
                config.managerName || '',
                config.managerPhone || '',
                config.managerEmail || '',
                config.helpdeskPhone || i.email || ''
            ];
        });

        const customRows = (state.insurers || [])
            .filter(name => !INSURERS.some(i => i.name === name))
            .map(name => {
                const config = userConfigs[name] || {} as Partial<InsurerConfig>;
                return [
                    name,
                    'Wpis niestandardowy',
                    '', '', '', // Address empty
                    config.managerName || '',
                    config.managerPhone || '',
                    config.managerEmail || '',
                    config.helpdeskPhone || ''
                ];
            });

        const allInsurerRows = [...staticRows, ...customRows].sort((a,b) => a[0].localeCompare(b[0]));
        const wsInsurers = XLSX.utils.aoa_to_sheet([INSURER_COLUMNS, ...allInsurerRows]);
        XLSX.utils.book_append_sheet(wb, wsInsurers, "TOWARZYSTWA");
        
        // WRITE FILE
        const fileName = `Baza_CRM_Master_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    if (!state) return <div className="p-10 text-center text-zinc-500">Wczytywanie bazy...</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950 font-mono text-xs overflow-hidden">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-10 h-10 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-lg flex-shrink-0">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                            XLSX Master View <span className="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full border border-emerald-200">Relational v4.0</span>
                        </h1>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                            {filteredPolicyRows.length} Polis • {clientRows.length} Klientów • {state.subAgents?.length || 0} Pośredników
                        </p>
                    </div>
                </div>

                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Szukaj (polisy)..."
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-500 font-medium"
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-colors shadow-sm whitespace-nowrap"
                    >
                        <Download size={14} /> Eksportuj (8 Arkuszy)
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-zinc-950 relative">
                <table className="border-collapse w-max min-w-full">
                    <thead className="sticky top-0 z-10 bg-zinc-100 dark:bg-zinc-900 shadow-sm">
                        <tr>
                            <th className="p-0 border-r border-b border-zinc-300 dark:border-zinc-700 w-10 bg-zinc-200 dark:bg-zinc-800 text-center text-zinc-500">
                                #
                            </th>
                            {POLICY_COLUMNS.map((col) => (
                                <th 
                                    key={col.id} 
                                    className={`p-2 border-r border-b border-zinc-300 dark:border-zinc-700 text-left font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-tight text-[10px] whitespace-nowrap overflow-hidden ${col.width}`}
                                >
                                    <div className="flex justify-between items-center">
                                        {col.label}
                                        <span className="text-[8px] text-zinc-400 font-mono ml-2">[{col.id}]</span>
                                    </div>
                                </th>
                            ))}
                            <th className="p-2 border-b border-zinc-300 dark:border-zinc-700 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest min-w-[300px]">
                                <div className="flex items-center gap-2"><Layers size={12}/> STREFA SYSTEMOWA (30+)</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {filteredPolicyRows.map((row: any[], rowIdx: number) => (
                            <tr key={rowIdx} className="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group">
                                <td className="p-2 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-center text-zinc-400 font-mono select-none">
                                    {rowIdx + 1}
                                </td>
                                {row.slice(0, 23).map((cell: any, cellIdx: number) => (
                                    <td 
                                        key={cellIdx} 
                                        className={`p-2 border-r border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px] border-b border-transparent group-hover:border-zinc-200 dark:group-hover:border-zinc-700 font-mono ${cellIdx === 19 ? 'italic text-[10px] text-zinc-500' : ''}`}
                                        title={String(cell)}
                                    >
                                        {cell}
                                    </td>
                                ))}
                                <td className="p-2 bg-zinc-50 dark:bg-zinc-950 border-b border-transparent font-mono text-[9px] text-zinc-400 truncate max-w-[300px]">
                                    {`REF: ${row[30]} | POLICY: ${row[31]}`}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-2 px-4 flex justify-between items-center text-[10px] text-zinc-500 font-mono shrink-0">
                <span className="flex items-center gap-2"><Users size={12}/> Generowane arkusze: KLIENCI, POLISY + 4 Inteligentne Filtry + Słowniki (Rozliczenie).</span>
                <span>Relacyjna Baza Danych v4.6</span>
            </div>
        </div>
    );
};
