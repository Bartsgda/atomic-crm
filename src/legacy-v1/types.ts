
export type PolicyType = 'OC' | 'AC' | 'BOTH' | 'DOM' | 'ZYCIE' | 'PODROZ' | 'INNE' | 'FIRMA';

export type SalesStage = 
  | 'sprzedaż'
  | 'sprzedany' 
  | 'of_do zrobienia'
  | 'przeł kontakt'
  | 'czekam na dane/dokum' 
  | 'of_przedst' 
  | 'oferta_wysłana' 
  | 'ucięty kontakt'
  | 'rez po ofercie_kont za rok'
  | 'zbycie_pojazdu'
  | 'inne';

export type NoteTag = 'ROZMOWA' | 'RODZINA' | 'OCZEKIWANIA' | 'OFERTA' | 'STATUS' | 'PRYWATNE' | 'IMPORT' | 'WINDYKACJA' | 'SZKODA' | 'DECISION_PRICE' | 'DECISION_OFFER' | 'DECISION_LATER' | 'WSP' | 'AUDYT';

export type PaymentStatus = 
  | 'PAID'
  | 'UNPAID'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'INSTALLMENTS';

export enum TerminationBasis {
  ART_28 = 'art28',
  ART_28A = 'art28a',
  ART_31 = 'art31',
  OWU = 'owu',
  OTHER = 'other'
}

export interface InsurerConfig {
    id: string;
    name: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    helpdeskPhone?: string;
    isActive: boolean;
    legalName?: string;
}

export interface ChecklistItemDef {
    id: string;
    label: string;
    isRequired: boolean;
}

export type ChecklistTemplates = Record<string, ChecklistItemDef[]>;

export type VehicleSubType = 'OSOBOWY' | 'CIEZAROWY' | 'MOTOCYKL' | 'QUAD' | 'CIAGNIK' | 'PRZYCZEPA' | 'AUTOBUS' | 'FLOTA' | 'INNE';

export interface CoOwner {
    name: string;
    pesel?: string;
    address?: string;
    type?: 'PERSON' | 'LEASING' | 'BANK'; 
    notes?: string; 
    phone?: string; 
    email?: string; 
}

export interface AutoDetails {
    vehicleType?: VehicleSubType;
    
    // Dane Techniczne
    productionYear?: string; 
    engineCapacity?: string; 
    enginePower?: string;
    fuelType?: 'BENZYNA' | 'DIESEL' | 'LPG' | 'HYBRYDA' | 'ELEKTRYK';    
    grossWeight?: string;
    mileage?: number; 
    
    // Wartość i Własność
    vehicleValue?: number; 
    vehicleValueType?: 'BRUTTO' | 'NETTO';
    ownership?: 'PRYWATNA' | 'LEASING' | 'KREDYT';
    
    assistanceVariant: 'PODSTAWOWY' | 'ROZSZERZONY' | 'VIP';
    towingLimitPL: 'BRAK' | '100KM' | '200KM' | '500KM' | 'NO_LIMIT';
    towingLimitEU: 'BRAK' | '500KM' | '1000KM' | 'NO_LIMIT';
    replacementCar: 'BRAK' | 'ACCIDENT_3' | 'ALL_7' | 'MAX_21';
    tires: boolean;
    windows: boolean;
    acVariant?: 'KOSZTORYS' | 'ASO' | 'PARTNER';
    acAmortization?: boolean;
    acDeductible?: number;
    
    coOwners?: CoOwner[]; 
    insuranceItems?: string; 
}

export interface HomeDetails {
    objectType: 'MIESZKANIE' | 'DOM' | 'BUDOWA' | 'LETNISKOWY';
    constructionType: 'MUROWANA' | 'DREWNIANA';
    yearBuilt?: string;
    area?: number; 
    floor?: 'PARTER' | 'SRODKOWE' | 'OSTATNIE';
    totalFloors?: number; 
    photovoltaics?: boolean; 
    
