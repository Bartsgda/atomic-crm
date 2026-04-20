import React, { useState, useMemo } from 'react';
import { ClientNote, NoteTag } from '../types';
import { MessageSquare, Clock, Plus, CheckCircle2, XCircle, Ban, ChevronDown, Trash2, AlertCircle } from 'lucide-react';
import { format, addDays, compareDesc } from 'date-fns';
import { pl } from 'date-fns/locale/pl';

interface Props {
  clientId: string;
  notes: ClientNote[];
  onAddNote: (note: ClientNote) => void;
  onDeleteNote: (id: string) => void;
}

const generateId = () => {
  return typeof crypto.randomUUID === 'function' 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 11) + '-' + Date.now();
};

// Fix: Added missing 'IMPORT' tag to the Record
const tagColors: Record<NoteTag, string> = {
  ROZMOWA: 'bg-blue-100 text-blue-700',
  RODZINA: 'bg-purple-100 text-purple-700',
  OCZEKIWANIA: 'bg-amber-100 text-amber-700',
  OFERTA: 'bg-red-100 text-red-700',
  STATUS: 'bg-emerald-100 text-emerald-700',
  PRYWATNE: 'bg-zinc-100 text-zinc-700',
  IMPORT: 'bg-zinc-100 text-zinc-500',
  WINDYKACJA: 'bg-rose-100 text-rose-700',
  SZKODA: 'bg-orange-100 text-orange-700',
  DECISION_PRICE: 'bg-stone-100 text-stone-700',
  DECISION_OFFER: 'bg-stone-100 text-stone-700',
  DECISION_LATER: 'bg-stone-100 text-stone-700',
  WSP: 'bg-slate-100 text-slate-700',
  AUDYT: 'bg-fuchsia-100 text-fuchsia-700'
};

