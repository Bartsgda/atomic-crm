
# BartsGda: The Vision (Autorski Masterplan - Future State)

> **⚠️ STATUS DOKUMENTU: FIKCJA PROJEKTOWA / TARGET ARCHITECTURE**
> Poniższe funkcje opisują docelowy stan systemu po wdrożeniu zewnętrznego backendu (Python/FastAPI). Obecna wersja przeglądarkowa (v4.7) realizuje ten plan w zakresie UI/UX, ale logika AI jest symulowana lub ograniczona.

---

## 1. MÓZG (LMM & Data Mining) - *Backend Required*
**Cel:** Przemielenie plików lokalnych (skany, stare Excel-e, zdjęcia) przez LMM (Large Multi-Modal Model), aby znaleźć ukryte powiązania.

*   **Logika "Rybki i Babci":** AI analizuje notatki i dokumenty.
    *   *Input:* Zdjęcie polisy na dom, gdzie w tle widać akwarium lub notatka "byłem u babci na obiedzie na Morenie".
    *   *Output AI:* "Klient ma drogą pasję (akwarystyka - szkody wodne?) i odwiedza starszą osobę w konkretnej lokalizacji (ubezpieczenie na życie/mienie babci?)."
*   **Wizualizacja Grafowa (Graph View):** (Projekt Osobny -> Integracja)
    *   Węzły: Klient, Żona, Dziecko, Sąsiad, Pracodawca.
    *   Krawędzie: Relacja ("Polecił", "Mieszka obok", "Pracują razem").

## 2. ASYSTENT GŁOSOWY (The Ear) - *Backend Required*
**Cel:** Koniec z klepaniem notatek. System słucha, rozumie i planuje.

*   **Nasłuchiwanie Live (Gemini Native Audio):**
    *   Agent rozmawia z klientem.
    *   System w tle transkrybuje i analizuje sentyment.
*   **Auto-Action:**
    *   *Scenariusz:* Klient mówi o terminach.
    *   *Reakcja:* AI wstawia zadanie do Kalendarza i taguje klienta (`RODZINA`, `PRACA_BIUROWA`).

## 3. BUSINESS INTELLIGENCE (The Scout) - *Partially Implemented*
**Cel:** Automatyczny wywiad gospodarczy przed rozmową.

*   **Input:** NIP / Nazwa firmy.
*   **AI Resercz:** Automatyczny skan KRS/CEIDG (Obecnie zaimplementowane jako proste zapytanie Gemini w `ClientFormModal`).

## 4. OSINT & SOCIAL LISTENING (The Stalker - Ethical) - *Backend Required*
**Cel:** Wyłapywanie "Momentów Życiowych" (Life Events).

*   **Monitoring FB/Insta/LinkedIn:**
    *   *Wykrycie:* Zdjęcie biletów lotniczych.
    *   *Akcja:* Powiadomienie PUSH: "Klient leci. Wyślij ofertę podróżną."

## 5. PLIKI WIEDZY (Knowledge Base)
Budowanie "Teczki osobowej 2.0". To nie są tylko polisy.
*   Hobby (Rower -> OC w życiu prywatnym, Casco roweru).
*   Zwierzęta (Ubezpieczenie kosztów leczenia psa).

---

## ROADMAPA TECHNICZNA (Bridge to Reality)

Aby przekształcić tę "Fikcję" w rzeczywistość, musimy wyjść poza przeglądarkę.

1.  **Python Backend (FastAPI):** Do obsługi ciężkich modeli LMM i scrapowania.
2.  **Vector Database (ChromaDB / Pinecone):** Do trzymania "wiedzy" i skojarzeń (RAG).
3.  **Integracja VoIP:** Aby nagrywać rozmowy (za zgodą).
4.  **Local File Watcher:** Skrypt monitorujący folder na dysku agenta.