    sumWalls?: number;
    sumFixedElements?: number;
    sumItems?: number;
    
    flood: boolean;
    theft: boolean;
    surges: boolean;
    ocPrivate: boolean;
    assignmentBank?: string;
    
    coOwners?: CoOwner[]; 

    ownershipType?: 'WLASNOSC' | 'SPOLDZIELCZE' | 'NAJEMCA' | 'WYNAJMUJACY';
    businessActivity?: boolean; 
    businessActivityOver50?: boolean; 
    outbuildingsIncluded?: boolean; 
    securityType?: 'STANDARD' | 'DRZWI_ATEST' | 'ALARM' | 'MONITORING';
    historyClaims?: 'BRAK' | '1_SZKODA' | 'WIELE';

    customTags?: string[]; 
}

export interface TravelParticipant {
    fullName: string;
    birthDate?: string; 
    notes?: string;
}

export interface TravelDetails {
    zone: 'EUROPA' | 'SWIAT';
    participantsCount: number;
    participants?: TravelParticipant[]; 
    purpose: 'WYPOCZYNEK' | 'PRACA' | 'SPORT' | 'SPORT_EXTREME';
    skiing: boolean;
    chronicDiseases: boolean;
    alcoholClause: boolean; 
    sumMedical: number;
    durationDays?: number; 
}

export interface LifePerson {
    name: string;
    role: 'UBEZPIECZONY' | 'UPOSAZONY';
    pesel?: string;
    percentShare?: number; // Dla uposażonych
}

export interface LifeDetails {
    lifeType: 'INDYWIDUALNA' | 'GRUPOWA' | 'SZKOLNA';
    sumDeath: number;
    hospital: boolean;
    seriousIllness: boolean;
    accidentDeath: boolean; 
    hasBeneficiaries?: boolean;
    insuredPersons?: LifePerson[]; // Lista ubezpieczonych (np. dzieci)
    beneficiaries?: LifePerson[]; // Lista uposażonych
}

export interface NoteHistoryEntry {
  text: string;
  createdAt: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  tag: NoteTag;
  createdAt: string;
  reminderDate?: string;
  duration?: number;
  history?: NoteHistoryEntry[];
  linkedPolicyIds?: string[];
  isCompleted?: boolean;
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  actionType?: 'CALL_OUT' | 'CALL_IN' | 'EMAIL' | 'MEETING';
}

export interface BusinessEntity {
  name: string;
  nip?: string;
  regon?: string;
  krs?: string;
  street?: string;
  city?: string;
  zipCode?: string;
  phones?: string[];
  emails?: string[];
  representation?: string;
  notes?: string; // New: AI Description
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  pesel: string;
  birthDate?: string;
  gender?: 'M' | 'F';
  phones: string[];
  emails: string[];
  businesses: BusinessEntity[];
  street: string;
  city: string;
  zipCode: string;
  notes?: string;
  createdAt: string;
  isAiPending?: boolean;
}

export interface Notification {
  id: string;
  type: 'AI_SUCCESS' | 'AI_ERROR' | 'INFO';
  message: string;
  relatedClientId?: string;
  timestamp: string;
  isRead: boolean;
}

export interface Installment {
    number: number;
    amount: number;
    deadline: string;
    isPaid: boolean;
    paidDate?: string;
}

export interface SubAgent {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    defaultRates: Record<string, number>; 
}

export interface PolicySubAgentShare {
    agentId: string;
    rate: number;
    amount: number;
    note?: string;
}

// NOWA STRUKTURA: KALKULACJE (ALTERNATYWNE OFERTY)
export interface PolicyCalculation {
    id: string;
    insurerName: string;
    premium: number;
    notes?: string; // Np. "Brak szyb", "Wymaga 2 kluczyków"
    isSelected: boolean;
    createdAt: string;
}

export interface Policy {
  id: string;
  clientId: string;
  type: PolicyType;
  stage: SalesStage; 
  nextContactDate?: string;
  insurerName: string;
  policyNumber: string;
  
