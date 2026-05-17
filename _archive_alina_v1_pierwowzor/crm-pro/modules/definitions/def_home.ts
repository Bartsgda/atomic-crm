
import { Home, Ruler, ShieldAlert, Key, Zap, Briefcase, Calculator, Building2, Hammer, Palmtree, BrickWall, Trees, Layers, Lock, Siren, Eye, Waves, Warehouse, FileText } from 'lucide-react';
import { PolicyModuleDefinition } from '../../types/module_types';

export const HomeModuleDefinition: PolicyModuleDefinition = {
    id: 'DOM',
    title: 'Ubezpieczenie Nieruchomości',
    icon: Home,
    themeColor: 'emerald',
    sections: [
        {
            id: 'basic_info',
            title: 'Przedmiot i Adres',
            icon: Home,
            defaultOpen: true,
            fields: [
                {
                    id: 'obj_type',
                    path: 'homeDetails.objectType',
                    type: 'toggle_group',
                    label: 'Rodzaj Obiektu',
                    width: 'w-full',
                    required: true,
                    aiKey: 'typ_domu',
                    options: [
                        { value: 'MIESZKANIE', label: 'Mieszkanie', icon: Building2 },
                        { value: 'DOM', label: 'Dom', icon: Home },
                        { value: 'BUDOWA', label: 'Budowa', icon: Hammer },
                        { value: 'LETNISKOWY', label: 'Letniskowy', icon: Palmtree }
                    ]
                },
                {
                    id: 'address',
                    path: 'propertyAddress',
                    type: 'text',
                    label: 'Adres Ubezpieczenia',
                    placeholder: 'Ulica, Numer, Kod Pocztowy, Miasto',
                    width: 'w-full',
                    required: true,
                    aiKey: 'adres'
                }
            ]
        },
        {
            id: 'tech_specs',
            title: 'Dane Techniczne',
            icon: Ruler,
            defaultOpen: true,
            fields: [
                {
                    id: 'area',
                    path: 'homeDetails.area',
                    type: 'number',
                    label: 'Powierzchnia',
                    width: 'w-1/3',
                    suffix: 'm²',
                    required: true,
                    aiKey: 'metraz'
                },
                {
                    id: 'year',
                    path: 'homeDetails.yearBuilt',
                    type: 'number',
                    label: 'Rok Budowy',
                    width: 'w-1/3',
                    placeholder: 'RRRR',
                    aiKey: 'rok_budowy'
                },
                {
                    id: 'construction',
                    path: 'homeDetails.constructionType',
                    type: 'select',
                    label: 'Konstrukcja',
                    width: 'w-1/3',
                    aiKey: 'konstrukcja',
                    options: [
                        { value: 'MUROWANA', label: 'Murowana (Niepalna)' },
                        { value: 'DREWNIANA', label: 'Drewniana (Palna)' },
                        { value: 'INNA', label: 'Mieszana' }
                    ]
                },
                {
                    id: 'photovoltaics',
                    path: 'homeDetails.photovoltaics',
                    type: 'checkbox',
                    label: 'Fotowoltaika (Panele)',
                    width: 'w-1/2',
                    aiKey: 'fotowoltaika'
                },
                {
                    id: 'garage',
                    path: 'homeDetails.outbuildingsIncluded',
                    type: 'checkbox',
                    label: 'Garaż / Budynek Gosp.',
                    width: 'w-1/2',
                    aiKey: 'garaz'
                }
            ]
        },
        {
            id: 'sums',
            title: 'Sumy Ubezpieczenia',
            icon: Calculator,
            defaultOpen: true,
            className: 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100',
            fields: [
                {
                    id: 'sum_walls',
                    path: 'homeDetails.sumWalls',
                    type: 'number',
                    label: 'Mury',
                    width: 'w-1/3',
                    suffix: 'PLN',
                    aiKey: 'suma_mury'
                },
                {
                    id: 'sum_fixed',
                    path: 'homeDetails.sumFixedElements',
                    type: 'number',
                    label: 'Elementy Stałe',
                    width: 'w-1/3',
                    suffix: 'PLN',
                    aiKey: 'suma_stale'
                },
                {
                    id: 'sum_items',
                    path: 'homeDetails.sumItems',
                    type: 'number',
                    label: 'Ruchomości Domowe',
                    width: 'w-1/3',
                    suffix: 'PLN',
                    aiKey: 'suma_ruchomosci'
                }
            ]
        },
        {
            id: 'extensions',
            title: 'Rozszerzenia i Cesja',
            icon: Zap,
            defaultOpen: false,
            fields: [
                { id: 'ext_flood', path: 'homeDetails.flood', type: 'checkbox', label: 'Powódź', width: 'w-1/2', aiKey: 'powodz' },
                { id: 'ext_theft', path: 'homeDetails.theft', type: 'checkbox', label: 'Kradzież', width: 'w-1/2', aiKey: 'kradziez' },
                { id: 'ext_oc', path: 'homeDetails.ocPrivate', type: 'checkbox', label: 'OC w Życiu Prywatnym', width: 'w-full', aiKey: 'oc_prywatne' },
                { id: 'ext_assignment', path: 'homeDetails.assignmentBank', type: 'text', label: 'Cesja (Bank)', placeholder: 'Wpisz nazwę banku', width: 'w-full', aiKey: 'cesja' }
            ]
        },
        {
            id: 'import_notes',
            title: 'Notatki / Import',
            icon: FileText,
            defaultOpen: true,
            className: 'bg-yellow-50/50 border-yellow-100',
            fields: [
                {
                    id: 'raw_import',
                    path: 'originalProductString',
                    type: 'textarea',
                    label: 'Treść z Importu (Excel) / Uwagi',
                    width: 'w-full',
                    placeholder: 'Wklej tutaj dane z Excela lub wpisz uwagi...',
                    aiKey: 'notatka_import'
                }
            ]
        }
    ]
};
