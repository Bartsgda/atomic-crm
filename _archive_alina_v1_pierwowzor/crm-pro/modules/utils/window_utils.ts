
import { PolicyModuleDefinition, FieldDefinition } from '../../types/module_types';

// --- STYLE FORMULARZY (Global Form Styles) ---
// Naprawa błędu "czarnych teł" w inputach. Jeden standard dla wszystkich modułów.
// ADDED: [color-scheme:light] dark:[color-scheme:dark] aby wymusić poprawne renderowanie natywnych kontrolek (kalendarz)
export const STANDARD_INPUT_CLASS = "w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]";

export const STANDARD_SELECT_CLASS = "w-full p-2.5 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer appearance-none [color-scheme:light] dark:[color-scheme:dark]";

// --- GRAFIKA OKNA (Window Graphics & Behavior) ---

export const getThemeClasses = (color: string) => {
    // Zwraca zestaw klas CSS w zależności od koloru przewodniego modułu
    const themes: Record<string, any> = {
        'blue': {
            border: 'border-blue-200 dark:border-blue-900',
            bg: 'bg-blue-50 dark:bg-blue-900/10',
            text: 'text-blue-700 dark:text-blue-300',
            ring: 'focus:ring-blue-500',
            button: 'bg-blue-600 hover:bg-blue-700'
        },
        'emerald': {
            border: 'border-emerald-200 dark:border-emerald-900',
            bg: 'bg-emerald-50 dark:bg-emerald-900/10',
            text: 'text-emerald-700 dark:text-emerald-300',
            ring: 'focus:ring-emerald-500',
            button: 'bg-emerald-600 hover:bg-emerald-700'
        },
        'rose': {
            border: 'border-rose-200 dark:border-rose-900',
            bg: 'bg-rose-50 dark:bg-rose-900/10',
            text: 'text-rose-700 dark:text-rose-300',
            ring: 'focus:ring-rose-500',
            button: 'bg-rose-600 hover:bg-rose-700'
        },
        'zinc': {
            border: 'border-zinc-200 dark:border-zinc-800',
            bg: 'bg-zinc-50 dark:bg-zinc-900',
            text: 'text-zinc-700 dark:text-zinc-300',
            ring: 'focus:ring-zinc-500',
            button: 'bg-zinc-900 hover:bg-black'
        }
    };
    return themes[color] || themes['zinc'];
};

export const getInputWidthClass = (width: string) => {
    // Dynamiczne dopasowanie
    switch (width) {
        case 'w-1/2': return 'col-span-12 md:col-span-6';
        case 'w-1/3': return 'col-span-12 md:col-span-4';
        case 'w-1/4': return 'col-span-6 md:col-span-3';
        case 'w-2/3': return 'col-span-12 md:col-span-8';
        default: return 'col-span-12'; // w-full
    }
};

// --- AI BRIDGE (Ekstrakcja struktury dla Bota) ---

export const extractAiSchema = (moduleDef: PolicyModuleDefinition) => {
    // Tworzy uproszczoną mapę pól dla Agenta AI
    // Dzięki temu AI wie, że "pojemność" to 'autoDetails.engineCapacity'
    const schema: Record<string, { path: string, desc: string, type: string }> = {};
    
    moduleDef.sections.forEach(section => {
        section.fields.forEach(field => {
            if (field.aiKey) {
                schema[field.aiKey] = {
                    path: field.path,
                    desc: field.aiDescription || field.label,
                    type: field.type
                };
            }
        });
    });
    
    return schema;
};
