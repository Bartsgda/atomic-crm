
import { Heart, Activity, Users, FileCheck, Stethoscope, Cross, User, FileText } from 'lucide-react';
import { PolicyModuleDefinition } from '../../types/module_types';

export const LifeModuleDefinition: PolicyModuleDefinition = {
    id: 'ZYCIE',
    title: 'Ubezpieczenie na Życie',
    icon: Heart,
    themeColor: 'rose',
    sections: [
        {
            id: 'main',
            title: 'Rodzaj i Zakres',
            icon: Activity,
            defaultOpen: true,
            fields: [
                {
                    id: 'life_type',
                    path: 'lifeDetails.lifeType',
                    type: 'toggle_group',
                    label: 'Typ Polisy',
                    width: 'w-full',
                    options: [
                        { value: 'INDYWIDUALNA', label: 'Indywidualna', icon: User },
                        { value: 'GRUPOWA', label: 'Grupowa Otwarta', icon: Users },
                        { value: 'SZKOLNA', label: 'NNW Szkolne', icon: Activity }
                    ]
                },
                {
                    id: 'sum_death',
                    path: 'lifeDetails.sumDeath',
                    type: 'number',
                    label: 'Suma na wypadek Śmierci',
                    width: 'w-full',
                    suffix: 'PLN',
                    required: true,
                    aiKey: 'suma_zycie'
                }
            ]
        },
        {
            id: 'options',
            title: 'Opcje Dodatkowe',
            icon: Stethoscope,
            defaultOpen: true,
            fields: [
                { id: 'hospital', path: 'lifeDetails.hospital', type: 'checkbox', label: 'Pobyt w Szpitalu', width: 'w-1/2' },
                { id: 'serious', path: 'lifeDetails.seriousIllness', type: 'checkbox', label: 'Poważne Zachorowanie', width: 'w-1/2' },
                { id: 'accident', path: 'lifeDetails.accidentDeath', type: 'checkbox', label: 'Śmierć w NW', width: 'w-full' } 
            ]
        },
        {
            id: 'compliance',
            title: 'Wymogi Formalne',
            icon: FileCheck,
            defaultOpen: true,
            className: 'bg-rose-50/50 border-rose-100',
            fields: [
                { id: 'survey', path: 'hasMedicalSurvey', type: 'checkbox', label: 'Ankieta Medyczna Wypełniona', width: 'w-full' },
                { id: 'beneficiaries', path: 'lifeDetails.hasBeneficiaries', type: 'checkbox', label: 'Wskazano Uposażonych', width: 'w-full' } 
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
