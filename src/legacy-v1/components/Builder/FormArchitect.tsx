
import React, { useState } from 'react';
import { FormElementDef, FieldType, FieldWidth } from '../../types_builder';
import { 
    Plus, Trash2, MoveUp, MoveDown, Maximize2, Minimize2, 
    Type, Hash, Calendar, ToggleLeft, List, Copy, Save, LayoutTemplate, 
    Settings, GripVertical, Code
} from 'lucide-react';

const COMPONENT_PALETTE: { type: FieldType; label: string; icon: any }[] = [
    { type: 'HEADER', label: 'Nagłówek Sekcji', icon: LayoutTemplate },
    { type: 'INPUT_TEXT', label: 'Tekst (Ulica)', icon: Type },
    { type: 'INPUT_NUMBER', label: 'Liczba (m², PLN)', icon: Hash },
    { type: 'SELECT', label: 'Lista Wyboru', icon: List },
    { type: 'DATE', label: 'Data', icon: Calendar },
    { type: 'TOGGLE_GROUP', label: 'Kafelki (Tak/Nie)', icon: ToggleLeft },
    { type: 'SECTION_BREAK', label: 'Odstęp (Separator)', icon: Minimize2 },
];

const INITIAL_LAYOUT: FormElementDef[] = [
    { id: 'h1', type: 'HEADER', label: 'Parametry Główne', width: 'w-full', iconName: 'Home' },
    { id: 'f1', type: 'INPUT_TEXT', label: 'Adres Nieruchomości', width: 'w-full', bindingKey: 'propertyAddress', isRequired: true },
    { id: 'f2', type: 'INPUT_NUMBER', label: 'Metraż (m²)', width: 'w-1/3', bindingKey: 'homeDetails.area' },
    { id: 'f3', type: 'INPUT_NUMBER', label: 'Rok Budowy', width: 'w-1/3', bindingKey: 'homeDetails.yearBuilt' },
    { id: 'f4', type: 'SELECT', label: 'Konstrukcja', width: 'w-1/3', bindingKey: 'homeDetails.constructionType', options: ['Murowana', 'Drewniana'] },
];

