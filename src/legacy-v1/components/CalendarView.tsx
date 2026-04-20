
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AppState, CalendarEvent, CalendarEventType, ClientNote, PolicyType } from '../types';
import { 
  format, endOfMonth, eachDayOfInterval, isSameMonth, 
  isSameDay, addMonths, isToday, endOfWeek, 
  addWeeks, addDays, isBefore, isAfter,
  isValid
} from 'date-fns';
import { pl } from 'date-fns/locale/pl';
import { 
  ChevronLeft, ChevronRight, RefreshCcw, MessageSquare, CheckCircle2, 
  Clock, Calendar as CalendarIcon, LayoutGrid, Rows, History, X, 
  Banknote, FileText, Plus, AlertCircle, ArrowRight, TableProperties, StretchHorizontal, Zap, GripHorizontal,
  Car, Truck, Bike, Tractor, Bus, Container, Home, Heart, Plane, Building2, ChevronDown, ChevronUp, Ghost, Check, User, Calculator
} from 'lucide-react';
import { storage } from '../services/storage';

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onDeleteNote: (id: string) => void;
  onRefresh: () => void;
}

type ViewMode = 'month' | 'week' | 'day';

// Extended Event Interface
interface EnhancedCalendarEvent extends CalendarEvent {
    policyType?: PolicyType;
    vehicleSubType?: string;
    isSoldRenewal?: boolean; // True = Kończy się polisa, False = Lead/Zadanie
    isCalculation?: boolean; // NEW: True = To jest zadanie "Zrób kalkulację"
}

const HOUR_HEIGHT = 60;
const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_DURATION = 15;

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const getEventIcon = (event: EnhancedCalendarEvent) => {
    if (event.isCalculation) return Calculator; // Ikona kalkulatora dla zadań ofertowych

    if (event.type === 'RENEWAL') {
        if (event.policyType === 'DOM') return Home;
        if (event.policyType === 'ZYCIE') return Heart;
        if (event.policyType === 'PODROZ') return Plane;
        if (event.policyType === 'FIRMA') return Building2;
        
        if (['OC', 'AC', 'BOTH'].includes(event.policyType || '')) {
            if (event.vehicleSubType === 'CIEZAROWY') return Truck;
            if (event.vehicleSubType === 'MOTOCYKL') return Bike;
            if (event.vehicleSubType === 'CIAGNIK') return Tractor;
            if (event.vehicleSubType === 'AUTOBUS') return Bus;
            if (event.vehicleSubType === 'PRZYCZEPA') return Container;
            return Car;
        }
        return FileText;
    }
    return MessageSquare;
};

// --- NEW: EVENT POPOVER COMPONENT ---
const EventPopover = ({ event, position }: { event: EnhancedCalendarEvent, position: {x:number, y:number} }) => {
    const Icon = getEventIcon(event);
    
    // SMART POSITIONING (Prevent overflow)
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT = 200; // Expected height
    
    let left = position.x + 15;
    let top = position.y + 10;
    
    // Flip Left if too close to right edge
    if (window.innerWidth - left < POPOVER_WIDTH + 20) {
        left = position.x - POPOVER_WIDTH - 15;
    }
    
    // Flip Up if too close to bottom edge
    if (window.innerHeight - top < POPOVER_HEIGHT + 20) {
        top = position.y - POPOVER_HEIGHT - 10;
    }

    let badgeColor = 'bg-blue-50 text-blue-600';
    if (event.type === 'RENEWAL' && event.isSoldRenewal) badgeColor = 'bg-red-50 text-red-600';
    if (event.isCalculation) badgeColor = 'bg-amber-50 text-amber-600';

    return (
        <div 
            style={{ left, top }}
            className="fixed z-[9999] w-80 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border-2 border-zinc-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200 pointer-events-none flex flex-col max-h-[300px]"
        >
            <div className="flex-shrink-0 p-4 pb-2 border-b border-zinc-50 dark:border-zinc-800">
                <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl flex items-center justify-center ${badgeColor}`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">
                            {event.isCalculation ? 'ZAPLANOWANA KALKULACJA' : (event.type === 'RENEWAL' ? 'KONIEC POLISY' : 'NOTATKA / ZADANIE')}
                        </span>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            {format(event.date, 'dd.MM.yyyy')} 
                            <span className="bg-zinc-100 dark:bg-zinc-800 px-1.5 rounded text-zinc-500 font-mono">{format(event.date, 'HH:mm')}</span>
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 pt-2 scrollbar-hide overscroll-contain">
                <p className={`text-sm font-medium leading-relaxed mb-3 ${event.isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {event.title}
                </p>

                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-lg">
                    <User size={12} className="text-zinc-400" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate">{event.clientName}</span>
                </div>

                {event.isCompleted && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase">
                        <CheckCircle2 size={12} /> Zadanie wykonane
                    </div>
                )}
            </div>
        </div>
    );
};

