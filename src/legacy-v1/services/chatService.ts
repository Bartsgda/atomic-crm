/**
 * chatService — warstwa AI asystenta „Karateka" dla CRM-ALINA (legacy-v1).
 *
 * Spina trzy gotowe fundamenty (NIE modyfikuje ich — tylko konsumuje API):
 *   - piiTokenizer  → buildClientContext / rehydrate / PII_SYSTEM_INSTRUCTION (zgodność RODO)
 *   - clientInsights → Insight[] (deterministyczne okazje/pilne rzeczy, bez AI)
 *   - apiKeyStore    → klucz + model per przeznaczenie ("main")
 *
 * Model: Google Gemini wołany BEZPOŚREDNIO z przeglądarki przez @google/genai
 * (osobny, równoległy setup client-side — NIE router :4000). [[project_crm_ai_gemini_client_side]]
 *
 * ── ZASADA BEZWZGLĘDNA (RODO, Bartek 2026-07-24) ─────────────────────────────
 * Do modelu WOLNO wysłać wyłącznie `context` z buildClientContext (PII już jako
 * tokeny <TYP:id>) + PII_SYSTEM_INSTRUCTION. Każdą odpowiedź modelu ZAWSZE
 * przepuszczamy przez rehydrate(odpowiedź, map) PRZED zwróceniem. Nigdy nie
 * logujemy prawdziwych danych osobowych.
 *
 * Każda metoda jest async i zwraca `string` (rehydrated) albo `null` gdy brak
 * klucza AI (lub błąd wywołania modelu).
 */

import { GoogleGenAI } from "@google/genai";
import { Client, Policy, ClientNote } from "../types";
import {
  buildClientContext,
  rehydrate,
  PII_SYSTEM_INSTRUCTION,
} from "./piiTokenizer";
import type { TokenMap } from "./piiTokenizer";
import { apiKeyStore } from "./apiKeyStore";
import type { Insight } from "./clientInsights";

/** Turn w konwersacji czatu (rola zgodna z Gemini: "user" | "model"). */
export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/** Rola/persona asystentki — wspólny nagłówek system-promptu. */
const ASSISTANT_ROLE =
  "Jesteś asystentką agentki ubezpieczeniowej Aliny. Masz pełne dane klienta " +
  "(poniżej). Odpowiadaj rzeczowo, po polsku, zwięźle i konkretnie. Dane osobowe " +
  "wstawiaj WYŁĄCZNIE jako tokeny <TYP:id> — nigdy nie zgaduj prawdziwych wartości.";

/** Połączenie z modelem gotowe do użycia (albo null gdy brak klucza). */
interface AiConn {
  ai: GoogleGenAI;
  model: string;
}

/** Pobierz klucz+model dla przeznaczenia "main"; null gdy brak klucza. */
function connect(): AiConn | null {
  const apiKey = apiKeyStore.get("main");
  if (!apiKey) return null;
  return {
    ai: new GoogleGenAI({ apiKey }),
    model: apiKeyStore.getModel("main"),
  };
}

/**
 * Wspólny helper wywołania modelu z system-instruction + treścią, z bezpiecznym
 * rehydrate. `context`/`map` pochodzą z buildClientContext.
 * @param conn     połączenie (klucz+model)
 * @param systemInstruction  pełny system-prompt (rola + PII_SYSTEM_INSTRUCTION + kontekst)
 * @param contents pojedyncza treść (string) lub tablica turn-ów rozmowy
 * @param map      TokenMap do rehydrate odpowiedzi (pusta = brak podmian)
 */
async function run(
  conn: AiConn,
  systemInstruction: string,
  contents: string | { role: "user" | "model"; parts: { text: string }[] }[],
  map: TokenMap,
): Promise<string | null> {
  const response = await conn.ai.models.generateContent({
    model: conn.model,
    contents,
    config: { systemInstruction },
  });
  const raw = response.text;
  if (!raw) return null;
  return rehydrate(raw, map);
}

/**
 * 1) Konwersacyjny czat o kliencie — pełny kontekst + historia + nowe pytanie.
 * PII do modelu tylko jako tokeny; odpowiedź rehydrated przed zwróceniem.
 */
