
### 2026-02-09 14:45 - OFFER BATTLE (COMPARATOR)
*   **Action:** Update `PolicyFormModal.tsx`, `types.ts`, `ReverseMapper.ts`.
*   **Feature:** Implemented "Bitwa Ofert" (Offer Battle) UI inside Policy Modal.
*   **Logic:**
    *   Agents can now add multiple calculation rows (Insurer + Price + Note) to a single Offer record.
    *   Clicking "Select" promotes a calculation to the main insurer field.
    *   Rejected calculations are stored in history and exported to Excel notes.
*   **Goal:** Solve the problem of tracking multiple quotes for one lead without creating dummy records.

### 2026-02-09 14:15 - KANBAN & NOTES UX REFINEMENT (v6.7)
*   **Action:** Updates in `OffersBoard.tsx`, `ClientDetails.tsx`, `Notatki.tsx`.
*   **Kanban Drop Zones:** Added massive "Reject" (Red) and "Sell" (Green) zones at the bottom of the board for quick drag-and-drop decisions.
*   **Anti-Bounce Logic:** Implemented 60-second debounce for system notes. Rapidly moving a card back and forth no longer spams the history with `[SYSTEM] Zmiana etapu`.
*   **Contextual Notes:** In Client Panel, selecting a policy now auto-links new notes to it. Quick Status buttons (OK/W TOKU/ODRZUT) immediately update the policy status in the database.

### 2026-02-09 13:30 - CLIENT PANEL & INPUT FIXES (v6.6)
*   **Action:** Updates in `ClientFormModal.tsx`, `ClientDetails.tsx`, `Notatki.tsx`.
*   **Fix 1 (Phone Input):** Enforced dynamic character limit. Polish numbers (+48) are hard-capped at 9 digits. Other prefixes allow up to 15 digits. Fixed issue where user could type infinite digits.
*   **Fix 2 (Notes Editor):** Increased font size to `text-lg` for better readability. Added "Quick Status" bar (OK/PENDING/REJECT) above the editor to match `CLIENT_PANEL_REQUIREMENTS.md`.
*   **Fix 3 (Layout):** Adjusted Client Details grid from `2-6-4` to `3-5-4` columns to strictly adhere to the 25%/45%/30% width requirement.

### 2026-02-09 12:00 - SYSTEM SNAPSHOT (v6.5.0 STABLE)
*   **Milestone:** **FULL FEATURE LOCK** for Core Modules.
*   **State Verification:**
    *   **5 Pillars:** All Policy Forms (Auto, Home, Life, Travel) are active and standardized.
    *   **Sub-Agents:** Logic for commission splitting and reporting is fully operational.
    *   **Data Repair:** Regex-based cleaning and anomaly detection is live.
    *   **Dashboard:** New table layout with sorting and improved UX is deployed.
*   **Documentation:** All `REQUIREMENTS_LEDGER` items marked as `DONE` have been verified in code.

### 2026-02-09 06:00 - SAFE MERGE & NOTE PRESERVATION (CRITICAL FIX)
*   **Action:** Major logic update in `DataImporter.tsx`.
*   **Problem:** Merging rows was overwriting "Sold" status with "Offer" (data loss) and discarding notes from secondary rows.
*   **Fix:** 
    1.  **Status Hierarchy:** Implemented `STAGE_WEIGHT`. New data cannot downgrade status (e.g. `Offer` cannot overwrite `Sold`).
    2.  **Note Rescue:** When merging Row B into Policy A, the raw content of Row B (product string) is now saved as a `[IMPORT SCALANIE]` System Note attached to Policy A.
    3.  **Forced Append:** All user notes from merged rows are now forcefully appended to the target policy, ensuring complete history.
*   **Result:** Data integrity is preserved. Merged rows leave a clear audit trail in notes.

### 2026-02-09 05:30 - INTELLIGENT ROW MERGING (FORD FOCUS CASE)
*   **Action:** Logic enhancement in `DataImporter.tsx`.
*   **Problem:** Previous logic treated separate rows for the same vehicle (e.g. one row OC, next row AC) as separate Policies on the Dashboard.
*   **Fix:** Implemented a session-based cache (`sessionPoliciesMap`). When importing, the system checks if a policy for the same `ClientId + VehicleReg/Address` was already processed in the current file.
*   **Behavior:**
    *   If found: The new row's premium/commission is ADDED to the existing policy object.
    *   Type Upgrade: If existing was 'OC' and new is 'AC', type becomes 'BOTH'.
    *   Notes: Notes from both rows are concatenated.
*   **Result:** "Ford Focus" appears as a single tile with total premium, instead of two separate tiles.

### 2026-02-09 05:00 - IMPORTER UX TRANSPARENCY
*   **Action:** Update `DataImporter.tsx`.
*   **Feature:** Added "Total Source Rows" counter to the success screen.
*   **Logic:** System now explicitly counts every processed row from Excel (Input) and displays it alongside the created/merged policies (Output).
*   **Goal:** Provide visual confirmation to the User that all 181 rows (example) were processed, even if they resulted in fewer database records due to deduplication.
