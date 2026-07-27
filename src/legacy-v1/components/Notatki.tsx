
import React, { useState, useCallback, FC, useEffect, useRef } from 'react';
import { ClientNote, NoteTag, Policy, SalesStage, PolicyType } from '../types';
import {
  MessageSquare, Send, Calendar, CheckCircle2, XCircle, Zap, Home,
  Hash, DollarSign, Snowflake, Users, Car, Settings2, Edit2, Save, GitCommit, Eye, EyeOff, Clock
} from 'lucide-react';
import { format, addDays, isValid } from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { NoteTagRenderer } from './NoteTagRenderer';
import { DeleteSafetyButton } from './DeleteSafetyButton';
import { storage } from '../services/storage';
import { QuickInterviewWidget } from './Tools/QuickInterviewWidget';
import { PolicyFormModal } from './PolicyFormModal'; 
import { ReminderWidget } from './ReminderSystem/ReminderWidget';
import { ReminderUtils } from './ReminderSystem/ReminderUtils';

interface Props {
  clientId: string;
  notes: ClientNote[];
  allPolicies: Policy[];
  initialResumeId?: string | null;
  pendingPolicyLinks?: string[]; 
  activePolicyId?: string | null; // NEW: Automatically link to this if provided
  onClearPendingLinks?: () => void;
  onAddPendingLink?: (policyId: string) => void;
  onAddNote: (note: ClientNote) => void;
  onUpdateNote?: (note: ClientNote) => void;
  onDeleteNote: (id: string) => void;
  onHoverNote?: (policyIds: string[] | undefined) => void;
  onUpdatePolicy?: (policy: Policy) => void; 
  highlightedIds?: string[];
}

const generateNoteId = () => `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
const generatePolicyId = () => `id_lead_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

// Helper to detect system logs
const isSystemLog = (note: ClientNote) => {
    return note.content.startsWith('[SYSTEM') || note.tag === 'AUDYT' || (note.tag === 'STATUS' && note.content.includes('Zmiana etapu'));
};