  vehicleBrand: string; 
  vehicleModel?: string; 
  vehicleReg: string;
  vehicleVin: string;
  
  originalProductString?: string; 
  oldPolicyNumber?: string; 
  oldPremium?: string; 
  coOwner?: string; 
  oldInsurerName?: string; 
  
  // New: Source Verified (Hide import data)
  sourceVerified?: boolean;

  documentsStatus?: string; 
  portalStatus?: string; 

  propertyAddress?: string;
  businessPKD?: string;
  businessType?: 'MAJATEK' | 'OC_DZIALALNOSCI' | 'OC_ZAWODOWE' | 'OCPD' | 'FLOTA' | 'INNE';

  destinationCountry?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  terminationBasis: TerminationBasis;
  otherInsurerName?: string;
  otherPolicyNumber?: string;
  owuText?: string;
  isTerminationSent?: boolean;
  terminationId?: string;
  policyStartDate: string;
  policyEndDate: string;
  
  // NOWE POLE: Link do poprzedniej polisy (Wznowienie / Kontynuacja)
  previousPolicyId?: string; 
  
  // NOWE POLE: Planowane Towarzystwa (Do ofertowania)
  targetInsurers?: string[];
  
  // NOWE POLE: Historia Kalkulacji (Bitwa Ofert)
  calculations?: PolicyCalculation[];

  premium: number;      
  commission: number;
  commissionRate?: number;
  paymentStatus?: PaymentStatus;
  installments?: Installment[];

  subAgentSplits?: PolicySubAgentShare[];
  subAgentId?: string;
  subAgentRate?: number;
  subAgentCommission?: number;
  noteForSubAgent?: string;

  checklist?: Record<string, boolean>;
  hasMedicalSurvey?: boolean;
  hasRodo?: boolean;
  
  autoDetails?: AutoDetails;
  homeDetails?: HomeDetails;
  travelDetails?: TravelDetails;
  lifeDetails?: LifeDetails;
  
  createdAt: string;
  propertyDetails?: any;
}

export interface TerminationRecord {
  id: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyType: string;
  itemDescription: string;
  sentAt: string;
  actualDate: string;
  localPath?: string;
  cloudLink?: string;
  fileName?: string;
}

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'AI_OP' | 'RESTORE';
export type LogEntity = 'CLIENT' | 'POLICY' | 'NOTE' | 'TERMINATION' | 'SYSTEM' | 'SUB_AGENT';

export interface SystemLogEntry {
    id: string;
    timestamp: string;
    action: LogAction;
    entity: LogEntity;
    entityId?: string;
    details: string; 
    meta?: any; 
}

export interface DeletedItem {
    id: string;
    type: 'POLICY' | 'CLIENT' | 'NOTE';
    data: any;
    deletedAt: string;
}

export interface AppState {
  clients: Client[];
  policies: Policy[];
  notes: ClientNote[];
  notifications: Notification[];
  terminations: TerminationRecord[];
  logs: SystemLogEntry[];
  subAgents: SubAgent[];
  checklistTemplates: ChecklistTemplates; 
  insurers: string[];
  insurerConfigs?: Record<string, InsurerConfig>;
  trash?: DeletedItem[]; 
}

export type CalendarEventType = 'RENEWAL' | 'MEETING' | 'TASK' | 'HISTORY' | 'OTHER';

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: CalendarEventType;
  details?: string;
  relatedId?: string;
  clientId?: string;
  clientName?: string;
  isCompleted?: boolean;
  duration?: number;
}

export interface NLPResult {
  action: 'CREATE_NOTE' | 'SEARCH_CLIENT' | 'NAVIGATE';
  data: {
    title?: string;
    dateStr?: string;
    clientName?: string;
    noteContent?: string;
  };
}

export interface UiPreferences {
    theme: 'light' | 'dark';
    density: 'comfortable' | 'compact';
    primaryColor: string; 
    fontScale: number; 
    skin: 'default' | 'warm' | 'midnight' | 'premium';
}
