
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AppState, CalendarEvent, CalendarEventType, ClientNote, PolicyType, Client, DayTaskOrder } from '../types';
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
import { isRenewable } from '../services/clientInsights';

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

const IMIENINY: Record<string, string> = {
  "01-01": "Marii, Mieszka", "01-02": "Izydora, Makarego", "01-03": "Genowefy, Daniela",
  "01-04": "Anieli, Tytusa", "01-05": "Edwarda, Szymona", "01-06": "Kacpra, Melchiora",
  "01-07": "Juliana, Lucjana", "01-08": "Seweryna", "01-09": "Marcjanny, Marcelego",
  "01-10": "Wilhelma, Danuty", "01-11": "Honoraty", "01-12": "Ernesta, Benedykty",
  "01-13": "Bogumiły, Weroniki", "01-14": "Feliksa, Niny", "01-15": "Arnolda, Pawła",
  "01-16": "Marcelego, Włodzimierza", "01-17": "Antoniego", "01-18": "Piotra",
  "01-19": "Henryka, Mariusza", "01-20": "Fabioli, Sebastiana", "01-21": "Agnieszki",
  "01-22": "Anastazji, Wincentego", "01-23": "Ildefonsa, Rajmunda", "01-24": "Tymoteusza, Felicji",
  "01-25": "Pawła, Elwiry", "01-26": "Pauliny, Tymoteusza", "01-27": "Przybysława, Anieli",
  "01-28": "Tomasza, Radomysła", "01-29": "Józefa, Józefy", "01-30": "Macieja, Martyny",
  "01-31": "Marceli, Marceliny",
  "02-01": "Brygidy, Ignacego", "02-02": "Marii, Piotra", "02-03": "Błażeja, Oskara",
  "02-04": "Andrzeja, Weroniki", "02-05": "Agaty, Adelajdy", "02-06": "Bogdana, Doroty",
  "02-07": "Ryszarda, Teodora", "02-08": "Hieronima, Sebastiana", "02-09": "Apolonii, Sabiny",
  "02-10": "Jacka, Elwiry", "02-11": "Lucjana, Eulalii", "02-12": "Eulalii, Damiana",
  "02-13": "Grzegorza, Katarzyny", "02-14": "Walentego, Cyryla", "02-15": "Faustyny, Jowity",
  "02-16": "Julianny, Danieli", "02-17": "Zbigniewa, Aleksego", "02-18": "Szymona, Konstancji",
  "02-19": "Konrada, Arnolda", "02-20": "Leona, Eucherego", "02-21": "Eleonory, Wiktora",
  "02-22": "Marty, Piotra", "02-23": "Romany, Polikarpa", "02-24": "Macieja, Sergiusza",
  "02-25": "Cezarego, Wiktora", "02-26": "Aleksandra, Mirosławy", "02-27": "Gabriela, Leandra",
  "02-28": "Macieja, Romany", "02-29": "Romana",
  "03-01": "Albina, Antoniny", "03-02": "Heleny, Karola", "03-03": "Kingi, Maryny",
  "03-04": "Kazimierza, Eugeniusza", "03-05": "Oliwii, Adriana", "03-06": "Rozalii, Wiktora",
  "03-07": "Tomasza, Felicyty", "03-08": "Beaty, Renaty", "03-09": "Franciszki, Dominiki",
  "03-10": "Cypriana, Aleksandra", "03-11": "Konstantego, Benedykty", "03-12": "Grzegorza, Alojzego",
  "03-13": "Bożeny, Krystyny", "03-14": "Leontyny, Matyldy", "03-15": "Klemensa, Longina",
  "03-16": "Izydora, Hieronima", "03-17": "Patryka, Gertrudy", "03-18": "Edwarda, Cyryla",
  "03-19": "Józefa, Bogdana", "03-20": "Klaudii, Joachima", "03-21": "Benedykta, Lubomiry",
  "03-22": "Katarzyny, Bogusława", "03-23": "Pelagii, Feliksa", "03-24": "Gabriela, Marka",
  "03-25": "Marii, Wiesława", "03-26": "Emanueli, Larysy", "03-27": "Lidii, Ernesta",
  "03-28": "Anieli, Jana", "03-29": "Eustachego, Wiktoryna", "03-30": "Leonarda, Amelii",
  "03-31": "Balbiny, Gwidona",
  "04-01": "Hugona, Ireny", "04-02": "Franciszka, Klary", "04-03": "Ryszarda, Benigna",
  "04-04": "Izydora, Benedykty", "04-05": "Ireny, Wincentego", "04-06": "Celestyna, Izoldy",
  "04-07": "Donata, Jana", "04-08": "Julii, Cezaryny", "04-09": "Marii, Dymitra",
  "04-10": "Michała, Apolonii", "04-11": "Leona, Filipa", "04-12": "Juliusza, Zenona",
  "04-13": "Przemysława, Martyny", "04-14": "Bernarda, Waltera", "04-15": "Anastazji, Wacława",
  "04-16": "Cecylii, Józefiny", "04-17": "Rudolfa, Roberta", "04-18": "Bogusławy, Apoloniusza",
  "04-19": "Adolfa, Tymona", "04-20": "Agnieszki, Czesława", "04-21": "Anzelma, Konrada",
  "04-22": "Łukasza, Kai", "04-23": "Jerzego, Wojciecha", "04-24": "Grzegorza, Horacego",
  "04-25": "Marka", "04-26": "Marzeny, Klaudiusza", "04-27": "Zyty, Teofila",
  "04-28": "Walerii, Piotra", "04-29": "Katarzyny, Rity", "04-30": "Mariana, Julii",
  "05-01": "Józefa, Filipa", "05-02": "Zygmunta, Atanazego", "05-03": "Marii, Aleksandry",
  "05-04": "Moniki, Floriana", "05-05": "Ireny, Juliana", "05-06": "Filipa, Jakuba",
  "05-07": "Gizeli, Benedykta", "05-08": "Stanisława, Wiktora", "05-09": "Grzegorza, Bożydara",
  "05-10": "Izydora, Antoniny", "05-11": "Franciszka, Igi", "05-12": "Dominika, Pankracego",
  "05-13": "Serwacego, Roberta", "05-14": "Bonifacego, Macieja", "05-15": "Zofii, Izydora",
  "05-16": "Andrzeja, Brendana", "05-17": "Paschalisa, Brunona", "05-18": "Jana, Eryka",
  "05-19": "Celestyna, Joanny", "05-20": "Bernardyna, Bazylego", "05-21": "Tymoteusza, Wiktora",
  "05-22": "Julii, Romy", "05-23": "Iwony, Dezyderego", "05-24": "Joanny, Zuzanny",
  "05-25": "Urbana, Bedy", "05-26": "Filipa, Jana", "05-27": "Jana Pawła, Augustyna",
  "05-28": "Justyny, Germana", "05-29": "Benedykty, Urszuli", "05-30": "Ferdynanda, Joanny",
  "05-31": "Petroneli, Anieli",
  "06-01": "Jakuba, Filipa", "06-02": "Marianny, Erazma", "06-03": "Leszka, Tamary",
  "06-04": "Franciszka, Kwiryna", "06-05": "Bonifacego, Walburgi", "06-06": "Norberta, Pauliny",
  "06-07": "Roberta, Wiesławy", "06-08": "Seweryna, Medarda", "06-09": "Felicjana, Efrema",
  "06-10": "Małgorzaty, Bogumiła", "06-11": "Barnaby, Jana", "06-12": "Jana, Onufrego",
  "06-13": "Antoniego", "06-14": "Bazylego, Elizeusza", "06-15": "Wita, Jolanty",
  "06-16": "Alicji, Lutosławy", "06-17": "Aliny, Marcjana", "06-18": "Marka, Elżbiety",
  "06-19": "Juliana, Romy", "06-20": "Bogna, Rafaela", "06-21": "Alojzego, Radosława",
  "06-22": "Pauliny, Jana", "06-23": "Wandy, Zenona", "06-24": "Jana Chrzciciela",
  "06-25": "Łucji, Dobrosława", "06-26": "Jana, Pawła", "06-27": "Cyryla, Maryli",
  "06-28": "Ireneusza, Leona", "06-29": "Piotra, Pawła", "06-30": "Marceliny, Emilii",
  "07-01": "Tomasza, Haliny", "07-02": "Marii, Urbana", "07-03": "Tomasza Apostoła",
  "07-04": "Zygmunta, Ulryka", "07-05": "Antoniego, Kajetana", "07-06": "Dominiki, Izaaka",
  "07-07": "Cyryla, Klaudii", "07-08": "Elżbiety, Prokopa", "07-09": "Wincentego, Hieronima",
  "07-10": "Sylwany, Weroniki", "07-11": "Benedykta, Olgi", "07-12": "Jana, Gwidona",
  "07-13": "Henryka, Małgorzaty", "07-14": "Kamila, Bonawentury", "07-15": "Wiktora, Henryka",
  "07-16": "Marii, Eustachego", "07-17": "Aleksego, Jadwigi", "07-18": "Sławy, Szymona",
  "07-19": "Wincentego, Arseniusza", "07-20": "Czesława, Fryderyka", "07-21": "Daniela, Wawrzyńca",
  "07-22": "Marii Magdaleny", "07-23": "Brygidy, Apolinarego", "07-24": "Kingi, Krystyny",
  "07-25": "Jakuba, Krzysztofa", "07-26": "Anny, Joachima", "07-27": "Lilii, Celestyna",
  "07-28": "Wiktora, Nazarego", "07-29": "Marty, Serafiny", "07-30": "Piotra, Julity",
  "07-31": "Ignacego, Heleny",
  "08-01": "Alfonsa, Justyna", "08-02": "Gustawa, Euzebiego", "08-03": "Lidii, Eugeniusza",
  "08-04": "Dominika, Jana", "08-05": "Oswalda, Marii", "08-06": "Sławy, Przemysława",
  "08-07": "Kajetana, Donata", "08-08": "Cyriaka, Dominika", "08-09": "Jana, Romy",
  "08-10": "Wawrzyńca", "08-11": "Zuzanny, Klary", "08-12": "Liliany, Klary",
  "08-13": "Hipolita, Kacpra", "08-14": "Euzebiusza, Alfonsa", "08-15": "Marii, Stanisława",
  "08-16": "Joachima, Rocha", "08-17": "Anszara, Jacka", "08-18": "Ilarii, Heleny",
  "08-19": "Jana, Eudesa", "08-20": "Bernarda, Filiberta", "08-21": "Piusa, Joanny",
  "08-22": "Tymoteusza, Filipa", "08-23": "Filipa, Benedykty", "08-24": "Bartłomieja, Jerzego",
  "08-25": "Ludwika, Patrycji", "08-26": "Zefiryna, Aleksandra", "08-27": "Józefa, Moniki",
  "08-28": "Augustyna, Herminii", "08-29": "Jana, Sabiny", "08-30": "Feliksa, Rosy",
  "08-31": "Raimunda, Józefy",
  "09-01": "Idziego, Bronisława", "09-02": "Juliana, Stefana", "09-03": "Grzegorza, Szymona",
  "09-04": "Rozalii, Idziego", "09-05": "Doroty, Wawrzyńca", "09-06": "Beaty, Eugeniusza",
  "09-07": "Reginy, Melchiora", "09-08": "Marii, Adriana", "09-09": "Piotra, Sergiusza",
  "09-10": "Łukasza, Pulcherii", "09-11": "Protusa, Jacka", "09-12": "Gwidona, Radzimira",
  "09-13": "Jana, Amato", "09-14": "Wawrzyńca, Radosława", "09-15": "Marii, Nikodema",
  "09-16": "Kornelii, Cypriana", "09-17": "Roberta, Justyny", "09-18": "Ireny, Józefy",
  "09-19": "Januarego, Konstancji", "09-20": "Eustachego, Filipiny", "09-21": "Mateusza",
  "09-22": "Tomasza, Maurycego", "09-23": "Tekli, Linusa", "09-24": "Tomasza, Ruperta",
  "09-25": "Aureli, Władysławy", "09-26": "Justyny, Cypriana", "09-27": "Wincentego, Kosmy",
  "09-28": "Wacława, Wencesławy", "09-29": "Michała, Gabriela, Rafała", "09-30": "Hieronima, Honoriusza",
  "10-01": "Remigiusza, Teresy", "10-02": "Leodegara, Teofila", "10-03": "Wincentego, Gerarda",
  "10-04": "Franciszka z Asyżu", "10-05": "Faustyny, Brunona", "10-06": "Brunona, Anny",
  "10-07": "Marii Różańcowej", "10-08": "Brygidy, Pelagii", "10-09": "Dionizego, Jana",
  "10-10": "Daniela, Franciszki", "10-11": "Aleksandra, Brunona", "10-12": "Maksymiliana, Wilhelma",
  "10-13": "Edwarda, Honorata", "10-14": "Kalixta, Damiana", "10-15": "Teresy",
  "10-16": "Jana, Jadwigi", "10-17": "Edwarda, Ignacego", "10-18": "Łukasza, Justyny",
  "10-19": "Jana, Pawła z Krzyża", "10-20": "Jana, Ireny", "10-21": "Urszuli, Celiny",
  "10-22": "Filipa, Korduli", "10-23": "Jana, Marleny", "10-24": "Rafała, Antoniego",
  "10-25": "Darii, Krysty", "10-26": "Lucjana, Ewarysta", "10-27": "Sabiny, Wiktora",
  "10-28": "Szymona, Judy", "10-29": "Narcyza, Eulalii", "10-30": "Alfonsa, Zenobii",
  "10-31": "Urbana, Krzysztofa",
  "11-01": "Wszystkich Świętych", "11-02": "Bolesława, Dusz Czyść.", "11-03": "Marcina, Huberta",
  "11-04": "Karola, Emeryty", "11-05": "Elżbiety, Floriana", "11-06": "Feliksa, Leonarda",
  "11-07": "Ernesta, Józefaty", "11-08": "Seweryna, Gotfryda", "11-09": "Teodora, Wiktora",
  "11-10": "Leona, Andrzeja", "11-11": "Marcina", "11-12": "Renaty, Witolda",
  "11-13": "Beniamina, Mikołaja", "11-14": "Serafina, Wawrzyńca", "11-15": "Alberta, Leopolda",
  "11-16": "Edmunda, Małgorzaty", "11-17": "Elżbiety, Grzegorza", "11-18": "Romana, Odyty",
  "11-19": "Elżbiety, Maksymiliana", "11-20": "Edmunda, Rafała", "11-21": "Janusza, Gelasiusa",
  "11-22": "Cecylii", "11-23": "Klemensa, Kolumbana", "11-24": "Emilii, Flory",
  "11-25": "Katarzyny", "11-26": "Sylwestra, Leonarda", "11-27": "Wirgiliusza, Ody",
  "11-28": "Jozafata, Stefana", "11-29": "Saturnina, Błażeja", "11-30": "Andrzeja",
  "12-01": "Eligiusza, Blanki", "12-02": "Bibianny, Cecylii", "12-03": "Franciszka",
  "12-04": "Barbary", "12-05": "Kryspiny, Sabiny", "12-06": "Mikołaja",
  "12-07": "Ambrożego, Marka", "12-08": "Marii, Beatrycze", "12-09": "Wiesławy, Leokadii",
  "12-10": "Danieli, Julii", "12-11": "Damazego, Sabiny", "12-12": "Aleksandra, Joanny",
  "12-13": "Łucji", "12-14": "Jana, Filipa", "12-15": "Niny, Celiny",
  "12-16": "Aliny, Albiny", "12-17": "Olimpii, Łazarza", "12-18": "Bogusławy, Gracjana",
  "12-19": "Dariusza, Urbana", "12-20": "Dominiki, Bogusława", "12-21": "Tomasza",
  "12-22": "Zenona, Flawiana", "12-23": "Wiktora, Sławomira", "12-24": "Adama, Ewy",
  "12-25": "Anastazji, Bożeny", "12-26": "Szczepana, Dionizego", "12-27": "Jana Ewangelisty",
  "12-28": "Innocentych", "12-29": "Dawida, Tomasza", "12-30": "Dawida, Łukasza",
  "12-31": "Sylwestra",
};

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

    // Czerwień TYLKO dla realnie pilnych (dziś / po terminie) - nie dla każdego wznowienia
    const now = new Date();
    const isUrgent = isBefore(event.date, startOfDay(now)) || isSameDay(event.date, now);

    let badgeColor = 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300';
    if (event.type === 'RENEWAL' && event.isSoldRenewal) {
        badgeColor = isUrgent
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
    }
    if (event.isCalculation) badgeColor = 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300';

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

                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-2.5 rounded-lg">
                    <User size={14} className="text-zinc-400 shrink-0" />
                    <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 truncate">{event.clientName}</span>
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

  // --- RĘCZNA KOLEJNOŚĆ ZADAŃ W WIDOKU DZIENNYM (2026-07-27) ---
  // Osobny mechanizm od cross-day drag&drop (handleDragStart/handleDropOnDay
  // niżej) - reorder w obrębie listy dnia używa strzałek ↑/↓, nie draggable,
  // żeby zerowo kolidować z istniejącym przenoszeniem wydarzeń między dniami
  // (to samo draggable={!e.isSoldRenewal}/onDragStart zostaje nietknięte).
  const [dayTaskOrder, setDayTaskOrder] = useState<DayTaskOrder>(() => storage.getDayTaskOrder());

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<Date | null>(null);
  const [newTaskContent, setNewTaskContent] = useState('');

  // --- @MENTION (podpięcie klienta do szybkiego zadania, 2026-07-27) ---
  // mentionQuery=null -> dropdown zamknięty; '' lub tekst po "@" -> otwarty i filtrujący.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [taskClientId, setTaskClientId] = useState<string | null>(null);
  const taskTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset stanu @mention przy zamknięciu modala (nie przy każdej zmianie treści) - żeby
  // ponowne otwarcie (inny dzień/inne zadanie) nie dziedziczyło klienta z poprzedniego.
  useEffect(() => {
    if (!isQuickAddOpen) {
      setMentionQuery(null);
      setMentionActiveIndex(0);
      setTaskClientId(null);
    }
  }, [isQuickAddOpen]);

  // Esc zamyka modal Szybkiego Zadania (2026-07-27) — TYLKO gdy dropdown mentiona jest
  // zamknięty (ten ma WŁASNY Esc w onKeyDown textarea, z e.stopPropagation() - "zamknij
  // wewnętrzny dropdown najpierw" zamiast rozwalać istniejącą obsługę).
  useEffect(() => {
    if (!isQuickAddOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mentionQuery === null) setIsQuickAddOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isQuickAddOpen, mentionQuery]);

  // UI State
  const [hoveredEventData, setHoveredEventData] = useState<{ event: EnhancedCalendarEvent, pos: {x:number, y:number} } | null>(null);
  const [isNextExpanded, setIsNextExpanded] = useState(false); 
  const hoverTimerRef = useRef<any>(null);

  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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

        // 1. WZNOWIENIA (Sprzedane polisy - Data końca). 'sprzedany' (klient sprzedał auto)
        // pomijamy - nie ma czego wznawiać (przychód historyczny zostaje, patrz isSold).
        if (isRenewable(policy)) {
            const endDate = new Date(policy.policyEndDate);
            if (endDate.getUTCHours() === 0 && endDate.getUTCMinutes() === 0) endDate.setHours(9, 0, 0, 0);
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
                 // Domyślnie ustawiamy godzinę 09:00 jeśli data nie ma czasu (UTC midnight = brak czasu, po przesunięciu UTC+2 = 02:00)
                 if (contactDate.getUTCHours() === 0 && contactDate.getUTCMinutes() === 0) contactDate.setHours(9, 0, 0, 0);

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
         if (dateObj.getUTCHours() === 0 && dateObj.getUTCMinutes() === 0) dateObj.setHours(9, 0, 0, 0);
         
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

  // Czerwień = TYLKO realnie pilne (dziś lub po terminie), nie każde wznowienie.
  // Zob. CALENDAR_SPEC.md / DESIGN_SYSTEM.md - redesign 2026-07-25.
  const isEventUrgent = (event: EnhancedCalendarEvent) =>
    isBefore(event.date, startOfToday) || isSameDay(event.date, today);

  const getEventStyle = (event: EnhancedCalendarEvent) => {
    // 1. COMPLETED (Szary, przekreślony, najniższy priorytet wizualny)
    if (event.isCompleted) {
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 line-through opacity-70 border-l-4 border-l-zinc-300';
    }

    // 2. RENEWALS (Koniec ochrony polisy sprzedanej)
    if (event.type === 'RENEWAL' && event.isSoldRenewal) {
        // Pilne (dziś / po terminie): czytelny czerwono-różowy akcent
        if (isEventUrgent(event)) {
            return 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900 border-l-4 border-l-rose-500 shadow-sm font-bold';
        }
        // Jeszcze nie pilne: spokojne neutralne tło + akcent koloru motywu
        // (border-primary, nie border-l-primary: tylko ten pierwszy jest nadpisany
        // przez --primary-color motywu w App.tsx; lewa krawędź i tak jedyna z grubością)
        return 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700 border-l-4 border-primary font-bold';
    }

    // 3. CALCULATIONS / LEADS (To Do)
    if (event.isCalculation) {
        return 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900 border-l-4 border-l-amber-500 border-dashed';
    }

    // 4. MEETINGS / TASKS
    if (event.type === 'MEETING') return 'bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900 border-l-4 border-l-purple-500';

    // Default Task
    return 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900 border-l-4 border-l-blue-500';
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
  
  // --- @MENTION helpers (2026-07-27) ---
  // Zwraca aktualnie wpisywany fragment po ostatnim "@" (do pozycji kursora), albo null
  // gdy kursor nie jest w trakcie pisania mention (brak "@" przed nim, albo przerwane spacją).
  const getMentionQuery = (text: string, cursorPos: number): string | null => {
      const upToCursor = text.slice(0, cursorPos);
      const atIndex = upToCursor.lastIndexOf('@');
      if (atIndex === -1) return null;
      const between = upToCursor.slice(atIndex + 1);
      if (/\s/.test(between)) return null; // spacja = koniec mention
      return between;
  };

  const mentionMatches = useMemo(() => {
      if (mentionQuery === null) return [];
      const q = mentionQuery.toLowerCase();
      return (state.clients || [])
          .filter(c =>
              (c.lastName || '').toLowerCase().startsWith(q) ||
              (c.firstName || '').toLowerCase().startsWith(q)
          )
          .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'pl'))
          .slice(0, 8);
  }, [mentionQuery, state.clients]);

  useEffect(() => { setMentionActiveIndex(0); }, [mentionQuery]);

  const selectMentionClient = (client: Client) => {
      const el = taskTextareaRef.current;
      const cursorPos = el ? (el.selectionStart ?? newTaskContent.length) : newTaskContent.length;
      const upToCursor = newTaskContent.slice(0, cursorPos);
      const atIndex = upToCursor.lastIndexOf('@');
      if (atIndex === -1) return;
      const before = newTaskContent.slice(0, atIndex);
      const after = newTaskContent.slice(cursorPos);
      const insertion = `@${client.lastName} `;
      const newText = `${before}${insertion}${after}`;

      setNewTaskContent(newText);
      setTaskClientId(client.id);
      setMentionQuery(null);

      requestAnimationFrame(() => {
          el?.focus();
          const newCursor = before.length + insertion.length;
          el?.setSelectionRange(newCursor, newCursor);
      });
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

    // @mention (2026-07-27): jeśli podpięto klienta, notatka wiąże się z jego prawdziwym
    // clientId (widoczna też w jego profilu, zob. Notatki.tsx) zamiast sentinela
    // SYSTEM_GLOBAL (zadanie "luźne", bez przypisania - dalej wspierane).
    const newNote: ClientNote = {
        id: `quick_task_${Date.now()}`,
        clientId: taskClientId || 'SYSTEM_GLOBAL',
        content: formattedContent,
        tag: 'ROZMOWA',
        createdAt: new Date().toISOString(),
        reminderDate: finalDate.toISOString(),
        duration: 60
    };
    await storage.addNote(newNote);
    setNewTaskContent('');
    setTaskClientId(null);
    setIsQuickAddOpen(false);
    onRefresh();
  };

  const renderEventBadge = (event: EnhancedCalendarEvent) => {
    const EventIcon = getEventIcon(event);
    // Pokaż nazwisko klienta PRZED tytułem - dla wznowień/kalkulacji tytuł to dane pojazdu/adresu,
    // klient bywał zupełnie niewidoczny w kratce dnia. "Nieznany"/systemowe zadania pomijamy.
    const showClient = !!event.clientId && event.clientId !== 'SYSTEM_GLOBAL' && !!event.clientName && event.clientName !== 'Nieznany';
    return (
        <div
            key={event.id}
            draggable={!event.isSoldRenewal} // Sold renewals cannot be dragged, others can
            onDragStart={(e) => handleDragStart(e, event.id)}
            onMouseEnter={(e) => handleEventMouseEnter(e, event)}
            onMouseLeave={handleEventMouseLeave}
            className={`px-1.5 py-1 rounded text-[10px] sm:text-[11px] font-bold truncate leading-snug flex items-center gap-1 mb-1 cursor-pointer transition-transform hover:scale-105 active:opacity-50 ${getEventStyle(event).replace('border-l-4', 'border-l-2')}`}
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
            <EventIcon size={11} className="shrink-0" />
            <span className={`truncate ${event.isCompleted ? 'line-through' : ''}`}>
                {showClient ? (
                    <>
                        <span className="font-black">{event.clientName}</span>
                        <span className="opacity-60"> · </span>
                        {event.title}
                    </>
                ) : event.title}
            </span>
        </div>
    );
};

  const changePeriod = (direction: 'prev' | 'next') => {
      if (viewMode === 'month') {
          setCurrentDate(d => direction === 'prev' ? addMonths(d, -1) : addMonths(d, 1));
      } else if (viewMode === 'week') {
          setCurrentDate(d => direction === 'prev' ? addWeeks(d, -1) : addWeeks(d, 1));
      } else {
          setCurrentDate(d => direction === 'prev' ? addDays(d, -1) : addDays(d, 1));
      }
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
          {weekDays.map(day => {
            const isCur = isToday(day);
            const imieninyKey = format(day, 'MM-dd');
            return (
              <div key={day.toISOString()} className={`p-2 text-center border-r border-zinc-100 dark:border-zinc-800 last:border-r-0 ${isCur ? 'bg-zinc-100 dark:bg-zinc-800/60' : ''}`}>
                <div className="text-[10px] font-bold text-zinc-400 uppercase">{format(day, 'EEEEEE', { locale: pl })}</div>
                <div className={`text-sm font-black mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isCur ? 'bg-primary text-white' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {format(day, 'd')}
                </div>
                {IMIENINY[imieninyKey] && (
                  <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold truncate italic" title={IMIENINY[imieninyKey]}>{IMIENINY[imieninyKey]}</div>
                )}
              </div>
            );
          })}
        </div>
        {/* Events */}
        <div className="grid grid-cols-7 flex-1 overflow-y-auto">
          {weekDays.map(day => {
            const dayEvents = events.filter(e => isSameDay(e.date, day)).sort((a, b) => a.date.getTime() - b.date.getTime());
            return (
              <div key={day.toISOString()} onDragOver={handleDragOver} onDrop={(e) => handleDropOnDay(e, day)}
                onClick={() => handleDayClick(day)}
                className={`border-r border-zinc-100 dark:border-zinc-800 last:border-r-0 p-1 min-h-[200px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${isToday(day) ? 'bg-zinc-50 dark:bg-zinc-800/30' : ''}`}>
                {dayEvents.map(renderEventBadge)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Sortowanie listy dnia: najpierw wydarzenia z ręcznym order (rosnąco wg order),
  // potem reszta (bez ustawionego order) po godzinie - jak dotąd. "Nie gubi" wydarzeń
  // bez order - trafiają na koniec, chronologicznie.
  const sortDayEvents = (list: EnhancedCalendarEvent[]): EnhancedCalendarEvent[] => {
      const ordered = list
          .filter(e => dayTaskOrder[e.id] !== undefined)
          .sort((a, b) => dayTaskOrder[a.id] - dayTaskOrder[b.id]);
      const unordered = list
          .filter(e => dayTaskOrder[e.id] === undefined)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      return [...ordered, ...unordered];
  };

  // Przesuwa wydarzenie o jedną pozycję w PODANEJ (już posortowanej) liście dnia i
  // zapisuje pełną, świeżą kolejność (0..N-1) dla WSZYSTKICH wydarzeń tego dnia -
  // pierwsze użycie strzałek na dany dzień "zasiewa" order dla całej listy naraz
  // (spójne, bez dziur), kolejne użycia tylko przestawiają w obrębie już zasianego
  // zbioru. Zmienia WYŁĄCZNIE kolejność wyświetlania - nie datę wydarzenia/polisy.
  const moveDayTask = (sortedList: EnhancedCalendarEvent[], index: number, direction: -1 | 1) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= sortedList.length) return;
      const reordered = [...sortedList];
      const tmp = reordered[index];
      reordered[index] = reordered[targetIndex];
      reordered[targetIndex] = tmp;

      const newOrderForDay: DayTaskOrder = {};
      reordered.forEach((e, i) => { newOrderForDay[e.id] = i; });
      const merged = { ...dayTaskOrder, ...newOrderForDay };
      setDayTaskOrder(merged);
      storage.saveDayTaskOrder(merged);
  };

  const renderDayView = () => {
    const dayEvents = sortDayEvents(events.filter(e => isSameDay(e.date, currentDate)));
    const imieninyKey = format(currentDate, 'MM-dd');
    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {/* Day header */}
        <div className={`p-4 border-b border-zinc-100 dark:border-zinc-800 ${isToday(currentDate) ? 'bg-zinc-100 dark:bg-zinc-800/60' : 'bg-zinc-50 dark:bg-zinc-950'}`}>
          <div className="text-xs font-bold text-zinc-400 uppercase">{format(currentDate, 'EEEE', { locale: pl })}</div>
          <div className="text-2xl font-black text-zinc-800 dark:text-white">{format(currentDate, 'd MMMM yyyy', { locale: pl })}</div>
          {IMIENINY[imieninyKey] && (
            <div className="text-xs text-zinc-400 dark:text-zinc-500 font-bold mt-0.5 italic">Imieniny: {IMIENINY[imieninyKey]}</div>
          )}
        </div>
        {/* Events list */}
        <div className="flex-1 overflow-y-auto p-3">
          {dayEvents.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center mt-8">Brak wydarzeń na ten dzień</p>
          ) : (
            <div className="space-y-1">
              {dayEvents.map((e, idx) => {
                const EventIcon = getEventIcon(e);
                return (
                  <div key={e.id} draggable={!e.isSoldRenewal} onDragStart={(ev) => handleDragStart(ev, e.id)}
                    onMouseEnter={(ev) => handleEventMouseEnter(ev, e)} onMouseLeave={handleEventMouseLeave}
                    onClick={() => {
                      if (e.clientId && e.clientId !== 'SYSTEM_GLOBAL') {
                        const client = state.clients.find(c => c.id === e.clientId);
                        if (client) onNavigate('client-details', { client, highlightPolicyId: e.type === 'RENEWAL' || e.isCalculation ? e.relatedId : undefined });
                      }
                    }}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:scale-[1.01] transition-transform ${getEventStyle(e)}`}>
                    <span className="text-xs font-mono opacity-60 w-10 shrink-0">{isValid(e.date) && !e.isSoldRenewal ? format(e.date, 'HH:mm') : '——'}</span>
                    <EventIcon size={14} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      {e.clientName && e.clientId !== 'SYSTEM_GLOBAL' && (
                        <div className={`text-sm font-black truncate ${e.isCompleted ? 'line-through opacity-50' : ''}`}>{e.clientName}</div>
                      )}
                      <div className={`text-xs font-bold truncate ${e.clientName && e.clientId !== 'SYSTEM_GLOBAL' ? 'opacity-70 mt-0.5' : ''} ${e.isCompleted ? 'line-through opacity-50' : ''}`}>{e.title}</div>
                    </div>
                    {/* Ręczna kolejność (2026-07-27) — strzałki, NIE drag, żeby zero kolizji
                        z draggable powyżej (przenoszenie między dniami, osobny mechanizm). */}
                    <div className="flex flex-col shrink-0 -my-1">
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); moveDayTask(dayEvents, idx, -1); }}
                        disabled={idx === 0}
                        title="Przesuń wyżej"
                        className="p-0.5 rounded text-current opacity-50 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(ev) => { ev.stopPropagation(); moveDayTask(dayEvents, idx, 1); }}
                        disabled={idx === dayEvents.length - 1}
                        title="Przesuń niżej"
                        className="p-0.5 rounded text-current opacity-50 hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none transition-opacity"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Selected day events (for mobile panel)
    const selectedDayEvents = selectedDay
      ? events
          .filter(e => isSameDay(e.date, selectedDay))
          .sort((a, b) => {
            if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
            return a.date.getTime() - b.date.getTime();
          })
      : [];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden relative">
             <div className="grid grid-cols-7 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800">
                {['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Ndz'].map(day => (
                <div key={day} className="text-center text-[10px] font-black text-zinc-400 uppercase tracking-widest py-3">
                    {day}
                </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-hidden">
            {calendarDays.map(day => {
                const dayEvents = events.filter(e => isSameDay(e.date, day));
                // Sort day events for display: Completed last
                dayEvents.sort((a,b) => {
                    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
                    return a.date.getTime() - b.date.getTime();
                });

                const isCurrent = isToday(day);
                const isMonth = isSameMonth(day, currentDate);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                // Mobile dot color: first event color hint (czerwień tylko gdy realnie pilne)
                const dotColorClass = dayEvents.length === 0
                  ? ''
                  : dayEvents[0].isSoldRenewal
                    ? (isEventUrgent(dayEvents[0]) ? 'bg-rose-500' : 'bg-primary')
                    : dayEvents[0].isCalculation
                      ? 'bg-amber-500'
                      : dayEvents[0].type === 'MEETING'
                        ? 'bg-purple-500'
                        : 'bg-blue-500';

                // Imieniny key for this day
                const imieninyKey = format(day, 'MM-dd');
                const imieninyText = IMIENINY[imieninyKey] || null;

                return (
                <div
                    key={day.toISOString()}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    onClick={() => handleDayClick(day)}
                    className={`border-b border-r border-zinc-100 dark:border-zinc-800 p-1 sm:p-2 flex flex-col gap-1 transition-all cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 relative
                        ${!isMonth ? 'bg-zinc-50/30 dark:bg-zinc-950/50 text-zinc-300 dark:text-zinc-700' : 'bg-white dark:bg-zinc-900'}
                        ${isCurrent ? 'bg-zinc-100/70 dark:bg-zinc-800/50' : ''}
                        ${isSelected ? 'ring-2 ring-inset ring-blue-400' : ''}
                    `}
                >
                    {/* Day number + day-of-week abbreviation */}
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1">
                            <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isCurrent ? 'bg-primary text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                {format(day, 'd')}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-300 dark:text-zinc-600 uppercase">
                                {format(day, 'EEEEEE', { locale: pl })}
                            </span>
                        </div>
                        {imieninyText && (
                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold leading-tight truncate max-w-full px-0.5 mt-0.5 block italic" title={`Imieniny: ${imieninyText}`}>
                                {imieninyText}
                            </span>
                        )}
                    </div>

                    {/* DESKTOP: full event badges */}
                    <div className="hidden sm:flex flex-1 flex-col gap-0.5 overflow-hidden mt-1">
                        {dayEvents.slice(0, 4).map(renderEventBadge)}
                        {dayEvents.length > 4 && (
                            <span className="text-[8px] text-zinc-400 font-bold pl-1">+{dayEvents.length - 4} więcej...</span>
                        )}
                    </div>

                    {/* MOBILE: compact dot + count badge */}
                    {dayEvents.length > 0 && (
                        <div
                            className="sm:hidden flex items-center gap-1 mt-0.5"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDay(prev => (prev && isSameDay(prev, day)) ? null : day);
                            }}
                        >
                            <span className={`w-2 h-2 rounded-full ${dotColorClass}`} />
                            <span className="text-[9px] font-black text-zinc-500 dark:text-zinc-400">{dayEvents.length}</span>
                        </div>
                    )}
                </div>
                );
            })}
            </div>

            {/* MOBILE: Selected-day event panel */}
            {selectedDay && (
                <div className="sm:hidden border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 max-h-60 overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-zinc-700 dark:text-zinc-200 capitalize">
                            {format(selectedDay, 'EEEE, d MMMM', { locale: pl })}
                        </span>
                        <button
                            onClick={() => setSelectedDay(null)}
                            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    {selectedDayEvents.length === 0 ? (
                        <p className="text-[10px] text-zinc-400 italic">Brak wydarzeń.</p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {selectedDayEvents.map(renderEventBadge)}
                        </div>
                    )}
                </div>
            )}
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
                    <CalendarIcon className="text-primary" /> Terminarz
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
                <button onClick={() => setCurrentDate(new Date())} className="text-xs font-black text-primary uppercase hover:underline">Dzisiaj</button>
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
            {viewMode === 'week' && renderWeekView()}
            {viewMode === 'day' && renderDayView()}
            
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
                            <CalendarIcon size={18} className="text-primary" />
                            <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase">Planowana data</p>
                                <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">
                                    {quickAddDate ? format(quickAddDate, 'EEEE, d MMMM, HH:00', {locale: pl}) : ''}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2 mb-6 relative">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase text-zinc-500">Co robimy?</p>
                                <p className="text-[9px] font-bold text-zinc-400">@nazwisko podpina klienta</p>
                            </div>
                            <textarea
                                ref={taskTextareaRef}
                                autoFocus
                                className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium focus:ring-2 focus:ring-primary outline-none text-zinc-900 dark:text-white"
                                placeholder="Wpisz treść... np. @Kowalski zadzwonić w sprawie OC"
                                rows={3}
                                value={newTaskContent}
                                onChange={e => {
                                    setNewTaskContent(e.target.value);
                                    setMentionQuery(getMentionQuery(e.target.value, e.target.selectionStart ?? e.target.value.length));
                                }}
                                onKeyDown={e => {
                                    if (mentionQuery !== null && mentionMatches.length > 0) {
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setMentionActiveIndex(i => (i + 1) % mentionMatches.length); return; }
                                        if (e.key === 'ArrowUp') { e.preventDefault(); setMentionActiveIndex(i => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
                                        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); selectMentionClient(mentionMatches[mentionActiveIndex]); return; }
                                        // stopPropagation: żeby Esc zamknął TYLKO dropdown mentiona, nie od razu
                                        // cały modal Szybkiego Zadania (window-level listener niżej w pliku).
                                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMentionQuery(null); return; }
                                    }
                                    if (e.key === 'Enter' && !e.shiftKey) saveQuickTask();
                                }}
                            />

                            {/* @MENTION DROPDOWN — dopasowanie po nazwisku/imieniu (prefix, case-insensitive) */}
                            {mentionQuery !== null && mentionMatches.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                    {mentionMatches.map((c, idx) => (
                                        <button
                                            type="button"
                                            key={c.id}
                                            onClick={() => selectMentionClient(c)}
                                            onMouseEnter={() => setMentionActiveIndex(idx)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold transition-colors ${idx === mentionActiveIndex ? 'bg-zinc-100 dark:bg-zinc-700 text-primary' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                                        >
                                            <User size={12} className="text-zinc-400 shrink-0" />
                                            {c.lastName} {c.firstName}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {taskClientId && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                                    <User size={11} /> Zadanie zostanie przypięte do klienta
                                    <button type="button" onClick={() => setTaskClientId(null)} className="text-zinc-400 hover:text-red-500 underline">(odepnij)</button>
                                </div>
                            )}
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
             {IMIENINY[format(today, 'MM-dd')] && (
                 <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5 italic">
                     Imieniny: {IMIENINY[format(today, 'MM-dd')]}
                 </p>
             )}
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
                             <div key={e.id} className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded-xl group cursor-pointer hover:bg-white dark:hover:bg-rose-950/50 transition-colors">
                                 <div className="flex justify-between items-start">
                                     <div className="flex-1 min-w-0">
                                         {e.clientName && e.clientId !== 'SYSTEM_GLOBAL' && (
                                             <p className="text-sm font-black text-rose-900 dark:text-rose-200 truncate">{e.clientName}</p>
                                         )}
                                         <p className="text-xs font-bold text-rose-700/90 dark:text-rose-300/90 line-clamp-1 mt-0.5">{e.title}</p>
                                         <p className="text-[10px] text-rose-500 dark:text-rose-400/80 mt-1 font-mono">{format(e.date, 'dd.MM')} • {format(e.date, 'HH:mm')}</p>
                                     </div>
                                     {!e.isSoldRenewal && (
                                         <button
                                            onClick={() => { toggleCompletion(e.relatedId || e.id); }}
                                            className="text-rose-300 hover:text-rose-600 p-1 bg-white dark:bg-zinc-900 rounded-full shadow-sm shrink-0"
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
                                         }} className="flex-1 min-w-0">
                                             <div className="flex items-center gap-2 mb-1">
                                                 <span className="text-[11px] font-black bg-white/60 dark:bg-black/20 px-1.5 py-0.5 rounded">{format(e.date, 'HH:mm')}</span>
                                                 <span className="text-[10px] font-black uppercase opacity-70 flex items-center gap-1">
                                                     {isGhost ? <Ghost size={11} /> : <EventIcon size={11} />}
                                                     {e.isCalculation ? 'Kalkulacja' : (e.type === 'RENEWAL' ? 'Koniec Polisy' : 'Zadanie')}
                                                 </span>
                                             </div>
                                             {e.clientName && e.clientId !== 'SYSTEM_GLOBAL' && (
                                                 <p className={`text-sm font-black leading-tight truncate ${isGhost || e.isCompleted ? 'opacity-60' : ''} ${e.isCompleted ? 'line-through' : ''}`}>{e.clientName}</p>
                                             )}
                                             <p className={`text-xs font-bold leading-tight truncate mt-0.5 ${e.clientName && e.clientId !== 'SYSTEM_GLOBAL' ? 'opacity-80' : (isGhost || e.isCompleted ? 'opacity-60' : '')} ${e.isCompleted && !(e.clientName && e.clientId !== 'SYSTEM_GLOBAL') ? 'line-through' : ''}`}>{e.title}</p>
                                             {e.details && <p className="text-[10px] opacity-70 mt-0.5 truncate max-w-[200px]">{e.details}</p>}
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
                             {/* Przyszłe wznowienia (poza dziś) nie są jeszcze "pilne" - kolor motywu, nie czerwień */}
                             <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.isSoldRenewal ? 'bg-primary' : (e.isCalculation ? 'bg-amber-500' : 'bg-zinc-300')}`}></div>
                             <div className="flex-1 min-w-0">
                                 <div className="flex justify-between items-baseline gap-2">
                                    <p className="text-xs font-black text-zinc-700 dark:text-zinc-200 truncate">
                                        {e.clientName && e.clientId !== 'SYSTEM_GLOBAL' ? e.clientName : e.title}
                                    </p>
                                    <p className="text-[10px] text-zinc-400 font-mono ml-2 shrink-0">{format(e.date, 'dd.MM')}</p>
                                 </div>
                                 {e.clientName && e.clientId !== 'SYSTEM_GLOBAL' && (
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{e.title}</p>
                                 )}
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