async function askAboutClient(
  client: Client,
  policies: Policy[],
  notes: ClientNote[],
  history: ChatTurn[],
  userMessage: string,
): Promise<string | null> {
  const conn = connect();
  if (!conn) return null;

  const { context, map } = buildClientContext(client, policies, notes);
  const systemInstruction = `${ASSISTANT_ROLE}\n\n${PII_SYSTEM_INSTRUCTION}\n\n## DANE KLIENTA (tokenizowane)\n${context}`;

  const contents = [
    ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  try {
    return await run(conn, systemInstruction, contents, map);
  } catch (e) {
    console.error("chatService.askAboutClient error:", e);
    return null;
  }
}

/**
 * 2) Mini-ocena klienta z notatek/danych: charakter, preferencje kontaktu,
 * wrażliwości (cena/obsługa), lojalność, uwagi specjalne + 1 zdanie „jak podejść".
 */
async function clientMiniReview(
  client: Client,
  policies: Policy[],
  notes: ClientNote[],
): Promise<string | null> {
  const conn = connect();
  if (!conn) return null;

  const { context, map } = buildClientContext(client, policies, notes);
  const systemInstruction = `${ASSISTANT_ROLE}\n\n${PII_SYSTEM_INSTRUCTION}\n\n## DANE KLIENTA (tokenizowane)\n${context}`;

  const instruction = [
    "Na podstawie powyższych danych i notatek przygotuj KRÓTKĄ mini-ocenę klienta,",
    "punktowo (myślniki). Uwzględnij, o ile wynika z danych:",
    "- charakter / styl rozmowy,",
    "- preferencje kontaktu (np. czy nie dzwonić przed 17, czy woli e-mail albo SMS),",
    "- wrażliwości (na cenę czy na obsługę/jakość),",
    "- lojalność (jak długo z Aliną, ile polis),",
    "- uwagi specjalne / czerwone flagi.",
    "Na końcu dodaj JEDNO zdanie zaczynające się od: Jak podejść — z konkretną wskazówką.",
    "Bądź zwięzła. Nie wymyślaj faktów, których nie ma w danych.",
  ].join("\n");

  try {
    return await run(conn, systemInstruction, instruction, map);
  } catch (e) {
    console.error("chatService.clientMiniReview error:", e);
    return null;
  }
}

/**
 * 3) Draft maila ofertowego (temat + treść), spersonalizowany wg polis/pojazdów,
 * uwzględnia wznowienia i luki w ochronie. `hint` = dodatkowa intencja Aliny.
 * Model używa tokenów (<NAZWISKO:..>, <REJ:..>) — rehydrate podmienia je na realne dane.
 */
async function draftOfferMail(
  client: Client,
  policies: Policy[],
  notes: ClientNote[],
  hint?: string,
): Promise<string | null> {
  const conn = connect();
  if (!conn) return null;

  const { context, map } = buildClientContext(client, policies, notes);
  const systemInstruction = `${ASSISTANT_ROLE}\n\n${PII_SYSTEM_INSTRUCTION}\n\n## DANE KLIENTA (tokenizowane)\n${context}`;

  const instruction = [
    "Napisz profesjonalny, uprzejmy mail ofertowy do klienta w imieniu Aliny.",
    "Format:",
    "Temat: <zwięzły temat>",
    "<treść maila>",
    "",
    "Zasady:",
    "- personalizuj wg posiadanych polis i pojazdów klienta,",
    "- wskaż nadchodzące wznowienia oraz luki w ochronie (cross-sell) jeśli występują,",
    "- ton rzeczowy i ciepły, bez nachalności, zakończ podpisem „Alina",
    "- imię/nazwisko, nr rejestracyjny itp. wstawiaj jako tokeny (<NAZWISKO:..>, <REJ:..>).",
    hint ? `\nDodatkowa intencja od Aliny: ${hint}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await run(conn, systemInstruction, instruction, map);
  } catch (e) {
    console.error("chatService.draftOfferMail error:", e);
    return null;
  }
}

/**
 * 4) Zachęta dla Aliny na podstawie policzonych Insightów — jedna KRÓTKA,
 * wspierająca wiadomość o NAJWAŻNIEJSZEJ rzeczy (najwyższy priorytet).
 * Insighty nie zawierają PII (tytuły ogólne) → rehydrate zbędny (map pusta).
 */
async function nudgeFromInsights(insights: Insight[]): Promise<string | null> {
  const conn = connect();
  if (!conn) return null;
  if (!insights.length) return null;

  // najważniejszy = najwyższy priorytet (nie zakładamy, że lista jest posortowana)
  const top = insights.reduce((a, b) => (b.priority > a.priority ? b : a));

  const systemInstruction =
    "Jesteś wspierającą asystentką agentki Aliny. Piszesz jedno krótkie, " +
    "zachęcające zdanie (maks. 2), które delikatnie nakłania do zajęcia się " +
    "jedną konkretną sprawą. Ton wspierający, po polsku (np. zaczynając od: może zajmiemy się…). " +
    "Bez tokenów, bez danych osobowych.";

  const instruction = [
    "Najważniejsza sprawa do zaproponowania Alinie:",
    `- rodzaj: ${top.kind}`,
    `- tytuł: ${top.title}`,
    `- szczegóły: ${top.detail}`,
    "Napisz jedną krótką, ciepłą zachętę do zajęcia się tą sprawą.",
  ].join("\n");

  try {
    // map pusta — insighty są bez PII; rehydrate no-op, ale trzymamy dyscyplinę przepływu.
    return await run(conn, systemInstruction, instruction, {});
  } catch (e) {
    console.error("chatService.nudgeFromInsights error:", e);
    return null;
  }
}

export const chatService = {
  askAboutClient,
  clientMiniReview,
  draftOfferMail,
  nudgeFromInsights,
};
