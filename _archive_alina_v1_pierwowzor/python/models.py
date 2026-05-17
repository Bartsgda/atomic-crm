
from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

# --- ENUMS ---

class PolicyType(str, Enum):
    OC = 'OC'
    AC = 'AC'
    BOTH = 'BOTH'
    DOM = 'DOM'
    ZYCIE = 'ZYCIE'
    PODROZ = 'PODROZ'
    INNE = 'INNE'
    FIRMA = 'FIRMA'

class SalesStage(str, Enum):
    SPRZEDAZ = 'sprzedaż'
    SPRZEDANY = 'sprzedany'
    DO_ZROBIENIA = 'of_do zrobienia'
    W_TOKU = 'przeł kontakt'
    CZEKAM_NA_DANE = 'czekam na dane/dokum'
    OFERTA_WYSLANA = 'oferta_wysłana'
    OF_PRZEDST = 'of_przedst'
    ODRZUT = 'ucięty kontakt'
    CHLODNIA = 'rez po ofercie_kont za rok'
    ZBYCIE = 'zbycie_pojazdu'
    INNE = 'inne'

class NoteTag(str, Enum):
    ROZMOWA = 'ROZMOWA'
    RODZINA = 'RODZINA'
    OCZEKIWANIA = 'OCZEKIWANIA'
    OFERTA = 'OFERTA'
    STATUS = 'STATUS'
    PRYWATNE = 'PRYWATNE'
    IMPORT = 'IMPORT'
    WINDYKACJA = 'WINDYKACJA'
    SZKODA = 'SZKODA'
    DECISION_PRICE = 'DECISION_PRICE'
    DECISION_OFFER = 'DECISION_OFFER'
    DECISION_LATER = 'DECISION_LATER'
    WSP = 'WSP'
    AUDYT = 'AUDYT'

class VehicleSubType(str, Enum):
    OSOBOWY = 'OSOBOWY'
    CIEZAROWY = 'CIEZAROWY'
    MOTOCYKL = 'MOTOCYKL'
    QUAD = 'QUAD'
    CIAGNIK = 'CIAGNIK'
    PRZYCZEPA = 'PRZYCZEPA'
    AUTOBUS = 'AUTOBUS'
    FLOTA = 'FLOTA'
    INNE = 'INNE'

# --- SUB-MODELS ---

class CoOwner(BaseModel):
    name: str
    pesel: Optional[str] = None
    address: Optional[str] = None
    type: Optional[str] = None # PERSON, LEASING, BANK
    notes: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class AutoDetails(BaseModel):
    vehicleType: Optional[VehicleSubType] = VehicleSubType.OSOBOWY
    productionYear: Optional[str] = None
    engineCapacity: Optional[str] = None
    enginePower: Optional[str] = None
    fuelType: Optional[str] = None
    grossWeight: Optional[str] = None
    mileage: Optional[int] = None
    vehicleValue: Optional[float] = None
    vehicleValueType: Optional[str] = None # BRUTTO, NETTO
    ownership: Optional[str] = 'PRYWATNA'
    
    assistanceVariant: Optional[str] = 'PODSTAWOWY'
    towingLimitPL: Optional[str] = '100KM'
    towingLimitEU: Optional[str] = 'BRAK'
    replacementCar: Optional[str] = 'ACCIDENT_3'
    
    tires: bool = False
    windows: bool = False
    acVariant: Optional[str] = 'KOSZTORYS'
    acAmortization: Optional[bool] = True
    acDeductible: Optional[float] = 500.0
    
    coOwners: List[CoOwner] = []
    insuranceItems: Optional[str] = None

class HomeDetails(BaseModel):
    objectType: str = 'MIESZKANIE'
    constructionType: str = 'MUROWANA'
    yearBuilt: Optional[str] = None
    area: Optional[float] = None
    floor: Optional[str] = None
    totalFloors: Optional[int] = None
    photovoltaics: bool = False
    
    sumWalls: Optional[float] = 0
    sumFixedElements: Optional[float] = 0
    sumItems: Optional[float] = 0
    
    flood: bool = True
    theft: bool = True
    surges: bool = True
    ocPrivate: bool = True
    assignmentBank: Optional[str] = None
    
    coOwners: List[CoOwner] = []
    
    ownershipType: Optional[str] = 'WLASNOSC'
    businessActivity: bool = False
    businessActivityOver50: bool = False
    outbuildingsIncluded: bool = False
    securityType: str = 'STANDARD'
    historyClaims: str = 'BRAK'
    customTags: List[str] = []