export const NotesSection: React.FC<Props> = ({ clientId, notes, onAddNote, onDeleteNote }) => {
  const [newNote, setNewNote] = useState('');
  const [selectedTag, setSelectedTag] = useState<NoteTag>('ROZMOWA');
  const [showReminderMenu, setShowReminderMenu] = useState(false);

  const sortedNotes = useMemo(() => {
    return [...(notes || [])].sort((a, b) => 
      compareDesc(new Date(a.createdAt), new Date(b.createdAt))
    );
  }, [notes]);

  const handleAddNote = (content: string, tag: NoteTag = 'ROZMOWA', reminderDate?: string) => {
    const trimmedContent = content.trim();
    const finalContent = trimmedContent || `Status: ${tag}`;
    
    const note: ClientNote = {
      id: generateId(),
      clientId,
      content: finalContent,
      tag,
      createdAt: new Date().toISOString(),
      reminderDate
    };
    
    onAddNote(note);
    setNewNote('');
    setShowReminderMenu(false);
  };

  const handleAddReminder = (days: number) => {
    const date = addDays(new Date(), days).toISOString();
    const label = days === 1 ? 'jutro' : (days === 7 ? 'za tydzień' : `za ${days} dni`);
    handleAddNote(newNote || `Zaplanowano kontakt telefoniczny (${label}).`, 'STATUS', date);
  };

  const openCustomDatePicker = () => {
    const input = document.createElement('input');
    input.type = 'date';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    document.body.appendChild(input);
    
    input.onchange = (e: any) => {
      if (e.target.value) {
        const date = new Date(e.target.value).toISOString();
        handleAddNote(newNote || `Wyznaczono termin kontaktu.`, 'STATUS', date);
      }
      document.body.removeChild(input);
    };

    if (typeof (input as any).showPicker === 'function') {
      (input as any).showPicker();
    } else {
      input.click();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2">
          <MessageSquare size={20} className="text-red-600" /> Notatnik Agenta
        </h2>
        <div className="flex gap-1 flex-wrap justify-end">
          {(Object.keys(tagColors) as NoteTag[]).filter(t => t !== 'IMPORT').map(t => (
            <button 
              key={t} 
              type="button"
              onClick={() => setSelectedTag(t)}
              className={`px-2 py-1 rounded-md text-[8px] font-black transition-all mb-1 ${selectedTag === t ? tagColors[t] + ' ring-1 ring-current' : 'bg-zinc-50 text-zinc-400'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100 shadow-inner">
        <textarea 
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Wpisz ustalenia z rozmowy, potrzeby, info o rodzinie..."
          className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium min-h-[100px] resize-none outline-none"
        />
        
        <div className="flex flex-wrap gap-2 mt-4 pb-4 border-b border-zinc-200/50">
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowReminderMenu(!showReminderMenu)}
              className="bg-white border border-zinc-200 px-3 py-2 rounded-xl text-[10px] font-black text-zinc-600 hover:border-red-400 hover:text-red-600 transition-all flex items-center gap-2 shadow-sm"
            >
              <Clock size={14} /> ZADZWOŃ... <ChevronDown size={12} />
            </button>
            {showReminderMenu && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-50 overflow-hidden py-2 ring-1 ring-black/5">
                <button type="button" onClick={() => handleAddReminder(1)} className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-zinc-50 text-zinc-600">JUTRO</button>
                <button type="button" onClick={() => handleAddReminder(2)} className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-zinc-50 text-zinc-600">ZA 2 DNI</button>
                <button type="button" onClick={() => handleAddReminder(3)} className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-zinc-50 text-zinc-600">ZA 3 DNI</button>
                <button type="button" onClick={() => handleAddReminder(7)} className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-zinc-50 text-zinc-600">ZA TYDZIEŃ</button>
                <div className="border-t border-zinc-100 my-1"></div>
                <button 
                  type="button" 
                  onClick={openCustomDatePicker}
                  className="w-full px-4 py-2 text-left text-[10px] font-bold hover:bg-zinc-50 text-zinc-600"
                >
                  INNA DATA...
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => handleAddNote(newNote || "Zlecenie przygotowania oferty.", 'OFERTA')} className="bg-white border border-zinc-200 px-3 py-2 rounded-xl text-[10px] font-black text-zinc-600 hover:border-red-400 hover:text-red-600 transition-all flex items-center gap-2 shadow-sm">
            <Plus size={14} /> ZRÓB OFERTĘ
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button type="button" onClick={() => handleAddNote(newNote || "Klient zaakceptował ofertę.", 'STATUS')} className="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100">
            <CheckCircle2 size={14} /> AKCEPTACJA
          </button>
          <button type="button" onClick={() => handleAddNote(newNote || "Klient odrzucił ofertę.", 'STATUS')} className="bg-red-50 text-red-700 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100">
            <XCircle size={14} /> ODRZUCENIE
          </button>
          <button type="button" onClick={() => handleAddNote("Kontakt urwany. System przypomni o wznowieniu za rok.", 'STATUS', addDays(new Date(), 320).toISOString())} className="bg-zinc-900 text-zinc-400 px-3 py-2 rounded-xl text-[10px] font-black hover:text-white transition-all flex items-center gap-2">
            <Ban size={14} /> URWANY KONTAKT
          </button>
          <button type="button" onClick={() => handleAddNote(newNote, selectedTag)} className="ml-auto bg-red-600 text-white px-6 py-2 rounded-xl text-[10px] font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200">
            DODAJ WPIS
          </button>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        {sortedNotes.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed border-zinc-100 rounded-3xl">
            <p className="text-zinc-300 text-[10px] font-black uppercase tracking-widest">Brak historii kontaktów</p>
          </div>
        )}
        {sortedNotes.map(note => (
          <div key={note.id} className="relative pl-6 border-l-2 border-zinc-100 pb-6 group/note">
            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-4 border-white ${tagColors[note.tag]?.split(' ')[0] || 'bg-zinc-200'}`}></div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${tagColors[note.tag] || 'bg-zinc-100 text-zinc-500'}`}>{note.tag}</span>
                <span className="text-[10px] text-zinc-300 font-bold">{format(new Date(note.createdAt), 'dd MMM yyyy HH:mm', { locale: pl })}</span>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if(window.confirm('Usunąć ten wpis z historii?')) {
                    onDeleteNote(note.id);
                  }
                }}
                className="opacity-0 group-hover/note:opacity-100 focus:opacity-100 transition-opacity text-zinc-300 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50"
                title="Usuń notatkę"
                aria-label="Usuń notatkę"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-sm font-medium text-zinc-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
            {note.reminderDate && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-[9px] uppercase border border-red-100">
                <AlertCircle size={12} /> PRZYPOMNIENIE: {format(new Date(note.reminderDate), 'dd.MM.yyyy')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};