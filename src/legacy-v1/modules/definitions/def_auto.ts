
import { Car, Shield, Truck, Zap, Gauge, Calendar, Disc, PenTool, Users, Package, Sliders, AlertTriangle, FileText } from 'lucide-react';
import { PolicyModuleDefinition } from '../../types/module_types';
import { POPULAR_BRANDS } from '../../data/brands';

export const AutoModuleDefinition: PolicyModuleDefinition = {
    id: 'OC', 
    title: 'Ubezpieczenie Komunikacyjne',
    icon: Car,
    themeColor: 'blue',
    sections: [
        {
            id: 'vehicle_id',
            title: 'Identyfikacja Pojazdu',
            icon: Car,
            defaultOpen: true,
            fields: [
                {
                    id: 'veh_type',
                    path: 'autoDetails.vehicleType',
                    type: 'toggle_group', // Lepsze niż select dla głównych typów
                    label: 'Rodzaj',
                    width: 'w-full',
                    required: true,
                    options: [
                        { value: 'OSOBOWY', label: 'Osobowy' },
                        { value: 'CIEZAROWY', label: 'Ciężarowy' },
                        { value: 'MOTOCYKL', label: 'Motocykl' },
                        { value: 'CIAGNIK', label: 'Ciągnik' }
                    ]
                },
                {
                    id: 'brand',
                    path: 'vehicleBrand',
                    type: 'text',
                    label: 'Marka',
                    width: 'w-1/3',
                    required: true,
                    aiKey: 'marka',
                    placeholder: 'np. Toyota'
                },
                {
                    id: 'model',
                    path: 'vehicleModel',
                    type: 'text',
                    label: 'Model',
                    width: 'w-1/3',
                    required: true,
                    aiKey: 'model',
                    placeholder: 'np. Yaris'
                },
                {
                    id: 'reg',
                    path: 'vehicleReg',
                    type: 'text',
                    label: 'Nr Rejestracyjny',
                    width: 'w-1/3',
                    required: true,
                    aiKey: 'rejestracja',
                    placeholder: 'GD 12345'
                },
                {
                    id: 'vin',
                    path: 'vehicleVin',
                    type: 'text',
                    label: 'Numer VIN',
                    width: 'w-full',
                    aiKey: 'vin',
                    placeholder: 'XXXXXXXXXXXXXXXXX'
                }
            ]
        },
        {
            id: 'tech_specs',
            title: 'Dane Techniczne',
            icon: Gauge,
            defaultOpen: true,
            fields: [
                {
                    id: 'year',
                    path: 'autoDetails.productionYear',
                    type: 'number',
                    label: 'Rok Produkcji',
                    width: 'w-1/4',
                    required: true,
                    aiKey: 'rocznik',
                    placeholder: 'RRRR'
                },
                {
                    id: 'capacity',
                    path: 'autoDetails.engineCapacity',
                    type: 'number',
                    label: 'Pojemność',
                    width: 'w-1/4',
                    aiKey: 'pojemnosc',
                    suffix: 'cm3'
                },
                {
                    id: 'power',
                    path: 'autoDetails.enginePower',
                    type: 'number',
                    label: 'Moc',
                    width: 'w-1/4',
                    aiKey: 'moc',
                    suffix: 'kW'
                },
                {
                    id: 'fuel',
                    path: 'autoDetails.fuelType', 
                    type: 'select',
                    label: 'Paliwo',
                    width: 'w-1/4',
                    aiKey: 'paliwo',
                    options: [
                        { value: 'BENZYNA', label: 'Benzyna' },
                        { value: 'DIESEL', label: 'Diesel' },
                        { value: 'LPG', label: 'LPG' },
                        { value: 'HYBRYDA', label: 'Hybryda' },
                        { value: 'ELEKTRYK', label: 'Elektryk' }
                    ]
                }
            ]
        },
        {
            id: 'protection',
            title: 'Zakres i Assistance',
            icon: Shield,
            defaultOpen: false,
            fields: [
                {
                    id: 'assistance',
                    path: 'autoDetails.assistanceVariant',
                    type: 'select',
                    label: 'Wariant Assistance',
                    width: 'w-full',
                    options: [
                        { value: 'PODSTAWOWY', label: 'Podstawowy (Wypadek)' },
                        { value: 'ROZSZERZONY', label: 'Rozszerzony (Awaria)' },
                        { value: 'VIP', label: 'MAX / VIP (Europa)' }
                    ]
                },
                { id: 'tires', path: 'autoDetails.tires', type: 'checkbox', label: 'Opony', width: 'w-1/3' },
                { id: 'windows', path: 'autoDetails.windows', type: 'checkbox', label: 'Szyby', width: 'w-1/3' },
                { id: 'nnw', path: 'autoDetails.nnw', type: 'checkbox', label: 'NNW', width: 'w-1/3' }
            ]
        },
        {
            id: 'ac_details',
            title: 'Autocasco (AC)',
            icon: Sliders,
            defaultOpen: false,
            className: 'bg-blue-50/50 border-blue-100',
            fields: [
                {
                    id: 'sum_ac',
                    path: 'autoDetails.vehicleValue',
                    type: 'number',
                    label: 'Suma Ubezpieczenia',
                    width: 'w-1/2',
                    suffix: 'PLN',
                    aiKey: 'wartosc_pojazdu'
                },
                {
                    id: 'ac_var',
                    path: 'autoDetails.acVariant',
                    type: 'select',
                    label: 'Wariant',
                    width: 'w-1/2',
                    options: [
                        { value: 'KOSZTORYS', label: 'Kosztorys' },
                        { value: 'WARSZTAT', label: 'Warsztat' },
                        { value: 'ASO', label: 'ASO' }
                    ]
                }
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
