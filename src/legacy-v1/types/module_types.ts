
import { LucideIcon } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';

// Typy pól formularza - AI musi je rozumieć
export type FieldType = 
    | 'text' 
    | 'number' 
    | 'date' 
    | 'select' 
    | 'checkbox' 
    | 'toggle_group' 
    | 'textarea'
    | 'slider'
    | 'participant_list' // NOWOŚĆ: Tabela uczestników
    | 'separator';

// Dynamiczna szerokość elementu w siatce (Ergonomia)
export type FieldWidth = 'w-full' | 'w-1/2' | 'w-1/3' | 'w-1/4' | 'w-2/3';

export interface SelectOption {
    value: string;
    label: string;
    icon?: LucideIcon; // Opcjonalna ikona dla opcji
    group?: string; // Grupowanie opcji (np. UE, Świat)
}

export interface FieldDefinition {
    id: string;             // Unikalne ID w ramach sekcji
    path: string;           // Ścieżka w React Hook Form
    type: FieldType;
    label: string;
    width: FieldWidth;
    placeholder?: string;
    options?: SelectOption[]; // Dla select/toggle
    required?: boolean;
    
    // Config dla Slidera
    min?: number;
    max?: number;
    step?: number;

    // AI Metadata
    aiKey?: string;         
    aiDescription?: string; 
    
    // UI Logic
    hidden?: (values: any) => boolean; 
    suffix?: string;        
}

export interface SectionDefinition {
    id: string;
    title: string;
    icon: LucideIcon;
    defaultOpen: boolean;
    fields: FieldDefinition[];
    className?: string; 
}

export interface PolicyModuleDefinition {
    id: string; 
    title: string;
    icon: LucideIcon;
    themeColor: string; 
    sections: SectionDefinition[];
}