export const Notatki: FC<Props> = ({ clientId, notes, allPolicies, initialResumeId, pendingPolicyLinks = [], activePolicyId, onClearPendingLinks, onAddPendingLink, onAddNote, onUpdateNote, onDeleteNote, onHoverNote, onUpdatePolicy, highlightedIds = [] }) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeTag, setActiveTag] = useState<NoteTag>('ROZMOWA');
  
  // VIEW STATE
  const [showSystemLogs, setShowSystemLogs] = useState(false);
  
  // REMINDER STATE (WIDGET)
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  
  // INLINE EDIT STATE
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [editingLinks, setEditingLinks] = useState<string[]>([]); // #5: przepięcie obiektu w edycji
  const [editingDate, setEditingDate] = useState<string>(''); // edycja daty notatki (yyyy-MM-dd)
  
  // Smart Action States
  const [showAssetList, setShowAssetList] = useState(false);
  const [automationToast, setAutomationToast] = useState<string | null>(null);
  const [showPropertyWidget, setShowPropertyWidget] = useState(false);

  // #1: data notatki (domyślnie dziś; Alina może zmienić — notuje po fakcie).
  //     Godzina/minuty usunięte razem z trybem rozmowy (nie ma już call-timera).
  const [noteDate, setNoteDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));

  // --- FLOATING FORM STATE ---
  const [activeFloatingOffer, setActiveFloatingOffer] = useState<{ type: PolicyType, policy: Policy } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clientPolicies = allPolicies.filter(p => p.clientId === clientId);

  const [currentClientData, setCurrentClientData] = useState<any>(null);
  useEffect(() => {
      const c = storage.getState().clients.find(x => x.id === clientId);
      if(c) setCurrentClientData(c);
  }, [clientId]);

  const handleLaunchOffer = (type: PolicyType) => {
      const newPolicy: Policy = {
          id: generatePolicyId(),
          clientId,
          type,
          stage: 'of_do zrobienia',
          insurerName: '',
          policyNumber: '',
          vehicleBrand: '',
          vehicleReg: '',
          vehicleVin: '',
          terminationBasis: 'art28' as any,
          policyStartDate: new Date().toISOString(),
          policyEndDate: addDays(new Date(), 365).toISOString(),
          premium: 0,
          commission: 0,
          createdAt: new Date().toISOString()
      };
      
      setActiveFloatingOffer({ type, policy: newPolicy });
      setText(prev => prev + `\n>> Otwarto formularz oferty: ${type} (${newPolicy.id})\n`);
      setShowPropertyWidget(true); 
  };

  const handleFloatingOfferSave = async (client: any, policy: Policy) => {
      await storage.addPolicy(policy);
      if(onUpdatePolicy) onUpdatePolicy(policy);
      if(onAddPendingLink) onAddPendingLink(policy.id);

      const label = policy.vehicleBrand || policy.propertyAddress || policy.type;
      setText(prev => prev + `\n[OFERTA UTWORZONA] ${label}. Składka: ${policy.premium} zł.`);
      
      setActiveFloatingOffer(null);
      setAutomationToast("Oferta zapisana i podpięta do rozmowy.");
      setTimeout(() => setAutomationToast(null), 3000);
  };

  const handleWidgetAppend = (snippet: string) => {
      setText(prev => {
          const separator = prev.trim().length > 0 ? (prev.endsWith('\n') ? '' : '\n') : '';
          return prev + separator + `• ${snippet}`;
      });
  };

  const handleAutomatedStatusChange = async (tag: string, content: string, links: string[]) => {
      if (!onUpdatePolicy || links.length === 0) return;

      let newStage: SalesStage | null = null;
      let actionLabel = '';

      if (tag === 'STATUS' && content.includes('[ST: OK]')) {
          newStage = 'sprzedaż'; 
          actionLabel = 'Sprzedaż (Z sukcesem)';
      }
      else if (tag === 'ROZMOWA' && content.includes('[ST: W TOKU]')) {
          newStage = 'przeł kontakt';
          actionLabel = 'W Toku';
      }
      else if (tag === 'DECISION_OFFER' || content.includes('odrzuca') || content.includes('Konkurencja') || content.includes('Za drogo')) {
          newStage = 'ucięty kontakt';
          actionLabel = 'Ucięty Kontakt (Odrzut)';
      }
      else if (tag === 'OFERTA' || content.includes('[OFERTA')) {
          newStage = 'oferta_wysłana';
          actionLabel = 'Oferta Wysłana';
      }
      else if (content.includes('URWANY KONTAKT') || content.includes('CHŁODNIA')) {
          newStage = 'rez po ofercie_kont za rok';
          actionLabel = 'Chłodnia (Ponów za rok)';
      }

      if (newStage) {
          let updatedCount = 0;
          for (const pid of links) {
              const policy = allPolicies.find(p => p.id === pid);
              if (policy && policy.stage !== newStage && policy.stage !== 'sprzedaż') { // Don't downgrade from sold
                  const updated = { ...policy, stage: newStage };
                  await storage.updatePolicy(updated); 
                  onUpdatePolicy(updated); 
                  updatedCount++;
              } else if (policy && newStage === 'sprzedaż' && policy.stage !== 'sprzedaż') {
                  // Explicit upgrade to SOLD
                  const updated = { ...policy, stage: newStage };
                  await storage.updatePolicy(updated);
                  onUpdatePolicy(updated);
                  updatedCount++;
              }
          }
          if (updatedCount > 0) {
              setAutomationToast(`Automatycznie zmieniono status ${updatedCount} polis na: ${actionLabel}`);
              setTimeout(() => setAutomationToast(null), 4000);
          }
      }
  };

  const handleSave = useCallback(async (forcedContent?: string, forcedTag?: NoteTag) => {
    let contentToSave = forcedContent || text;
    const tagToSave = forcedTag || activeTag;

    // --- AUTO-LINK LOGIC ---
    // If we are filtered by a policy (activePolicyId) and it's not manually linked, link it.
    let links = [...pendingPolicyLinks];
    if (activePolicyId && !links.includes(activePolicyId)) {
        links.push(activePolicyId);
    }

    if (!contentToSave.trim() && !reminderDate && links.length === 0) return;

    let finalTag = tagToSave;

    // REMINDER LOGIC INTEGRATION
    let finalReminderDate: string | undefined = undefined;
    if (reminderDate) {
        finalReminderDate = reminderDate.toISOString();
        contentToSave = ReminderUtils.createContent(contentToSave, reminderDate);
        if (finalTag === 'ROZMOWA') finalTag = 'STATUS';
    }

    if (contentToSave.includes('[OFERTA')) finalTag = 'OFERTA';
    if (contentToSave.includes('[ST:')) finalTag = 'STATUS';

    if (contentToSave.toLowerCase().includes('drogo') || contentToSave.toLowerCase().includes('konkurencj')) {
        if(contentToSave.toLowerCase().includes('drogo')) finalTag = 'DECISION_PRICE';
        else if(contentToSave.toLowerCase().includes('konkurencj')) finalTag = 'DECISION_OFFER';
    }

    // #1: createdAt z wybranej daty (noteDate = yyyy-MM-dd); południe by uniknąć przesunięć stref.
    const createdAtIso = new Date(`${noteDate}T12:00:00`).toISOString();

    onAddNote({
      id: generateNoteId(),
      clientId,
      content: contentToSave.trim(),
      tag: finalTag,
      createdAt: createdAtIso,
      reminderDate: finalReminderDate,
      linkedPolicyIds: links
    });

    await handleAutomatedStatusChange(finalTag, contentToSave, links);

    // RESET STATE
    setText('');
    setReminderDate(null);
    setActiveTag('ROZMOWA');
    setShowPropertyWidget(false);
    setNoteDate(format(new Date(), 'yyyy-MM-dd'));
    if (onClearPendingLinks) onClearPendingLinks();

    setIsFocused(false);

  }, [clientId, text, activeTag, reminderDate, pendingPolicyLinks, activePolicyId, onAddNote, onClearPendingLinks, noteDate, allPolicies, onUpdatePolicy]);

  const startEditing = (note: ClientNote) => {
      setEditingNoteId(note.id);
      setEditingContent(note.content);
      setEditingLinks(note.linkedPolicyIds || []);
      const d = new Date(note.createdAt);
      setEditingDate(isValid(d) ? format(d, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
  };

  const cancelEditing = () => {
      setEditingNoteId(null);
      setEditingContent('');
      setEditingLinks([]);
      setEditingDate('');
  };

  const saveEditing = async () => {
      if (!editingNoteId || !onUpdateNote) return;
      const noteToUpdate = notes.find(n => n.id === editingNoteId);
      if (noteToUpdate) {
          const updated: ClientNote = {
              ...noteToUpdate,
              content: editingContent,
              linkedPolicyIds: editingLinks,
              createdAt: editingDate ? new Date(`${editingDate}T12:00:00`).toISOString() : noteToUpdate.createdAt,
              history: [...(noteToUpdate.history || []), { text: noteToUpdate.content, createdAt: new Date().toISOString() }]
          };
          await onUpdateNote(updated);
      }
      setEditingNoteId(null);
      setEditingContent('');
      setEditingLinks([]);
      setEditingDate('');
  };

  const handleEditingKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          saveEditing();
      }
      if (e.key === 'Escape') {
          cancelEditing();
      }
  };

  const handleGhostContact = () => {
      setReminderDate(addDays(new Date(), 330));
      setText("URWANY KONTAKT / CHŁODNIA. Klient nie odpowiada. Przeniesiono do bazy 'Ponów za rok'. System przypomni o temacie przed kolejną rocznicą.");
      setTimeout(() => handleSave(), 100);
  };


  const handleToggleReminderStatus = async (note: ClientNote) => {
      if (!onUpdateNote) return;
      
      const newContent = ReminderUtils.toggleStatus(note.content);
      const updated: ClientNote = {
          ...note,
          content: newContent,
      };
      await onUpdateNote(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleSave();
      }
      if (e.key === '#' && !showAssetList) {
          setShowAssetList(true);
      }
  };

  const handleLinkClick = (label: string) => {
      if(!onHoverNote) return;
      const search = label.toLowerCase().replace(/_/g, ' ');
      const matchedPolicy = allPolicies.find(p => {
          const brand = (p.vehicleBrand || p.type).toLowerCase();
          const reg = (p.vehicleReg || '').toLowerCase();
          return search.includes(brand) || search.includes(reg);
      });
      if (matchedPolicy) onHoverNote([matchedPolicy.id]);
  };

  // --- PREPARE LIST ---
  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const visibleNotes = sortedNotes.filter(n => {
      if (showSystemLogs) return true;
      return !isSystemLog(n);
  });

  return (
    <div className="flex flex-col h-full relative">
      
      {automationToast && (
          <div className="absolute top-0 left-0 right-0 z-50 flex justify-center animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
              <div className="bg-emerald-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold uppercase tracking-widest pointer-events-auto">
                  <Zap size={14} className="text-yellow-300 fill-current" />
                  {automationToast}
              </div>
          </div>
      )}

      {activeFloatingOffer && currentClientData && (
          <PolicyFormModal 
              isOpen={true}
              onClose={() => setActiveFloatingOffer(null)}
              initialType={activeFloatingOffer.type}
              initialPolicy={activeFloatingOffer.policy}
              initialClient={currentClientData}
              onSave={handleFloatingOfferSave}
              initialMode="EDIT"
          />
      )}

      <div className={`relative z-20 transition-all duration-300 ${isFocused || text.length > 0 ? 'mb-8' : 'mb-6'}`}>

        <div className={`bg-white dark:bg-zinc-900 border-2 rounded-3xl shadow-sm overflow-visible transition-all duration-200 relative ${isFocused ? 'border-zinc-900 ring-4 ring-zinc-100 dark:border-zinc-700 dark:ring-zinc-800' : 'border-zinc-200 dark:border-zinc-800'}`}>

            {/* TOOLBAR: szybkie oferty (zawsze dostępne) + data rozmowy */}
            <div className="flex items-center gap-2 p-2 bg-zinc-50/50 dark:bg-zinc-950/30 border-b border-zinc-100 dark:border-zinc-800 overflow-x-auto scrollbar-hide justify-between">

                <div className="flex items-center gap-2">
                    <button onClick={() => handleLaunchOffer('OC')} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-[9px] font-bold hover:bg-blue-200 border border-blue-200"><Car size={10}/> +Auto</button>
                    <button onClick={() => handleLaunchOffer('DOM')} className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-bold hover:bg-emerald-200 border border-emerald-200"><Home size={10}/> +Dom</button>
                    <button onClick={() => setShowPropertyWidget(!showPropertyWidget)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border ${showPropertyWidget ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white text-zinc-600 border-zinc-200'}`}><Settings2 size={10}/> Asystent</button>
                </div>

                {/* DATA ROZMOWY — domyślnie dziś; klik = kalendarz, można też wpisać z klawiatury */}
                <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer" title="Data rozmowy (domyślnie dziś)">
                    <Calendar size={13} className="text-zinc-400" />
                    <input
                        type="date"
                        value={noteDate}
                        onChange={(e) => setNoteDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="bg-transparent text-[11px] font-bold text-zinc-600 dark:text-zinc-300 outline-none cursor-pointer"
                    />
                </label>
            </div>

            {showPropertyWidget && (
                <div className="absolute right-0 top-12 z-40 transform translate-x-[105%] md:translate-x-0 md:relative md:float-right md:ml-2 md:mb-2 animate-in slide-in-from-right-4 fade-in">
                    <QuickInterviewWidget 
                        type={activeFloatingOffer?.type || 'INNE'} 
                        onAppend={handleWidgetAppend} 
                        className="border-blue-200 shadow-blue-100/50" 
                    />
                </div>
            )}

            <div className="relative">
                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => !text && setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Wpisz notatkę... Użyj # aby oznaczyć pojazd.`}
                    className="w-full p-4 min-h-[120px] max-h-[400px] resize-none outline-none bg-transparent text-lg font-medium text-zinc-900 dark:text-white placeholder-zinc-400 leading-relaxed"
                />

                <button
                    onClick={() => handleSave()}
                    disabled={!text.trim()}
                    className="absolute bottom-3 right-3 p-3 text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:scale-100 disabled:shadow-none group bg-zinc-900 dark:bg-white dark:text-zinc-900 px-6"
                >
                    <span className="text-[10px] font-black uppercase flex items-center gap-2">
                        ZATWIERDŹ WPIS <Send size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                </button>
            </div>

            {/* Lista pojazdów/polis do podpięcia (klik # albo ikona Hash) */}
            {showAssetList && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/60 dark:bg-blue-900/10 border-t border-blue-100 dark:border-blue-900/30 animate-in fade-in">
                    <span className="text-[9px] font-black uppercase text-blue-500 mr-1">Podepnij do:</span>
                    {clientPolicies.length === 0 ? (
                        <span className="text-[10px] font-medium text-zinc-400">Ten klient nie ma jeszcze polis/pojazdów.</span>
                    ) : (
                        clientPolicies.map(p => {
                            const on = pendingPolicyLinks.includes(p.id) || activePolicyId === p.id;
                            return (
                                <button key={p.id} type="button"
                                    onClick={() => onAddPendingLink?.(p.id)}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 border-zinc-200 dark:border-zinc-700 hover:border-blue-300'}`}
                                >
                                    {p.vehicleBrand || p.type}{p.vehicleReg && <span className="text-[11px] font-black tabular-nums ml-1">{p.vehicleReg}</span>}
                                </button>
                            );
                        })
                    )}
                    <button onClick={() => setShowAssetList(false)} className="ml-auto text-[9px] font-black uppercase text-zinc-400 hover:text-zinc-600 px-2">Zamknij</button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 rounded-b-3xl">
                
                {/* REMINDER WIDGET */}
                <ReminderWidget 
                    activeDate={reminderDate}
                    onSetDate={setReminderDate}
                />

                <button 
                    onClick={() => setShowAssetList(!showAssetList)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-600 transition-colors"
                    title="Podepnij obiekt (#)"
                >
                    <Hash size={16} />
                </button>

                <button 
                    onClick={handleGhostContact}
                    className="bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 px-3 py-2 rounded-xl text-[10px] font-black hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-all flex items-center gap-2 ml-auto"
                    title="Przenieś do chłodni (ponów kontakt za rok)"
                >
                    <Snowflake size={14} /> URWANY KONTAKT
                </button>

                {/* WSKAŹNIK OBIEKTU — Alina widzi do czego pisze notatkę */}
                {(() => {
                    const linkedIds = Array.from(new Set([...pendingPolicyLinks, ...(activePolicyId ? [activePolicyId] : [])]));
                    if (linkedIds.length === 0) return null;
                    const labels = linkedIds
                        .map(id => {
                            const p = allPolicies.find(x => x.id === id);
                            return p ? `${p.vehicleBrand || p.type} ${p.vehicleReg || ''}`.trim() : null;
                        })
                        .filter(Boolean);
                    return (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 text-[10px] font-black uppercase animate-in fade-in">
                            <Zap size={12} />
                            <span className="normal-case font-bold">Notatka do: {labels.join(', ')}</span>
                            {pendingPolicyLinks.length > 0 && onClearPendingLinks && (
                                <button onClick={onClearPendingLinks} className="hover:text-red-500 ml-1" title="Odepnij obiekt"><XCircle size={12}/></button>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
      </div>

      {/* --- TIMELINE TOOLS (FILTER SYSTEM LOGS) --- */}
      <div className="flex justify-end px-2 pb-2">
          <button 
            onClick={() => setShowSystemLogs(!showSystemLogs)}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${showSystemLogs ? 'bg-zinc-200 text-zinc-800' : 'text-zinc-400 hover:bg-zinc-100'}`}
          >
              {showSystemLogs ? <Eye size={12}/> : <EyeOff size={12}/>}
              {showSystemLogs ? 'Ukryj Logi Systemowe' : 'Pokaż Historię Zmian'}
          </button>
      </div>

      {/* --- TIMELINE (Activity Stream) --- */}
      <div className="space-y-0 relative before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-zinc-100 dark:before:bg-zinc-800">
        {visibleNotes.length === 0 && (
            <div className="pl-12 py-8 opacity-40">
                <p className="text-sm font-bold text-zinc-400">Brak historii kontaktów. Rozpocznij pracę powyżej.</p>
            </div>
        )}
        
        {visibleNotes.map((note, idx) => {
            const isHighlighted = highlightedIds.includes(note.id);
            const dateObj = new Date(note.createdAt);
            const isEditing = editingNoteId === note.id;
            const isSys = isSystemLog(note);
            
            const reminderInfo = ReminderUtils.parse(note.content);
            const isReminder = !!reminderInfo;
            const isCompleted = reminderInfo?.status === 'UKOŃCZONE';

            let Icon = MessageSquare;
            let iconBg = 'bg-zinc-100 text-zinc-400 border-zinc-200';
            
            if (isReminder) {
                Icon = Calendar;
                if (isCompleted) {
                    iconBg = 'bg-emerald-100 text-emerald-600 border-emerald-200';
                } else {
                    iconBg = 'bg-red-100 text-red-600 border-red-200 animate-pulse';
                }
            }
            else if (note.tag === 'OFERTA') { Icon = Send; iconBg = 'bg-purple-100 text-purple-600 border-purple-200'; }
            else if (note.tag === 'STATUS') { Icon = CheckCircle2; iconBg = 'bg-emerald-100 text-emerald-600 border-emerald-200'; }
            else if (note.tag === 'DECISION_PRICE' || note.tag === 'DECISION_OFFER') { Icon = DollarSign; iconBg = 'bg-amber-100 text-amber-600 border-amber-200'; }
            else if (note.tag === 'WSP') { Icon = Users; iconBg = 'bg-slate-100 text-slate-600 border-slate-200'; }
            
            // Override for System Log
            if (isSys) {
                Icon = GitCommit;
                iconBg = 'bg-zinc-50 text-zinc-300 border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-600';
            }

            // --- RENDER SYSTEM LOG (COMPACT) ---
            if (isSys) {
                return (
                    <div key={note.id} className="relative pl-12 py-2 group opacity-60 hover:opacity-100 transition-opacity">
                         <div className={`absolute left-[13px] top-3.5 w-3 h-3 rounded-full border-2 border-white bg-zinc-300 z-10 shadow-sm`}></div>
                         <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                             <span className="font-mono">{isValid(dateObj) ? format(dateObj, 'dd.MM HH:mm') : ''}</span>
                             <span className="truncate max-w-md">{note.content.replace(/\[SYSTEM.*?\]/, '').trim()}</span>
                         </div>
                    </div>
                );
            }

            // --- RENDER STANDARD NOTE (CARD) ---
            return (
                <div 
                    key={note.id} 
                    onMouseEnter={() => onHoverNote?.(note.linkedPolicyIds)}
                    onMouseLeave={() => onHoverNote?.(undefined)}
                    className={`relative pl-12 py-4 group transition-all ${isHighlighted ? 'bg-zinc-50 dark:bg-zinc-800/50 -mx-4 px-4 rounded-xl' : ''}`}
                >
                    <div className={`absolute left-0 top-5 w-10 h-10 rounded-full border-4 border-white dark:border-zinc-950 flex items-center justify-center z-10 shadow-sm ${iconBg}`}>
                        <Icon size={16} />
                    </div>

                    <div className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm relative transition-all hover:shadow-md ${isHighlighted ? 'border-red-300 dark:border-red-900 ring-1 ring-red-100' : 'border-zinc-100 dark:border-zinc-800'} ${isEditing ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}>
                        
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-2">
                                    {isValid(dateObj) ? format(dateObj, 'dd.MM.yyyy', { locale: pl }) : '---'}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-300">
                                    {isValid(dateObj) ? format(dateObj, 'HH:mm') : ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!isEditing && (
                                    <button 
                                        onClick={() => startEditing(note)}
                                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                        title="Edytuj notatkę"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                )}
                                
                                <DeleteSafetyButton 
                                    onConfirm={() => onDeleteNote(note.id)}
                                    iconSize={14}
                                    popoverPlacement="left"
                                />
                            </div>
                        </div>

                        {isEditing ? (
                            <div className="space-y-2">
                                <textarea 
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    onKeyDown={handleEditingKeyDown} 
                                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    rows={4}
                                    autoFocus
                                />
                                <label className="flex items-center gap-1.5 cursor-pointer w-fit" title="Data notatki">
                                    <Calendar size={12} className="text-zinc-400" />
                                    <span className="text-[9px] font-black uppercase text-zinc-400">Data:</span>
                                    <input
                                        type="date"
                                        value={editingDate}
                                        onChange={(e) => setEditingDate(e.target.value)}
                                        max={format(new Date(), 'yyyy-MM-dd')}
                                        className="bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>
                                {clientPolicies.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[9px] font-black uppercase text-zinc-400 mr-1">Przypisz do:</span>
                                        {clientPolicies.map(p => {
                                            const on = editingLinks.includes(p.id);
                                            return (
                                                <button key={p.id} type="button"
                                                    onClick={() => setEditingLinks(prev => on ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                                                    className={`px-2 py-1 rounded-lg text-[9px] font-bold border transition-colors ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-blue-300'}`}
                                                >
                                                    {p.vehicleBrand || p.type}{p.vehicleReg && <span className="text-[11px] font-black tabular-nums ml-1">{p.vehicleReg}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex gap-2 justify-end">
                                    <button onClick={cancelEditing} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50">Anuluj</button>
                                    <button onClick={saveEditing} className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
                                        <Save size={12}/> Zapisz
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                {isReminder && reminderInfo ? (
                                    <div className={`p-3 rounded-xl border-2 mb-2 flex items-start gap-3 ${isCompleted ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                        <button 
                                            onClick={() => handleToggleReminderStatus(note)}
                                            className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-red-300 hover:border-red-500'}`}
                                        >
                                            {isCompleted && <CheckCircle2 size={14} />}
                                        </button>
                                        <div>
                                            {/* Wyraźne oznaczenie że to pozycja z Terminarza (2026-07-27) — każda notatka
                                                z reminderDate (format [data]_PRZYPOMNIENIE_...) pojawia się w kalendarzu,
                                                niezależnie czy powstała tu, czy jako "Szybkie Zadanie" w CalendarView.tsx. */}
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest mb-1 ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                <Clock size={9} /> Terminarz
                                            </span>
                                            <p className={`text-xs font-bold ${isCompleted ? 'text-emerald-700 line-through decoration-2' : 'text-red-700'}`}>
                                                {reminderInfo.text}
                                            </p>
                                            <p className="text-[9px] font-black uppercase text-zinc-400 mt-1 flex items-center gap-1">
                                                <Calendar size={10} /> Termin: {reminderInfo.dateStr}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium whitespace-pre-wrap">
                                        <NoteTagRenderer text={note.content} onLinkClick={handleLinkClick} />
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {note.linkedPolicyIds && note.linkedPolicyIds.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-50 dark:border-zinc-800 flex flex-wrap gap-2">
                                {note.linkedPolicyIds.map(pId => {
                                    const p = allPolicies.find(x => x.id === pId);
                                    if (!p) return null;
                                    return (
                                        <div key={p.id} className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 uppercase flex items-center gap-1 cursor-pointer hover:bg-blue-100" onClick={() => onHoverNote?.([p.id])}>
                                            <Zap size={10} /> {p.vehicleBrand || p.type}{' '}
                                            {p.vehicleReg && <span className="text-xs font-black tabular-nums normal-case">{p.vehicleReg}</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};