class TravelParticipant(BaseModel):
    fullName: str
    birthDate: Optional[str] = None
    notes: Optional[str] = None

class TravelDetails(BaseModel):
    zone: str = 'EUROPA'
    participantsCount: int = 1
    participants: List[TravelParticipant] = []
    purpose: str = 'WYPOCZYNEK'
    skiing: bool = False
    chronicDiseases: bool = False
    alcoholClause: bool = False
    sumMedical: float = 200000.0
    durationDays: Optional[int] = 7

class LifePerson(BaseModel):
    name: str
    role: str # UBEZPIECZONY, UPOSAZONY
    pesel: Optional[str] = None
    percentShare: Optional[float] = None

class LifeDetails(BaseModel):
    lifeType: str = 'INDYWIDUALNA'
    sumDeath: float = 0
    hospital: bool = False
    seriousIllness: bool = False
    accidentDeath: bool = False
    hasBeneficiaries: bool = False
    insuredPersons: List[LifePerson] = []
    beneficiaries: List[LifePerson] = []

class PolicySubAgentShare(BaseModel):
    agentId: str
    rate: float
    amount: float
    note: Optional[str] = None

class PolicyCalculation(BaseModel):
    id: str
    insurerName: str
    premium: float
    notes: Optional[str] = None
    isSelected: bool = False
    createdAt: str

# --- MAIN MODELS ---

class BusinessEntity(BaseModel):
    name: str
    nip: Optional[str] = None
    regon: Optional[str] = None
    krs: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    zipCode: Optional[str] = None
    phones: List[str] = []
    emails: List[str] = []
    representation: Optional[str] = None
    notes: Optional[str] = None

class Client(BaseModel):
    id: str
    firstName: str
    lastName: str
    pesel: str
    birthDate: Optional[str] = None
    gender: Optional[str] = None
    phones: List[str] = []
    emails: List[str] = []
    businesses: List[BusinessEntity] = []
    street: str
    city: str
    zipCode: str
    notes: Optional[str] = None
    createdAt: str
    isAiPending: Optional[bool] = False

class Policy(BaseModel):
    id: str
    clientId: str
    type: PolicyType
    stage: SalesStage
    nextContactDate: Optional[str] = None
    insurerName: str
    policyNumber: str
    
    vehicleBrand: str
    vehicleModel: Optional[str] = None
    vehicleReg: str
    vehicleVin: str
    
    originalProductString: Optional[str] = None
    oldPolicyNumber: Optional[str] = None
    oldPremium: Optional[str] = None
    coOwner: Optional[str] = None
    oldInsurerName: Optional[str] = None
    
    sourceVerified: bool = False
    documentsStatus: Optional[str] = None
    portalStatus: Optional[str] = None
    
    propertyAddress: Optional[str] = None
    businessPKD: Optional[str] = None
    businessType: Optional[str] = None
    
    destinationCountry: Optional[str] = None
    travelStartDate: Optional[str] = None
    travelEndDate: Optional[str] = None
    
    terminationBasis: Optional[str] = 'art28'
    
    policyStartDate: str
    policyEndDate: str
    
    previousPolicyId: Optional[str] = None
    targetInsurers: List[str] = []
    calculations: List[PolicyCalculation] = []
    
    premium: float
    commission: float
    commissionRate: Optional[float] = None
    paymentStatus: Optional[str] = None # PAID, UNPAID
    
    subAgentSplits: List[PolicySubAgentShare] = []
    subAgentId: Optional[str] = None # Legacy
    subAgentRate: Optional[float] = None # Legacy
    subAgentCommission: Optional[float] = None # Legacy
    noteForSubAgent: Optional[str] = None
    
    checklist: Dict[str, bool] = {}
    hasMedicalSurvey: bool = False
    hasRodo: bool = False
    
    autoDetails: Optional[AutoDetails] = Field(default_factory=AutoDetails)
    homeDetails: Optional[HomeDetails] = Field(default_factory=HomeDetails)
    travelDetails: Optional[TravelDetails] = Field(default_factory=TravelDetails)
    lifeDetails: Optional[LifeDetails] = Field(default_factory=LifeDetails)
    
    createdAt: str

class ClientNote(BaseModel):
    id: str
    clientId: str
    content: str
    tag: NoteTag
    createdAt: str
    reminderDate: Optional[str] = None
    duration: Optional[int] = None
    linkedPolicyIds: List[str] = []
    isCompleted: bool = False

class SubAgent(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    defaultRates: Dict[str, float] = {}
