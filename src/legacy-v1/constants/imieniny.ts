// Polish nameday — single source 2026-05-16.
// Backed by npm `imieniny@1.0.1` (MIT, 0 deps). API: ktoMaImieniny(d: Date) → string[].
// Format: mianownik (Andrzej, Szymon) — naturalny po "Imieniny:".

import { ktoMaImieniny } from "imieniny";

export function imieninyForDate(d: Date = new Date()): string {
  const names = ktoMaImieniny(d);
  return names.join(", ");
}
