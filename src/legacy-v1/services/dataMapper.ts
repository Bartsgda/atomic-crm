import type {
  Client,
  Policy,
  ClientNote,
  PolicyType,
  SalesStage,
  NoteTag,
  InsuredPerson,
} from "../types";
import { TerminationBasis } from "../types";
import { addDays, isValid, addMinutes } from "date-fns";
import { LEGACY_RECOGNITION_MAP } from "../data/legacy/index";
import {
  parseOldPolicyInfo,
  parseCoOwnerColumn,
  parseTravelParticipants,
} from "../modules/utils/secondaryParsers";
import type { ParseCoOwnerResult } from "../modules/utils/secondaryParsers";
import {
  parseHomeString,
  parseAutoString,
} from "../modules/utils/legacyParser";
import { TRAVEL_PARTICIPANTS_MAP } from "../data/legacy/travel_participants";

export class DataMapper {
  static overrideMap: Record<string, any> = {};

  static mapClientRow(
    row: any[],
  ): { client: Client; notes: ClientNote[] } | null {
    if (!row || row.length < 3) return null;

    const str = (v: any) => (v ? String(v).trim() : "");
    const id =
      str(row[0]) ||
      `c_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // BASIC VALIDATION: Ghost Check
    if (!str(row[1]) && !str(row[2]) && !str(row[3])) return null;

    const firstName = str(row[1]);
    const lastName = str(row[2]);
    const ident = str(row[3]);
    const pesel = ident.length === 11 ? ident : "";
    const nip = ident.length === 10 ? ident : "";
    const phones = str(row[4])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const emails = str(row[5])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const street = str(row[6]);
    const zipCode = str(row[7]);
    const city = str(row[8]);

    // JSON Restore
    if (row[10] && typeof row[10] === "string" && row[10].startsWith("{")) {
      try {
        const restored = JSON.parse(row[10]);
        let restoredNotes: ClientNote[] = [];
        if (row[11]) {
          try {
            restoredNotes = JSON.parse(row[11]);
          } catch {
            // intentionally empty: notes are optional in JSON restore path
          }
        }
        return { client: restored, notes: restoredNotes };
      } catch {
        // intentionally empty: fall through to normal client construction
      }
    }

    const client: Client = {
      id,
      firstName,
      lastName,
      pesel,
      phones,
      emails,
      street,
      city,
      zipCode,
      businesses: nip ? [{ name: lastName, nip, street, city, zipCode }] : [],
      createdAt: new Date().toISOString(),
    };

    const rawNotes = str(row[9]);
    const notes = mapNotesLegacy(rawNotes, id, "UNLINKED", client.createdAt);

    return { client, notes };
  }

  static mapRow(row: any[]): {
    client: Client;
    policy: Policy;
    notes: ClientNote[];
    sourceName?: string;
  } | null {
    if (!row || row.length < 5) return null;

    const str = (v: any) => (v ? String(v).trim() : "");

    // --- 1. CLIENT MAPPING ---
    const rawName = str(row[0]);
    const rawProduct = str(row[8]);

    // CRITICAL: GHOST ROW CHECK
    // Jeśli nie ma nazwy klienta I nie ma opisu produktu, to jest śmieć/pusty wiersz.
    if (rawName.length < 2 && rawProduct.length < 2) return null;

    const nipOrPesel = str(row[7]);
    const sysClientId = str(row[30]); // LINK TO MASTER CLIENT SHEET
    const sysClientJson = row[32];

    let client: Client;

    // Use legacy mapper as base or fallback
    const tempClient = mapClientLegacy(rawName, nipOrPesel, row);

    if (sysClientId) {
      // Create a stub client but use parsed names instead of empty strings
      client = {
        ...tempClient,
        id: sysClientId,
      };
    } else if (
      sysClientJson &&
      typeof sysClientJson === "string" &&
      sysClientJson.startsWith("{")
    ) {
      try {
        client = JSON.parse(sysClientJson);
      } catch {
        client = tempClient;
      }
    } else {
      client = tempClient;
    }

    // --- 2. POLICY MAPPING ---
    const sysPolicyJson = row[33];
    let policy: Policy;
    let notes: ClientNote[] = [];

    const rawNotes = str(row[19]);

    if (
      sysPolicyJson &&
      typeof sysPolicyJson === "string" &&
      sysPolicyJson.startsWith("{")
    ) {
      try {
        policy = JSON.parse(sysPolicyJson);
        if (row[34] && typeof row[34] === "string") {
          notes = JSON.parse(row[34]);
        } else {
          notes = mapNotesLegacy(
            rawNotes,
            client.id,
            policy.id,
            policy.createdAt,
          );
        }
      } catch {
        const mapped = mapPolicyLegacy(rawProduct, rawNotes, row, client);
        policy = mapped.policy;
        notes = mapped.notes;
      }
    } else {
      const mapped = mapPolicyLegacy(rawProduct, rawNotes, row, client);
      policy = mapped.policy;
      notes = mapped.notes;
    }

    const sourceName = str(row[13]);

    return {
      client,
      policy,
      notes,
      sourceName: sourceName && sourceName !== "Agent" ? sourceName : undefined,
    };
  }
}

// BUG #2 FIX: parseAddress — obsługa adresów bez prefiksu "ul."
// Zip-lookup dla Pomorza: 80-xxx Gdańsk, 81-xxx Gdynia, 83-xxx okolice, 84-xxx Puck/Władysławowo
const ZIP_CITY_MAP: Record<string, string> = {
  "80": "Gdańsk",
  "81": "Gdynia",
  "82": "Tczew",
  "83": "Starogard Gdański",
  "84": "Puck",
};

function ensureUlPrefix(s: string): string {
  if (!s) return s;
  if (/^(ul\.|al\.|os\.|pl\.|sk\.|rondo)/i.test(s)) return s;
  if (/^\d/.test(s)) return s; // adresy wiejskie "43" — bez prefiksu
  return `ul. ${s}`;
}

// BUG #2 FIX: exported — Agent #5 testy importują parseAddress z dataMapper.ts
// Zwraca zarówno `zipCode` (pole Client) jak i `zip` (alias dla testów)
export function parseAddress(raw: string): {
  street: string;
  city: string;
  zipCode: string;
  zip: string;
} {
  if (!raw) return { street: raw, city: "", zipCode: "", zip: "" };
  const zipMatch = raw.match(/(\d{2}-\d{3})/);
  if (!zipMatch) {
    return {
      street: ensureUlPrefix(raw.trim()),
      city: "",
      zipCode: "",
      zip: "",
    };
  }
  const zipCode = zipMatch[1];
  const prefix = zipCode.split("-")[0];
  const city = ZIP_CITY_MAP[prefix] ?? "";
  let rest = raw.replace(zipCode, "").trim().replace(/^,\s*/, "");
  if (city && rest.toLowerCase().startsWith(city.toLowerCase())) {
    rest = rest.slice(city.length).trim();
  }
  const street = ensureUlPrefix(rest.trim());
  return { street, city, zipCode, zip: zipCode };
}

function mapClientLegacy(
  rawName: string,
  nipOrPesel: string,
  row: any[],
): Client {
  const str = (v: any) => (v ? String(v).trim() : "");
  const date = (v: any) => {
    const d = new Date(v);
    return isValid(d) ? d.toISOString() : new Date().toISOString();
  };

  const isCompany =
    rawName.toLowerCase().includes("sp. z o.o.") ||
    rawName.toLowerCase().includes("s.a.") ||
    (nipOrPesel.length === 10 && /^\d+$/.test(nipOrPesel));

  let firstName = "";
  let lastName = rawName;

  if (!isCompany && rawName.includes(" ")) {
    const parts = rawName.split(" ");
    if (parts.length > 1) {
      lastName = parts[0];
      firstName = parts.slice(1).join(" ");
    }
  } else if (isCompany) {
    firstName = "(Firma)";
    lastName = rawName;
  }

  const clientId = `c_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  return {
    id: clientId,
    firstName,
    lastName,
    pesel: nipOrPesel.length === 11 ? nipOrPesel : "",
    phones: str(row[4])
      .split(/[,;]/)
      .map((p) => p.trim())
      .filter(Boolean),
    emails: str(row[5])
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter(Boolean),
    // BUG #2 FIX: parsuj adres zamiast zostawiać city="" zipCode=""
    ...parseAddress(str(row[6])),
    createdAt: date(row[1] || new Date()),
    businesses: isCompany
      ? [
          {
            name: rawName,
            nip: nipOrPesel.length === 10 ? nipOrPesel : undefined,
            ...parseAddress(str(row[6])),
          },
        ]
      : [],
  };
}

// BUG #1 FIX: exported — Agent #5 testy importują parseNotes z dataMapper.ts
// parseNotes(rawNotes, baseDate) to publiczne API; mapNotesLegacy to wewnętrzne (4 argumenty)
export function parseNotes(
  rawNotes: string,
  baseDate: Date | string,
): ClientNote[] {
  const baseDateStr =
    baseDate instanceof Date
      ? baseDate.toISOString()
      : (baseDate ?? new Date().toISOString());
  return mapNotesLegacy(rawNotes, "STANDALONE", "STANDALONE", baseDateStr);
}

export function mapNotesLegacy(
  rawNotes: string,
  clientId: string,
  policyId: string,
  baseDate: string,
): ClientNote[] {
  const notes: ClientNote[] = [];
  if (!rawNotes) return notes;

  // BUG #1 FIX: split po `_` LUB `\n` i wewnątrz każdego fragmentu po dacie inline (dd.mm lub dd.mm.yyyy)
  // Przykład: "a_b 11.06.2025 c" → ["a", "b", "11.06.2025 c"] → notatka "b" + notatka z datą 2025-06-11
  const roughParts = rawNotes.split(/_|\n/);
  const parts: string[] = [];
  // LEADING_DATE_RE: fragment zaczyna się od daty — data = nagłówek notatki (nie tniemy)
  const LEADING_DATE_RE = /^(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\b\s*/;
  // MID_DATE_RE: data pojawia się w środku fragmentu (poprzedzona spacją/separatorem)
  const MID_DATE_RE = /(?<=\s)(\d{1,2}\.\d{1,2}(?:\.\d{4})?\b)/;

  for (const rough of roughParts) {
    // Sprawdzamy czy w fragmencie jest wewnętrzna data (nie na samym początku)
    const trimmed = rough.trim();
    if (!trimmed) continue;

    // Jeśli fragment NIE zaczyna się od daty i MA datę w środku — tniemy na granicy daty
    const dm = MID_DATE_RE.exec(trimmed);
    if (dm && !LEADING_DATE_RE.test(trimmed)) {
      const before = trimmed.slice(0, dm.index).trim();
      const fromDate = trimmed.slice(dm.index).trim(); // data na początku → POLISH_DATE_RE ją wyciągnie
      if (before) parts.push(before);
      parts.push(fromDate);
    } else {
      parts.push(trimmed);
    }
  }

  // Regex do wyciągania daty polskiej z początku fragmentu (dd.mm lub dd.mm.yyyy)
  const POLISH_DATE_RE = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b\s*/;

  parts.forEach((part, index) => {
    let content = part.trim();
    if (!content) return;

    let tag: NoteTag = "ROZMOWA";
    let noteDate = addMinutes(new Date(baseDate), index);

    // BUG #1 FIX: wyciągaj datę polską dd.mm.yyyy z początku fragmentu
    const polishDateMatch = content.match(POLISH_DATE_RE);
    if (polishDateMatch) {
      const day = Number(polishDateMatch[1]);
      const month = Number(polishDateMatch[2]) - 1;
      const year = polishDateMatch[3]
        ? Number(polishDateMatch[3])
        : new Date().getFullYear();
      const candidate = new Date(year, month, day);
      if (isValid(candidate)) {
        noteDate = candidate;
        content = content.replace(POLISH_DATE_RE, "").trim();
      }
    }

    // Istniejące: obsługa daty w formacie [YYYY-MM-DD]
    const dateMatch = content.match(/^\[(\d{4}-\d{2}-\d{2})\]/);
    if (dateMatch) {
      const parsedDate = new Date(dateMatch[1]);
      if (isValid(parsedDate)) {
        noteDate = parsedDate;
        content = content.replace(dateMatch[0], "").trim();
      }
    }

    const tagMatch = content.match(/^\[([A-Z_]+)\]/);
    if (tagMatch) {
      const candidate = tagMatch[1];
      if (
        ["STATUS", "OFERTA", "ROZMOWA", "DECISION_PRICE"].includes(candidate)
      ) {
        tag = candidate as NoteTag;
        content = content.replace(tagMatch[0], "").trim();
      }
    } else {
      const lower = content.toLowerCase();
      if (lower.includes("nie odbiera") || lower.includes("brak tel"))
        tag = "STATUS";
      else if (lower.includes("oferta") || lower.includes("kalkulacja"))
        tag = "OFERTA";
      else if (lower.includes("rezygn") || lower.includes("odmowa"))
        tag = "DECISION_PRICE";
    }

    const effectivePolicyIds = policyId === "UNLINKED" ? [] : [policyId];

    notes.push({
      id: `n_imp_${policyId}_${index}_${Math.random().toString(36).substr(2, 4)}`,
      clientId: clientId,
      content: content,
      tag: tag,
      createdAt: noteDate.toISOString(),
      linkedPolicyIds: effectivePolicyIds,
    });
  });

  return notes;
}

function mapPolicyLegacy(
  rawProduct: string,
  rawNotes: string,
  row: any[],
  client: Client,
): { policy: Policy; notes: ClientNote[] } {
  const str = (v: any) => (v ? String(v).trim() : "");
  const money = (v: any) => {
    if (typeof v === "number") return v;
    if (!v) return 0;
    const cleaned = String(v)
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".");
    return parseFloat(cleaned) || 0;
  };
  const date = (v: any) => {
    const d = new Date(v);
    return isValid(d) ? d.toISOString() : new Date().toISOString();
  };

  const notes: ClientNote[] = [];

  const pLow = rawProduct.toLowerCase();

  // BUG #4 FIX: col[8]='?' — brak danych o produkcie, klasyfikacja domyślna OC + aiNote
  const isMissingProductData = rawProduct.trim() === "?";
  const aiNoteFromMissingData: string | undefined = isMissingProductData
    ? "BRAK DANYCH: col[8]=?, klasyfikacja domyślna"
    : undefined;

  let policyType: PolicyType = "OC";
  let vehicleBrand = "";
  let vehicleModel = "";
  let vehicleReg = "";
  let propertyAddr = "";
  let destination = "";
  let brand = "";
  let businessType = undefined;

  let autoDetails: any = { coOwners: [] };
  let homeDetails: any = { coOwners: [] };
  const travelDetails: any = {};
  const lifeDetails: any = {};
  // Zbieracze z parseCoOwnerColumn przed stworzeniem obiektu `policy`
  const pendingInsuredPersons: InsuredPerson[] = [];
  let pendingClientPesel: string | undefined = undefined;
  let travelStart: string | undefined = undefined;
  let travelEnd: string | undefined = undefined;
  let extraNoteFromLegacy: string | undefined = undefined;

  const contextFromNotes = parseAutoString(rawNotes);
  if (contextFromNotes.autoDetails) {
    autoDetails = { ...autoDetails, ...contextFromNotes.autoDetails };
  }
  const brandFromNotes = contextFromNotes.vehicleBrand;

  const trimmedKey = rawProduct.trim();
  const legacyMatch =
    LEGACY_RECOGNITION_MAP?.[rawProduct] ||
    LEGACY_RECOGNITION_MAP?.[trimmedKey] ||
    DataMapper.overrideMap?.[rawProduct] ||
    DataMapper.overrideMap?.[trimmedKey];
  const firstWordRaw = rawProduct.split(/[_ ]/)[0].toLowerCase();
  const firstWord = firstWordRaw.replace(/[^a-złęąśżźćóń]/g, "");

  if (legacyMatch) {
    policyType = legacyMatch.type;
    if (legacyMatch.vehicleBrand) vehicleBrand = legacyMatch.vehicleBrand;
    if (legacyMatch.vehicleModel) vehicleModel = legacyMatch.vehicleModel;
    if (legacyMatch.vehicleReg) vehicleReg = legacyMatch.vehicleReg;
    if (legacyMatch.propertyAddress) propertyAddr = legacyMatch.propertyAddress;
    if (legacyMatch.destinationCountry)
      destination = legacyMatch.destinationCountry;
    if (legacyMatch.businessType)
      businessType = legacyMatch.businessType as any;
    if (legacyMatch.travelStartDate) travelStart = legacyMatch.travelStartDate;
    if (legacyMatch.travelEndDate) travelEnd = legacyMatch.travelEndDate;
    if (legacyMatch.autoDetails)
      autoDetails = { ...autoDetails, ...legacyMatch.autoDetails };
    if (legacyMatch.homeDetails)
      homeDetails = { ...homeDetails, ...legacyMatch.homeDetails };
    if (legacyMatch.aiNote) extraNoteFromLegacy = legacyMatch.aiNote;
  } else if (
    [
      "dom",
      "mieszkanie",
      "lokal",
      "budowa",
      "domek",
      "nieruchomosc",
      "nieruchomość",
      "garaż",
      "garaz",
      "majątek",
      "majatek",
    ].includes(firstWord)
  ) {
    policyType = "DOM";
    if (rawProduct.includes("_")) {
      const parts = rawProduct.split("_");
      propertyAddr = parts.slice(1).join("_").trim();
    } else {
      propertyAddr = rawProduct
        .replace(new RegExp(`^${firstWordRaw}\\s?`, "i"), "")
        .trim();
    }
    const parsedHome = parseHomeString(rawProduct);
    homeDetails = { ...homeDetails, ...parsedHome };
  } else if (
    ["podróż", "podroz", "podróżne", "podrozne", "wyjazd", "turyst"].includes(
      firstWord,
    )
  ) {
    policyType = "PODROZ";
    let cleanDest = rawProduct
      .replace(/^podr[óo][żz][a-z]*_?/i, "")
      .replace(/_/g, " ")
      .replace(/(\d{1,2}[.-]\d{1,2})[.-]?\d{0,4}/g, "")
      .replace(/\d{4}/g, "")
      .replace("kontynuacja", "")
      .trim();
    if (cleanDest.startsWith(",") || cleanDest.startsWith("."))
      cleanDest = cleanDest.substring(1).trim();
    destination = cleanDest || "Świat (Nieokreślony)";
  } else if (
    ["firma", "biznes", "ocpd", "nzoz", "flota", "mienie"].includes(firstWord)
  ) {
    policyType = "FIRMA";
    brand = rawProduct
      .replace(new RegExp(`^${firstWordRaw}[_ ]?`, "i"), "")
      .trim();
  } else if (firstWord === "oc") {
    if (
      pLow.includes("działalno") ||
      pLow.includes("przedsiębiorc") ||
      pLow.includes("zawodow") ||
      pLow.includes("przewoźnik") ||
      pLow.includes("spedytor") ||
      pLow.includes("lekarz") ||
      pLow.includes("nzoz") ||
      pLow.includes("medycz") ||
      pLow.includes("fizjotera")
    ) {
      policyType = "FIRMA";
      brand = rawProduct.replace(/^oc[_ ]?/i, "").trim();
    } else {
      policyType = "OC";
      autoDetails.vehicleType = autoDetails.vehicleType || "OSOBOWY";
      const parsedProduct = parseAutoString(rawProduct);
      if (parsedProduct.vehicleReg) vehicleReg = parsedProduct.vehicleReg;
      vehicleBrand = parsedProduct.vehicleBrand || brandFromNotes || rawProduct;
      vehicleBrand = vehicleBrand.replace(/^oc[_ ]?/i, "").trim();
      autoDetails = { ...autoDetails, ...parsedProduct.autoDetails };
    }
  } else if (
    ["życie", "zycie", "life", "nnw", "szpital", "zdrowie", "śmierć"].includes(
      firstWord,
    )
  ) {
    policyType = "ZYCIE";
    brand =
      rawProduct.replace(/^(życie_|zycie_|life_|nnw_)/i, "").trim() ||
      "Polisa Życiowa";
  } else {
    if (["przyczepa", "przyczepka", "kemping"].includes(firstWord))
      autoDetails.vehicleType = "PRZYCZEPA";
    else if (["motocykl", "motor", "skuter"].includes(firstWord))
      autoDetails.vehicleType = "MOTOCYKL";
    else if (["quad", "atv"].includes(firstWord))
      autoDetails.vehicleType = "QUAD";
    else if (["ciężarowy", "ciezarowy", "dostawczy"].includes(firstWord))
      autoDetails.vehicleType = "CIEZAROWY";
    else if (["ciągnik", "ciagnik", "siodłowy"].includes(firstWord))
      autoDetails.vehicleType = "CIAGNIK";
    else if (["autobus", "bus"].includes(firstWord))
      autoDetails.vehicleType = "AUTOBUS";
    else autoDetails.vehicleType = autoDetails.vehicleType || "OSOBOWY";

    const parsedProduct = parseAutoString(rawProduct);
    if (parsedProduct.vehicleReg) vehicleReg = parsedProduct.vehicleReg;
    vehicleBrand = parsedProduct.vehicleBrand || brandFromNotes || rawProduct;
    vehicleBrand = vehicleBrand.replace(/^(samochód|pojazd|auto)[_ ]?/i, "");
    autoDetails = { ...autoDetails, ...parsedProduct.autoDetails };

    if (pLow.includes("ac") || pLow.includes("autocasco")) policyType = "AC";
    if ((pLow.includes("oc") && pLow.includes("ac")) || pLow.includes("pakiet"))
      policyType = "BOTH";
    if (!policyType) policyType = "OC";
  }

  let stage: SalesStage = "inne";
  const rawStage = str(row[2]).toLowerCase();

  if (
    rawStage === "sprzedaż" ||
    rawStage === "sprzedany" ||
    rawStage.includes("polisa")
  )
    stage = "sprzedaż";
  else if (rawStage === "of_do zrobienia") stage = "of_do zrobienia";
  else if (rawStage === "przeł kontakt") stage = "przeł kontakt";
  else if (rawStage === "czekam na dane/dokum") stage = "czekam na dane/dokum";
  else if (rawStage === "of_przedst" || rawStage.includes("przedstawiona"))
    stage = "of_przedst";
  else if (rawStage === "ucięty kontakt") stage = "ucięty kontakt";
  else if (rawStage.includes("rez po ofercie") || rawStage.includes("za rok"))
    stage = "rez po ofercie_kont za rok";
  else if (rawStage.includes("wysłana")) stage = "oferta_wysłana";

  const policyId = `p_imp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const start = travelStart ? date(travelStart) : date(row[9]);
  const nextContactDate = row[3] ? date(row[3]) : undefined;
  let endDateRaw = addDays(new Date(start), 365).toISOString();
  if (policyType === "PODROZ" && travelEnd) endDateRaw = date(travelEnd);

  // --- FINANCIAL CALCULATIONS (FIXED: NO SUBTRACTION) ---
  const prem = money(row[12]);
  const agentCommission = money(row[14]); // TO JEST COL 14 (Prowizja Agenta) - Nie odejmujemy nic!
  const subComm = money(row[15]); // TO JEST COL 15 (Prowizja Pośrednika) - Niezależna

  const commRate =
    prem > 0 ? parseFloat(((agentCommission / prem) * 100).toFixed(2)) : 0;
  const subRate =
    prem > 0 ? parseFloat(((subComm / prem) * 100).toFixed(2)) : 0;

  const oldPolicyRaw = str(row[17]);
  const coOwnerRaw = str(row[18]);
  const oldPolicyInfo = parseOldPolicyInfo(oldPolicyRaw);

  // --- SPECIAL HANDLING FOR TRAVEL PARTICIPANTS ---
  // If it's a TRAVEL policy, parse participants from column 18 instead of standard co-owners
  if (policyType === "PODROZ") {
    const rawParticipants = coOwnerRaw.trim();
    if (rawParticipants) {
      // Priority 1: Check Hardcoded Map
      if (TRAVEL_PARTICIPANTS_MAP[rawParticipants]) {
        travelDetails.participants = TRAVEL_PARTICIPANTS_MAP[rawParticipants];
      } else {
        // Priority 2: Auto-parse
        travelDetails.participants = parseTravelParticipants(rawParticipants);
      }
      travelDetails.participantsCount = travelDetails.participants.length || 1;
    }
  } else {
    // Standard logic for AUTO/HOME/ZYCIE/FIRMA
    const coOwnerInfo: ParseCoOwnerResult | null =
      parseCoOwnerColumn(coOwnerRaw);

    if (oldPolicyInfo.vehicleValue) {
      autoDetails.vehicleValue = oldPolicyInfo.vehicleValue;
      autoDetails.vehicleValueType = oldPolicyInfo.valueType;
    }

    if (coOwnerInfo === null) {
      // puste pole — nic nie robimy
    } else if (coOwnerInfo.type === "CLIENT_PESEL") {
      // BUG #3 fix: "pesel kl XXXXXXXXXXX" — PESEL głównego klienta, NIE coOwnera
      // Przechowujemy tymczasowo; EncryptionGate zaszyfruje do `pesel` w przyszłości
      pendingClientPesel = coOwnerInfo.pesel;
    } else if (coOwnerInfo.type === "INSURED_PERSON") {
      // Wzorzec #18 (row_110): "Ubezpieczony X PESEL Y" — ubezpieczony ≠ ubezpieczający
      // Mapujemy na Policy.insuredPersons (InsuredPerson[] z types.ts schema v2)
      pendingInsuredPersons.push({
        firstName: coOwnerInfo.firstName,
        lastName: coOwnerInfo.lastName ?? undefined,
        peselEncrypted: coOwnerInfo.pesel, // plaintext — PESEL_PENDING_DEK, zaszyfrować po EncryptionGate
        relation: coOwnerInfo.relation ?? undefined,
        notes: "PESEL_PENDING_DEK",
        aiExtracted: true,
      });
    } else {
      // type === 'COOWNER' — dotychczasowa logika bez zmian
      if (coOwnerInfo.ownershipType)
        autoDetails.ownership = coOwnerInfo.ownershipType;

      if (coOwnerInfo.coOwners.length > 0) {
        if (policyType === "DOM") {
          if (!homeDetails.coOwners) homeDetails.coOwners = [];
          homeDetails.coOwners.push(...coOwnerInfo.coOwners);
        } else {
          if (!autoDetails.coOwners) autoDetails.coOwners = [];
          autoDetails.coOwners.push(...coOwnerInfo.coOwners);
        }
      }

      if (coOwnerInfo.assignment) {
        notes.push({
          id: `n_imp_assign_${policyId}`,
          clientId: client.id,
          content: `[IMPORT] Wykryto cesję/bank: ${coOwnerInfo.assignment}`,
          tag: "ROZMOWA",
          createdAt: addMinutes(
            new Date(policyId.includes("_") ? start : new Date().toISOString()),
            10,
          ).toISOString(),
          linkedPolicyIds: [policyId],
        });
        if (policyType === "DOM" && !homeDetails.assignmentBank) {
          homeDetails.assignmentBank = coOwnerInfo.assignment;
        }
      }
    }
  }

  if (!vehicleBrand && !brand && !propertyAddr && !destination) {
    vehicleBrand = rawProduct;
  }

  const policy: Policy = {
    id: policyId,
    clientId: client.id,
    type: policyType,
    stage: stage,
    insurerName: str(row[11]) || "Inne",
    policyNumber: str(row[10]),
    vehicleBrand: brand || vehicleBrand,
    vehicleModel: vehicleModel,
    vehicleReg,
    vehicleVin: "",
    propertyAddress: propertyAddr,
    destinationCountry: destination,
    businessType: businessType as any,
    originalProductString: rawProduct,
    policyStartDate: start,
    policyEndDate: endDateRaw,
    nextContactDate: nextContactDate,
    premium: prem,
    commission: agentCommission, // DIRECT MAPPING (COL 14)
    commissionRate: commRate,
    subAgentCommission: subComm, // DIRECT MAPPING (COL 15)
    subAgentRate: subRate,
    noteForSubAgent: str(row[13]) !== "Agent" ? str(row[13]) : undefined,
    oldPremium: str(row[16]),
    oldPolicyNumber: oldPolicyRaw,
    oldInsurerName: oldPolicyInfo.oldInsurer,
    coOwner: coOwnerRaw,
    documentsStatus: str(row[20]),
    portalStatus: str(row[21]),
    paymentStatus: str(row[22]).toLowerCase().includes("opłac")
      ? "PAID"
      : "UNPAID",
    createdAt: date(row[1]),
    terminationBasis: TerminationBasis.ART_28,
    autoDetails: autoDetails,
    homeDetails: homeDetails,
    travelDetails: travelDetails,
    lifeDetails: lifeDetails,
    // Wzorzec #18: ubezpieczeni zebrani przed stworzeniem policy
    ...(pendingInsuredPersons.length > 0
      ? { insuredPersons: pendingInsuredPersons }
      : {}),
  };

  // BUG #4: col[8]='?' — dołącz aiNote do polisy
  if (aiNoteFromMissingData) {
    policy.aiNote =
      [policy.aiNote, aiNoteFromMissingData].filter(Boolean).join(" | ") ||
      aiNoteFromMissingData;
  }

  // BUG #3: PESEL klienta głównego z col[18] "pesel kl X" — wstrzykujemy po stworzeniu policy
  if (pendingClientPesel) {
    client.pesel_encrypted_pending = pendingClientPesel;
  }

  // Use policy start date as base for notes if row[1] (date column) is empty/invalid
  const notesBaseDate =
    row[1] && isValid(new Date(String(row[1]))) ? policy.createdAt : start;

  const notesFromLegacy = mapNotesLegacy(
    rawNotes,
    client.id,
    policy.id,
    notesBaseDate,
  );
  notes.push(...notesFromLegacy);

  if (extraNoteFromLegacy) {
    notes.push({
      id: `n_imp_ai_${policyId}`,
      clientId: client.id,
      content: `[AI CONTEXT]: ${extraNoteFromLegacy}`,
      tag: "IMPORT",
      createdAt: policy.createdAt,
      linkedPolicyIds: [policyId],
    });
  }

  return { policy, notes };
}
