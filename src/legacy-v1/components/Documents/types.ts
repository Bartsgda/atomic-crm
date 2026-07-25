/**
 * types.ts — model dokumentu w Centrum Dokumentów.
 *
 * FAZA TERAZ: dokumenty żyją wyłącznie w pamięci (React state).
 * TODO storage: docelowo każdy dokument zyska pola typu `remotePath` / `bucket`
 * (Supabase Storage bucket per klient / Cloudflare) oraz metadane OCR
 * (np. `ocrVin`, `ocrPolicyNumber`) wyciągane przez Flash/Gemma.
 */

export type DocKind = "image" | "pdf";
export type DocStatus = "processing" | "ready" | "error";

export interface ClientDocument {
  id: string;
  clientId: string;
  kind: DocKind;
  name: string;
  status: DocStatus;
  createdAt: string;

  // opcjonalny kontekst (pojazd / dom / polisa)
  policyId?: string;
  contextLabel?: string;

  // --- obraz ---
  /** oryginalny plik trzymany w pamięci do ponownego obrotu + przyszłego uploadu */
  originalFile?: File;
  /** object URL przetworzonego JPEG (revoke przy usuwaniu / odmontowaniu) */
  displayUrl?: string;
  width?: number;
  height?: number;
  /** obrót nałożony ręcznie ponad korekcję EXIF: 0 | 90 | 180 | 270 */
  rotation?: number;

  // --- pdf ---
  /** object URL do podglądu / otwarcia PDF */
  pdfUrl?: string;
  /** oryginalny plik PDF (do przyszłego uploadu) */
  pdfFile?: File;

  sizeBytes?: number;
}