export const CalendarView: React.FC<Props> = ({ state, onNavigate, onDeleteNote, onRefresh }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [newTaskContent, setNewTaskContent] = useState('');

  // UI State
  const [hoveredEventData, setHoveredEventData] = useState<{ event: EnhancedCalendarEvent, pos: {x:number, y:number} } | null>(null);
  const [isNextExpanded, setIsNextExpanded] = useState(false); 
  const hoverTimerRef = useRef<any>(null);

  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    renewals: true,
    meetings: true,
    tasks: true,
    history: false,
  });

  const events = useMemo(() => {
    const allEvents: EnhancedCalendarEvent[] = [];

    // A. POLISY (Wznowienia + Zaplanowane Kalkulacje)
    if (filters.renewals) {
      state.policies.forEach(policy => {
        if (policy.type === 'PODROZ') return;
        
        const client = state.clients.find(c => c.id === policy.clientId);
        const clientName = client ? `${client.lastName} ${client.firstName}` : 'Nieznany';
        const assetInfo = policy.vehicleBrand || policy.propertyAddress || policy.type;
        const regInfo = policy.vehicleReg || '';

        // 1. WZNOWIENIA (Sprzedane polisy - Data końca)
        if (policy.stage === 'sprzedaż' || policy.stage === 'sprzedany') {
            const endDate = new Date(policy.policyEndDate);
            if (isValid(endDate)) {
                allEvents.push({
                    id: `end_${policy.id}`,
                    title: `${assetInfo} ${regInfo}`,
                    date: endDate,
                    type: 'RENEWAL',
                    details: 'Koniec ochrony',
                    clientId: policy.clientId,
                    clientName: clientName,
                    relatedId: policy.id,
                    duration: 0,
                    policyType: policy.type,
                    vehicleSubType: policy.autoDetails?.vehicleType,
                    isSoldRenewal: true,
                    isCompleted: false 
                });
            }
        }

        // 2. ZAPLANOWANE KALKULACJE (Leady - Data kontaktu) - NOWOŚĆ
        // Jeśli polisa jest w trakcie ofertowania i ma ustawioną datę "nextContactDate"
        const isLead = ['of_do zrobienia', 'przeł kontakt', 'oferta_wysłana'].includes(policy.stage);
        if (isLead && policy.nextContactDate) {
            const contactDate = new Date(policy.nextContactDate);
            if (isValid(contactDate)) {
                 // Domyślnie ustawiamy godzinę 09:00 jeśli data nie ma czasu, żeby ładnie wyglądało w agendzie
                 if (contactDate.getHours() === 0) contactDate.setHours(9, 0, 0, 0);

                 allEvents.push({
                    id: `calc_${policy.id}`,
                    title: `Kalkulacja: ${assetInfo}`, // Jasny tytuł
                    date: contactDate,
                    type: 'TASK', // Traktujemy jako zadanie
                    details: 'Zaplanowane przygotowanie oferty',
                    clientId: policy.clientId,
                    clientName: clientName,
                    relatedId: policy.id,
                    duration: 60,
                    policyType: policy.type,
                    isSoldRenewal: false,
                    isCalculation: true, // Flaga dla stylów
                    isCompleted: false
                 });
            }
        }
      });
    }

    // B. Notatki (Zadania)
    state.notes.forEach(note => {
      if (note.reminderDate) {
         const dateObj = new Date(note.reminderDate);
         if (!isValid(dateObj)) return; 
         
         // CHECK STATUS based on text content [DATE]_STATUS_TEXT
         const isCompleted = note.content.includes('_UKOŃCZONE_');
         const isCancelled = note.content.includes('_ANULOWANE_');

         if (isCancelled) return; // Anulowane ukrywamy całkowicie

         const isMeeting = note.tag === 'ROZMOWA';
         const client = state.clients.find(c => c.id === note.clientId);
         const clientLabel = client ? `${client.lastName} ${client.firstName}` : 'Zadanie Systemowe';

         // Clean content from tags for display
         let cleanTitle = note.content.replace(/\[\d{4}-\d{2}-\d{2}.*?\]_(PRZYPOMNIENIE|UKOŃCZONE)_/, '').trim();
         
         if ((isMeeting && filters.meetings) || (!isMeeting && filters.tasks)) {
            allEvents.push({
                id: note.id,
                title: cleanTitle || "Przypomnienie", 
                date: dateObj,
                type: isMeeting ? 'MEETING' : 'TASK',
                details: note.tag,
                clientId: note.clientId,
                clientName: clientLabel,
                relatedId: note.id,
                isCompleted: isCompleted, // PASS STATUS
                duration: note.duration || 60,
                isSoldRenewal: false 
            });
         }
      }
    });

    return allEvents;
  }, [state, filters]);

  // --- AGENDA DATA ---
  const today = new Date();
  const startOfToday = startOfDay(today);
  const endOfToday = endOfDay(today);
  
  function endOfDay(date: Date) {
      const d = new Date(date);
      d.setHours(23, 59, 59, 999);
      return d;
  }

  // ZALEGŁE: Tylko NIEUKOŃCZONE z przeszłości
  const overdueEvents = events.filter(e => isBefore(e.date, startOfToday) && !e.isCompleted).sort((a,b) => b.date.getTime() - a.date.getTime());
  
  // DZIŚ: Wszystkie, ale posortowane (Ukończone na koniec)
  const todayEvents = events
    .filter(e => isSameDay(e.date, today))
    .sort((a,b) => {
        // 1. Ukończone na sam dół
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        // 2. Po dacie
        return a.date.getTime() - b.date.getTime();
    });
  
  // NEXT EVENTS LOGIC
  const futureEvents = events
    .filter(e => isAfter(e.date, endOfToday) && !e.isCompleted) // W przyszłości nie pokazujemy ukończonych (bo to bez sensu)
    .sort((a,b) => a.date.getTime() - b.date.getTime());
  
  const nextDisplayEvents = isNextExpanded ? futureEvents.slice(0, 20) : futureEvents.slice(0, 3);
  const hiddenCount = Math.max(0, futureEvents.length - 3);

  const getEventStyle = (event: EnhancedCalendarEvent) => {
    // 1. COMPLETED (Szary, przekreślony, najniższy priorytet wizualny)
    if (event.isCompleted) {
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 line-through opacity-70 border-l-4 border-l-zinc-300';
    }

    // 2. RENEWALS (Active Policies Ending)
    if (event.type === 'RENEWAL' && event.isSoldRenewal) {
        return 'bg-rose-50 text-rose-700 border-rose-200 border-l-4 border-l-rose-500 shadow-sm font-bold';
    }
    
    // 3. CALCULATIONS / LEADS (To Do)
    if (event.isCalculation) {
        return 'bg-amber-50 text-amber-700 border-amber-200 border-l-4 border-l-amber-500 border-dashed';
    }
    
    // 4. MEETINGS / TASKS
    if (event.type === 'MEETING') return 'bg-purple-50 text-purple-700 border-purple-200 border-l-4 border-l-purple-500';
    
    // Default Task
    return 'bg-blue-50 text-blue-700 border-blue-200 border-l-4 border-l-blue-500';
  };

  // ... [DRAG & DROP HANDLERS KEEP SAME AS PREVIOUS] ...
  const handleDragStart = (e: React.DragEvent, eventId: string) => {
      setDraggedEventId(eventId);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', eventId);
      setHoveredEventData(null); // Close popover on drag
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDropOnDay = async (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      const eventId = e.dataTransfer.getData('text/plain');
      if (!eventId) return;
      const event = events.find(ev => ev.id === eventId);
      
      // Allow moving calculations too!
      if (!event || (event.type === 'RENEWAL' && event.isSoldRenewal)) return; // Don't move sold renewals
      
      const originalDate = event.date;
      const newDate = new Date(targetDate);
      newDate.setHours(originalDate.getHours(), originalDate.getMinutes());
      
      if (event.isCalculation) {
          // Update Policy nextContactDate
          const policy = state.policies.find(p => p.id === event.relatedId);
          if (policy) {
              await storage.updatePolicy({ ...policy, nextContactDate: newDate.toISOString() });
              onRefresh();
          }
      } else {
          // Update Note
          await updateEventDate(eventId, newDate);
      }
      setDraggedEventId(null);
  };

  const updateEventDate = async (noteId: string, newDate: Date) => {
      const note = state.notes.find(n => n.id === noteId);
      if (note) {
          // UPDATE TEXT CONTENT FOR REMINDERS
          let newContent = note.content;
          if (newContent.includes(']')) {
             newContent = newContent.replace(/^\[.*?\]/, `[${format(newDate, 'yyyy-MM-dd HH:mm')}]`);
          }
          const updatedNote = { ...note, content: newContent, reminderDate: newDate.toISOString() };
          await storage.updateNote(updatedNote);
          onRefresh();
      }
  };
  
  // TOGGLE COMPLETION (NEW HELPER)
  const toggleCompletion = async (eventId: string) => {
      const note = state.notes.find(n => n.id === eventId);
      if (!note) return;

      const isCompleted = note.content.includes('_UKOŃCZONE_');
      let newContent = note.content;
      
      if (isCompleted) {
          newContent = newContent.replace('_UKOŃCZONE_', '_PRZYPOMNIENIE_');
      } else {
          newContent = newContent.replace('_PRZYPOMNIENIE_', '_UKOŃCZONE_');
      }
      
      await storage.updateNote({ ...note, content: newContent });
      onRefresh();
  };
  // ... [END DRAG HANDLERS] ...

  // Mouse Handlers
  const handleDayClick = (day: Date) => {
      const now = new Date();
      day.setHours(now.getHours() + 1, 0, 0, 0); 
      setQuickAddDate(day);
      setIsQuickAddOpen(true);
  };

  // --- HOVER LOGIC ---
  const handleEventMouseEnter = (e: React.MouseEvent, event: EnhancedCalendarEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      
      hoverTimerRef.current = setTimeout(() => {
          setHoveredEventData({ event, pos: { x, y } });
      }, 300); // Slight delay to avoid flicker
  };

  const handleEventMouseLeave = () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      setHoveredEventData(null);
  };
  
  // ... [KEEP SAVEQUICKTASK FROM PREVIOUS] ...
  const saveQuickTask = async () => {
    if (!newTaskContent.trim() || !quickAddDate) return;
    let finalContent = newTaskContent;
    let finalDate = new Date(quickAddDate);
    const timeRegex = /^(\d{1,2})[:.]?(\d{2})?\s+/;
    const timeMatch = newTaskContent.match(timeRegex);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        if (hours >= 0 && hours < 24) {
            finalDate.setHours(hours, minutes, 0, 0);
            finalContent = finalContent.replace(timeMatch[0], ''); 
        }
    }
    // NEW: FORMAT TEXT
    const formattedContent = `[${format(finalDate, 'yyyy-MM-dd HH:mm')}]_PRZYPOMNIENIE_${finalContent.trim()}`;

    const newNote: ClientNote = {
        id: `quick_task_${Date.now()}`,
        clientId: 'SYSTEM_GLOBAL', 
        content: formattedContent,
        tag: 'ROZMOWA',
        createdAt: new Date().toISOString(),
        reminderDate: finalDate.toISOString(),
        duration: 60 
    };
    await storage.addNote(newNote);
    setNewTaskContent('');
    setIsQuickAddOpen(false);
    onRefresh(); 
  };

  const renderEventBadge = (event: EnhancedCalendarEvent) => {
    const EventIcon = getEventIcon(event);
    return (
        <div 
            key={event.id}
            draggable={!event.isSoldRenewal} // Sold renewals cannot be dragged, others can
            onDragStart={(e) => handleDragStart(e, event.id)}
            onMouseEnter={(e) => handleEventMouseEnter(e, event)}
            onMouseLeave={handleEventMouseLeave}
            className={`px-1.5 py-1 rounded text-[8px] font-bold truncate leading-tight flex items-center gap-1 mb-1 cursor-pointer transition-transform hover:scale-105 active:opacity-50 ${getEventStyle(event).replace('border-l-4', 'border-l-2')}`}
            onClick={(e) => {
                e.stopPropagation();
                if(event.clientId && event.clientId !== 'SYSTEM_GLOBAL') {
                    const client = state.clients.find(c => c.id === event.clientId);
                    if(client) {
                        onNavigate('client-details', { 
                            client, 
                            highlightPolicyId: event.type === 'RENEWAL' || event.isCalculation ? event.relatedId : undefined
                        });
                    }
                }
            }}
        >
            {/* Show time for meetings/tasks/calculations */}
            {!event.isSoldRenewal && <span className="opacity-75 font-mono mr-1">{isValid(event.date) ? format(event.date, 'HH:mm') : ''}</span>}
            <EventIcon size={10} className="shrink-0" />
            <span className={`truncate ${event.isCompleted ? 'line-through' : ''}`}>{event.title}</span>
        </div>
    );
};

  // ... [RENDER MONTH/GRID KEEP SAME AS PREVIOUS] ...
  const changePeriod = (direction: 'prev' | 'next') => {
      if (viewMode === 'month') {
          setCurrentDate(d => direction === 'prev' ? addMonths(d, -1) : addMonths(d, 1));
      } else if (viewMode === 'week') {
          setCurrentDate(d => direction === 'prev' ? addWeeks(d, -1) : addWeeks(d, 1));
      } else {
          setCurrentDate(d => direction === 'prev' ? addDays(d, -1) : addDays(d, 1));
      }
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden relative">
             <div className="grid grid-cols-7 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest py-3">
                    {day}
                </div>
                ))}
            </div>
            
            <div className="grid grid-cols-7 auto-rows-fr h-full">
            {calendarDays.map(day => {
                const dayEvents = events.filter(e => isSameDay(e.date, day));
                // Sort day events for display: Completed last
                dayEvents.sort((a,b) => {
                    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                    return a.date.getTime() - b.date.getTime();
                });

                const isCurrent = isToday(day);
                const isMonth = isSameMonth(day, currentDate);

                return (
                <div 
                    key={day.toISOString()} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    onClick={() => handleDayClick(day)}
                    className={`border-b border-r border-zinc-100 dark:border-zinc-800 p-2 flex flex-col gap-1 transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 relative
                        ${!isMonth ? 'bg-zinc-50/30 dark:bg-zinc-950/50 text-zinc-300 dark:text-zinc-700' : 'bg-white dark:bg-zinc-900'}
                        ${isCurrent ? 'bg-red-50/30 dark:bg-red-900/10' : ''}
                    `}
                >
                    <div className="flex justify-between items-start">
                        <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isCurrent ? 'bg-red-600 text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            {format(day, 'd')}
                        </span>
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 overflow-hidden mt-1">
                        {dayEvents.slice(0, 4).map(renderEventBadge)}
                        {dayEvents.length > 4 && (
                            <span className="text-[8px] text-zinc-400 font-bold pl-1">+{dayEvents.length - 4} więcej...</span>
                        )}
                    </div>
                </div>
                );
            })}
            </div>
        </div>
    );
  };

  return (
    <div className="flex h-screen bg-zinc-100 dark:bg-zinc-950 overflow-hidden font-sans relative">
      
      {/* GLOBAL POPOVER */}
      {hoveredEventData && (
          <EventPopover 
              event={hoveredEventData.event} 
              position={hoveredEventData.pos} 
          />
      )}

      {/* LEFT: CALENDAR GRID (75%) */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4">
                <h1 className="text-3xl font-black text-zinc-900 dark:text-white flex items-center gap-3 tracking-tight">
                    <CalendarIcon className="text-red-600" /> Terminarz
                </h1>
                
                <div className="flex items-center bg-white dark:bg-zinc-800 rounded-xl p-1 shadow-sm border border-zinc-200 dark:border-zinc-700">
                    <button onClick={() => changePeriod('prev')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-500"><ChevronLeft size={18}/></button>
                    <span className="w-40 text-center text-sm font-black text-zinc-700 dark:text-zinc-200 capitalize select-none">
                        {viewMode === 'month' && format(currentDate, 'MMMM yyyy', { locale: pl })}
                        {viewMode === 'day' && format(currentDate, 'd MMM yyyy', { locale: pl })}
                        {viewMode === 'week' && `Tydzień ${format(currentDate, 'w')}`}
                    </span>
                    <button onClick={() => changePeriod('next')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg text-zinc-500"><ChevronRight size={18}/></button>
                </div>
                <button onClick={() => setCurrentDate(new Date())} className="text-xs font-black text-red-600 uppercase hover:underline">Dzisiaj</button>
            </div>

            <div className="flex gap-4">
                <div className="flex bg-zinc-200 dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setViewMode('month')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        <LayoutGrid size={14} /> Miesiąc
                    </button>
                    <button onClick={() => setViewMode('week')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'week' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        <TableProperties size={14} /> Tydzień
                    </button>
                    <button onClick={() => setViewMode('day')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'day' ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        <StretchHorizontal size={14} /> Dzień
                    </button>
                </div>
            </div>
        </div>

        {/* The Grid */}
        <div className="flex-1 overflow-hidden relative">
            {viewMode === 'month' && renderMonthView()}
            
            {/* Quick Add Modal */}
            {isQuickAddOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm" onClick={() => setIsQuickAddOpen(false)}>
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-2xl w-96 border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2 text-lg font-black text-zinc-900 dark:text-white">
                                <Zap size={20} className="text-amber-500" /> Szybkie Zadanie
                            </div>
                            <button onClick={() => setIsQuickAddOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><X size={18} className="text-zinc-400"/></button>
                        </div>
                        
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl mb-4 flex items-center gap-3 border border-zinc-100 dark:border-zinc-700">
                            <CalendarIcon size={18} className="text-red-600" />
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase">Planowana data</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                                    {quickAddDate ? format(quickAddDate, 'EEEE, d MMMM, HH:00', {locale: pl}) : ''}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-6">
                            <p className="text-[10px] font-black uppercase text-zinc-500">Co robimy?</p>
                            <textarea 
                                autoFocus
                                className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium focus:ring-4 focus:ring-red-50 outline-none text-zinc-900 dark:text-white"
                                placeholder="Wpisz treść... "
                                rows={3}
                                value={newTaskContent}
                                onChange={e => setNewTaskContent(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && saveQuickTask()}
                            />
                        </div>

                        <button 
                            onClick={saveQuickTask}
                            disabled={!newTaskContent.trim()}
                            className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl"
                        >
                            Zapisz w terminarzu
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* RIGHT: AGENDA SIDEBAR (25%) */}
      <div className="w-80 md:w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col h-full shadow-xl z-20">
         <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950">
             <h2 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight mb-1">Agenda</h2>
             <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                 {format(today, 'EEEE, d MMMM', { locale: pl })}
             </p>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
             {/* 1. OVERDUE SECTION (Tasks only, NOT completed) */}
             {overdueEvents.length > 0 && (
                 <div className="animate-in slide-in-from-right-4 duration-300">
                     <h3 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                         <AlertCircle size={12} /> Zaległe ({overdueEvents.length})
                     </h3>
                     <div className="space-y-2">
                         {overdueEvents.map(e => (
                             <div key={e.id} className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl group cursor-pointer hover:bg-white transition-colors">
                                 <div className="flex justify-between items-start">
                                     <div className="flex-1">
                                         <p className="text-xs font-black text-red-800 dark:text-red-400 line-clamp-1">{e.title}</p>
                                         <p className="text-[10px] text-red-600/70 font-medium truncate">{e.clientName}</p>
                                         <p className="text-[9px] text-red-400 mt-1 font-mono">{format(e.date, 'dd.MM')} • {format(e.date, 'HH:mm')}</p>
                                     </div>
                                     {!e.isSoldRenewal && (
                                         <button 
                                            onClick={() => { toggleCompletion(e.relatedId || e.id); }}
                                            className="text-red-300 hover:text-red-600 p-1 bg-white rounded-full shadow-sm"
                                            title="Oznacz jako wykonane"
                                         >
                                             <Check size={14} />
                                         </button>
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

             {/* 2. TODAY SECTION (Includes completed at bottom) */}
             <div>
                 <h3 className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                     <Clock size={12} className="text-blue-500" /> Plan na dziś
                 </h3>
                 {todayEvents.length === 0 ? (
                     <div className="text-center py-8 border-2 border-dashed border-zinc-100 rounded-2xl">
                         <p className="text-[10px] text-zinc-400 font-bold uppercase">Luźniejszy dzień?</p>
                         <button onClick={() => { setQuickAddDate(today); setIsQuickAddOpen(true); }} className="mt-2 text-blue-600 text-xs font-black hover:underline">+ Dodaj zadanie</button>
                     </div>
                 ) : (
                     <div className="space-y-2">
                         {todayEvents.map(e => {
                             const EventIcon = getEventIcon(e);
                             const isGhost = e.type === 'RENEWAL' && !e.isSoldRenewal && !e.isCalculation;

                             return (
                                 <div key={e.id} className={`p-3 bg-white dark:bg-zinc-800 border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${getEventStyle(e)}`}>
                                     <div className="flex justify-between items-start">
                                         <div onClick={() => {
                                             if(e.clientId && e.clientId !== 'SYSTEM_GLOBAL') {
                                                 const c = state.clients.find(cl => cl.id === e.clientId);
                                                 if(c) onNavigate('client-details', { 
                                                     client: c,
                                                     highlightPolicyId: (e.type === 'RENEWAL' || e.isCalculation) ? e.relatedId : undefined
                                                 });
                                             }
                                         }} className="flex-1">
                                             <div className="flex items-center gap-2 mb-1">
                                                 <span className="text-[10px] font-black bg-white/50 px-1.5 rounded">{format(e.date, 'HH:mm')}</span>
                                                 <span className="text-[9px] font-black uppercase opacity-70 flex items-center gap-1">
                                                     {isGhost ? <Ghost size={10} /> : <EventIcon size={10} />}
                                                     {e.isCalculation ? 'Kalkulacja' : (e.type === 'RENEWAL' ? 'Koniec Polisy' : 'Zadanie')}
                                                 </span>
                                             </div>
                                             <p className={`text-xs font-black leading-tight ${isGhost || e.isCompleted ? 'opacity-60' : ''} ${e.isCompleted ? 'line-through' : ''}`}>{e.title}</p>
                                             <p className="text-[10px] opacity-80 mt-0.5 truncate max-w-[180px]">{e.details || e.clientName}</p>
                                         </div>
                                         {!e.isSoldRenewal && (
                                             <button onClick={() => { toggleCompletion(e.relatedId || e.id); }} className={`p-1 rounded-full border transition-colors ${e.isCompleted ? 'bg-zinc-200 text-zinc-500 border-zinc-300' : 'bg-white border-zinc-200 text-zinc-300 hover:text-emerald-500 hover:border-emerald-500'}`}>
                                                 {e.isCompleted ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current"></div>}
                                             </button>
                                         )}
                                     </div>
                                 </div>
                             );
                         })}
                     </div>
                 )}
             </div>

             {/* 3. UPCOMING SECTION (EXPANDABLE) */}
             <div>
                 <button 
                    onClick={() => setIsNextExpanded(!isNextExpanded)}
                    className="w-full flex items-center justify-between text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 hover:text-zinc-600 transition-colors"
                 >
                     <span className="flex items-center gap-2"><ArrowRight size={12} /> Następne (+{futureEvents.length})</span>
                     {isNextExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                 </button>

                 <div className="space-y-2 opacity-80 hover:opacity-100 transition-opacity">
                     {futureEvents.length === 0 ? <p className="text-[10px] text-zinc-300 italic pl-1">Brak planów.</p> : nextDisplayEvents.map(e => (
                         <div key={e.id} className="flex items-center gap-3 p-2 border-b border-zinc-100 dark:border-zinc-800">
                             <div className={`w-1.5 h-1.5 rounded-full ${e.isSoldRenewal ? 'bg-red-500' : (e.isCalculation ? 'bg-amber-500' : 'bg-zinc-300')}`}></div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between">
                                    <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 truncate">{e.title}</p>
                                    <p className="text-[9px] text-zinc-400 font-mono ml-2">{format(e.date, 'dd.MM')}</p>
                                 </div>
                             </div>
                         </div>
                     ))}
                     
                     {hiddenCount > 0 && !isNextExpanded && (
                         <button onClick={() => setIsNextExpanded(true)} className="text-[9px] font-bold text-blue-500 hover:underline w-full text-center mt-2">
                             + {hiddenCount} więcej...
                         </button>
                     )}
                 </div>
             </div>

         </div>
      </div>

    </div>
  );
};
