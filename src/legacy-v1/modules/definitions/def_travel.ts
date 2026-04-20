
import { Plane, Map, Users, HeartPulse, Snowflake, Activity, Briefcase, FileText, Calendar, Plus, Trash2 } from 'lucide-react';
import { PolicyModuleDefinition } from '../../types/module_types';
import { COUNTRIES_DATA } from '../../data/countries';

// Helper do budowania opcji z grupami
const buildCountryOptions = () => {
    // 1. Sortowanie alfabetyczne
    const sorted = [...COUNTRIES_DATA].sort((a, b) => a.name.localeCompare(b.name));
    
    // 2. Mapowanie na opcje z grupą
    return sorted.map(c => {
        let groupLabel = 'ŚWIAT';
        
        if (c.region === 'UE') groupLabel = '🇪🇺 UNIA EUROPEJSKA (EKUZ)';
        else if (c.region === 'EUROPA') groupLabel = '🌍 EUROPA (POZOSTAŁE)';
        else if (c.region === 'AMERYKA_PN') groupLabel = '🇺🇸 AMERYKA PÓŁNOCNA (WYSOKIE KL)';
        else if (c.region === 'AZJA') groupLabel = '⛩️ AZJA';
        else if (c.region === 'AFRYKA') groupLabel = '🐫 AFRYKA';
        
        return {
            value: c.name,
            label: `${c.flag} ${c.name}`, // Flaga w nazwie dla lepszego wyglądu
            group: groupLabel
        };
    });
};

const countryOptions = buildCountryOptions();

export const TravelModuleDefinition: PolicyModuleDefinition = {
    id: 'PODROZ',
    title: 'Ubezpieczenie Turystyczne',
    icon: Plane,
    themeColor: 'rose',
    sections: [
        {
            id: 'destination',
            title: 'Kierunek i Termin',
            icon: Map,
            defaultOpen: true,
            fields: [
                {
                    id: 'duration_slider',
                    path: 'travelDetails.durationDays', 
                    type: 'slider',
                    label: 'Długość Wyjazdu',
                    width: 'w-full',
                    min: 1,
                    max: 30,
                    step: 1
                },
                {
                    id: 'zone',
                    path: 'travelDetails.zone',
                    type: 'toggle_group',
                    label: 'Strefa',
                    width: 'w-full',
                    required: true,
                    options: [
                        { value: 'EUROPA', label: 'Europa + Basen M.Ś.' },
                        { value: 'SWIAT', label: 'Świat (Bez USA)' },
                        { value: 'SWIAT_USA', label: 'Świat + USA/Kanada' }
                    ]
                },
                {
                    id: 'country',
                    path: 'destinationCountry',
                    type: 'select', 
                    label: 'Kraj Docelowy (Wybierz z listy)',
                    width: 'w-full',
                    required: true,
                    aiKey: 'kraj',
                    options: countryOptions // Tutaj wchodzi nasza lista z grupami
                }
            ]
        },
        {
            id: 'participants_list',
            title: 'Uczestnicy Wyjazdu',
            icon: Users,
            defaultOpen: true,
            fields: [
                {
                    id: 'people_table',
                    path: 'travelDetails.participants', 
                    type: 'participant_list',
                    label: 'Lista Osób Ubezpieczonych',
                    width: 'w-full'
                }
            ]
        },
        {
            id: 'scope',
            title: 'Aktywność i Ryzyka',
            icon: Activity,
            defaultOpen: true,
            fields: [
                {
                    id: 'purpose',
                    path: 'travelDetails.purpose',
                    type: 'select',
                    label: 'Cel Wyjazdu',
                    width: 'w-full',
                    options: [
                        { value: 'WYPOCZYNEK', label: 'Wypoczynek / Zwiedzanie' },
                        { value: 'PRACA', label: 'Praca Fizyczna' },
                        { value: 'SPORT', label: 'Sporty Amatorskie (Narty, Rower)' },
                        { value: 'SPORT_EXTREME', label: 'Sporty Ekstremalne / Wysokiego Ryzyka' }
                    ]
                },
                { id: 'ski', path: 'travelDetails.skiing', type: 'checkbox', label: 'Narty / Snowboard (OC + Sprzęt)', width: 'w-1/2', aiKey: 'narty' },
                { id: 'chronic', path: 'travelDetails.chronicDiseases', type: 'checkbox', label: 'Choroby Przewlekłe (Krytyczne!)', width: 'w-1/2', aiKey: 'choroby_przewlekle' },
                { id: 'alcohol', path: 'travelDetails.alcoholClause', type: 'checkbox', label: 'Klauzula Alkoholowa', width: 'w-full' }
            ]
        },
        {
            id: 'sums',
            title: 'Sumy Ubezpieczenia',
            icon: HeartPulse,
            defaultOpen: true,
            fields: [
                {
                    id: 'kl',
                    path: 'travelDetails.sumMedical',
                    type: 'number',
                    label: 'Koszty Leczenia (KL)',
                    width: 'w-1/2',
                    suffix: 'EUR',
                    required: true
                },
                {
                    id: 'participants_count_fallback',
                    path: 'travelDetails.participantsCount',
                    type: 'number',
                    label: 'Liczba Osób (Ogółem)',
                    width: 'w-1/2',
                    required: true
                }
            ]
        },
        {
            id: 'import_notes',
            title: 'Notatki / Import',
            icon: FileText,
            defaultOpen: false,
            className: 'bg-yellow-50/50 border-yellow-100',
            fields: [
                {
                    id: 'raw_import',
                    path: 'originalProductString',
                    type: 'textarea',
                    label: 'Dane źródłowe / Uwagi',
                    width: 'w-full',
                    placeholder: 'Wklej tutaj dane...',
                    aiKey: 'notatka_import'
                }
            ]
        }
    ]
};