export const FormArchitect: React.FC = () => {
    const [elements, setElements] = useState<FormElementDef[]>(INITIAL_LAYOUT);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [jsonOutput, setJsonOutput] = useState<string>('');

    const addElement = (type: FieldType) => {
        const newEl: FormElementDef = {
            id: `el_${Date.now()}`,
            type,
            label: type === 'HEADER' ? 'Nowa Sekcja' : 'Nowe Pole',
            width: type === 'HEADER' || type === 'INPUT_TEXT' ? 'w-full' : 'w-1/3',
            bindingKey: '',
            options: type === 'SELECT' || type === 'TOGGLE_GROUP' ? ['Opcja 1', 'Opcja 2'] : undefined
        };
        setElements([...elements, newEl]);
        setSelectedId(newEl.id);
    };

    const updateElement = (id: string, updates: Partial<FormElementDef>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const removeElement = (id: string) => {
        setElements(prev => prev.filter(el => el.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    const moveElement = (index: number, direction: -1 | 1) => {
        if (index + direction < 0 || index + direction >= elements.length) return;
        const newArr = [...elements];
        const temp = newArr[index];
        newArr[index] = newArr[index + direction];
        newArr[index + direction] = temp;
        setElements(newArr);
    };

    const cycleWidth = (id: string) => {
        const el = elements.find(e => e.id === id);
        if(!el) return;
        
        const widths: FieldWidth[] = ['w-1/4', 'w-1/3', 'w-1/2', 'w-2/3', 'w-full'];
        const currentIdx = widths.indexOf(el.width);
        const nextWidth = widths[(currentIdx + 1) % widths.length];
        updateElement(id, { width: nextWidth });
    };

    const generateBlueprint = () => {
        const blueprint = {
            target: "HomeForm.tsx",
            timestamp: new Date().toISOString(),
            structure: elements
        };
        setJsonOutput(JSON.stringify(blueprint, null, 2));
    };

    return (
        <div className="flex h-screen bg-zinc-100 dark:bg-zinc-950 font-sans overflow-hidden">
            
            {/* LEFT SIDEBAR: TOOLBOX */}
            <div className="w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
                <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-lg font-black text-zinc-900 dark:text-white flex items-center gap-2">
                        <Settings className="text-red-600" /> Form Architect
                    </h2>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Tryb Projektowania</p>
                </div>
                
                <div className="p-4 space-y-2 flex-1 overflow-y-auto">
                    <p className="text-[10px] font-black uppercase text-zinc-400 mb-2">Paleta Komponentów</p>
                    {COMPONENT_PALETTE.map(item => (
                        <button 
                            key={item.type}
                            onClick={() => addElement(item.type)}
                            className="w-full flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-white dark:hover:bg-zinc-700 hover:border-red-400 transition-all group"
                        >
                            <item.icon size={16} className="text-zinc-400 group-hover:text-red-500"/>
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{item.label}</span>
                            <Plus size={14} className="ml-auto opacity-0 group-hover:opacity-100 text-red-500" />
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
                    <button 
                        onClick={generateBlueprint}
                        className="w-full py-3 bg-zinc-900 text-white rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg"
                    >
                        <Code size={14} /> Generuj Kod (JSON)
                    </button>
                </div>
            </div>

            {/* MAIN CANVAS */}
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-100 dark:bg-zinc-950">
                
                {/* JSON OUTPUT MODAL OVERLAY */}
                {jsonOutput && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm p-10">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                <h3 className="text-lg font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                                    <Save size={18} /> Gotowe do wklejenia
                                </h3>
                                <button onClick={() => setJsonOutput('')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">Zamknij</button>
                            </div>
                            <div className="flex-1 p-0 relative">
                                <textarea 
                                    readOnly
                                    value={jsonOutput}
                                    className="w-full h-full p-6 bg-zinc-950 text-emerald-400 font-mono text-xs outline-none resize-none"
                                />
                                <button 
                                    onClick={() => navigator.clipboard.writeText(jsonOutput)}
                                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold backdrop-blur-md flex items-center gap-2"
                                >
                                    <Copy size={14} /> Kopiuj do schowka
                                </button>
                            </div>
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 text-center">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">Wklej ten kod w czacie, a ja zaktualizuję HomeForm.tsx</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 min-h-[80vh] rounded-[2rem] shadow-sm border border-zinc-200 dark:border-zinc-800 p-8">
                    <div className="flex flex-wrap -mx-2">
                        {elements.map((el, idx) => {
                            const isSelected = selectedId === el.id;
                            
                            // Width Logic
                            let widthClass = 'w-full'; // Default
                            if(el.width === 'w-1/2') widthClass = 'w-1/2';
                            if(el.width === 'w-1/3') widthClass = 'w-1/3';
                            if(el.width === 'w-1/4') widthClass = 'w-1/4';
                            if(el.width === 'w-2/3') widthClass = 'w-2/3';

                            return (
                                <div 
                                    key={el.id} 
                                    onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
                                    className={`p-2 relative group transition-all duration-200 ${widthClass}`}
                                >
                                    <div className={`
                                        h-full rounded-xl border-2 p-3 transition-all cursor-pointer relative
                                        ${isSelected 
                                            ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 ring-4 ring-blue-100 dark:ring-blue-900/30' 
                                            : 'border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 bg-white dark:bg-zinc-800'}
                                    `}>
                                        
                                        {/* HEADER TYPE */}
                                        {el.type === 'HEADER' && (
                                            <div className="flex items-center gap-2 text-zinc-400 mb-1">
                                                <LayoutTemplate size={16} />
                                                <span className="text-[10px] font-black uppercase">Nagłówek Sekcji</span>
                                            </div>
                                        )}

                                        {/* CONTENT PREVIEW */}
                                        <div className="pointer-events-none">
                                            {el.type === 'HEADER' ? (
                                                <h3 className="text-sm font-black uppercase text-zinc-900 dark:text-white tracking-widest border-b border-zinc-200 pb-1">{el.label}</h3>
                                            ) : (
                                                <>
                                                    <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">{el.label}</label>
                                                    <div className="h-10 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg w-full"></div>
                                                </>
                                            )}
                                        </div>

                                        {/* CONTROLS (Visible on Select/Hover) */}
                                        <div className={`absolute top-2 right-2 flex gap-1 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveElement(idx, -1); }} 
                                                className="p-1 bg-white border rounded hover:bg-zinc-100 text-zinc-500" title="Przesuń w lewo/górę"
                                            >
                                                <MoveUp size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); moveElement(idx, 1); }} 
                                                className="p-1 bg-white border rounded hover:bg-zinc-100 text-zinc-500" title="Przesuń w prawo/dół"
                                            >
                                                <MoveDown size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); cycleWidth(el.id); }} 
                                                className="p-1 bg-white border rounded hover:bg-zinc-100 text-blue-500 font-mono text-[9px] w-12" title="Zmień szerokość"
                                            >
                                                {el.width.replace('w-', '')}
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); removeElement(el.id); }} 
                                                className="p-1 bg-white border rounded hover:bg-red-50 text-red-500" title="Usuń"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    {elements.length === 0 && (
                        <div className="py-24 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                            <p className="text-zinc-400 font-bold uppercase text-xs">Pusty Formularz. Dodaj elementy z menu po lewej.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDEBAR: PROPERTIES (Selected Element) */}
            {selectedId && (
                <div className="w-72 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col animate-in slide-in-from-right-4">
                    <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                        <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">Właściwości Pola</h3>
                    </div>
                    
                    {elements.map(el => {
                        if (el.id !== selectedId) return null;
                        return (
                            <div key={el.id} className="p-4 space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Etykieta (Label)</label>
                                    <input 
                                        value={el.label} 
                                        onChange={(e) => updateElement(el.id, { label: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-xs font-bold bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Powiązanie (Binding Key)</label>
                                    <input 
                                        value={el.bindingKey || ''} 
                                        onChange={(e) => updateElement(el.id, { bindingKey: e.target.value })}
                                        className="w-full p-2 border rounded-lg text-xs font-mono text-blue-600 bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700"
                                        placeholder="np. homeDetails.area"
                                    />
                                    <p className="text-[9px] text-zinc-400 mt-1 italic">Ścieżka w bazie danych.</p>
                                </div>

                                {(el.type === 'SELECT' || el.type === 'TOGGLE_GROUP') && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-zinc-400 block mb-1">Opcje (oddziel przecinkiem)</label>
                                        <input 
                                            value={el.options?.join(',') || ''} 
                                            onChange={(e) => updateElement(el.id, { options: e.target.value.split(',') })}
                                            className="w-full p-2 border rounded-lg text-xs bg-zinc-50 dark:bg-zinc-800 dark:text-white dark:border-zinc-700"
                                        />
                                    </div>
                                )}

                                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={el.isRequired || false} 
                                            onChange={(e) => updateElement(el.id, { isRequired: e.target.checked })}
                                            className="rounded border-zinc-300 text-red-600 focus:ring-red-500"
                                        />
                                        <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Pole Wymagane</span>
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

        </div>
    );
};
