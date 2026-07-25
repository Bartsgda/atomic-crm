/**
 * statusDisplay — merge STATUS_CONFIG (domyślna paleta, constants.ts) z warstwą
 * nadpisania Aliny (Edytor Statusów w Ustawieniach, storage.getStatusOverrides()).
 *
 * KLUCZOWA ZASADA: `stage` (klucz, np. "rez po ofercie_kont za rok") NIGDY się nie
 * zmienia — to mapowanie do importu XLSX i bazy. Alina nadpisuje TYLKO label/kolor.
 * Wszędzie, gdzie renderujemy status (badge/dropdown/kolumnę Kanban/notatkę systemową),
 * używaj `getStatusDisplay(stage)` zamiast bezpośrednio `STATUS_CONFIG[stage]`.
 *
 * Kontrakt: `color`/`bg`/`border` to te same domyślne klasy Tailwind co wcześniej
 * (dark-mode aware) — istniejący JSX z `${x.color} ${x.bg} border ${x.border}` działa
 * bez zmian. DOŁÓŻ tylko `style={x.style}` (dla jednego elementu z wszystkimi trzema
 * klasami naraz) lub `style={x.colorStyle}` / `style={x.bgStyle}` / `style={x.borderStyle}`
 * (gdy klasy są rozbite na osobne elementy, np. kolumny Kanban w OffersBoard.tsx).
 * Inline `style` ma pierwszeństwo nad klasą Tailwind dla tej samej właściwości CSS,
 * więc domyślne klasy mogą zostać w JSX bez warunków — override wygrywa sam.
 */
import type { CSSProperties } from "react";
import { STATUS_CONFIG } from "../constants";
import { storage } from "./storage";

export interface StatusDisplay {
  label: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
  shadow?: string;
  /** Merge {backgroundColor, color, borderColor} — gdy jeden element ma color+bg+border razem. */
  style: CSSProperties;
  colorStyle: CSSProperties;
  bgStyle: CSSProperties;
  borderStyle: CSSProperties;
}

export function getStatusDisplay(stage: string): StatusDisplay {
  const base = STATUS_CONFIG[stage] || STATUS_CONFIG["inne"];
  const ov = storage.getStatusOverrides()[stage];

  const label = ov?.label?.trim() ? ov.label.trim() : base.label;

  const colorStyle: CSSProperties = ov?.fg ? { color: ov.fg } : {};
  const bgStyle: CSSProperties = ov?.bg ? { backgroundColor: ov.bg } : {};
  // Ramka dostaje kolor tła (blend) — Alina nie ustawia osobnego koloru ramki,
  // to daje spójny, "wypełniony" wygląd plakietki zamiast domyślnej obwódki.
  const borderStyle: CSSProperties = ov?.bg ? { borderColor: ov.bg } : {};

  return {
    label,
    icon: base.icon,
    color: base.color,
    bg: base.bg,
    border: base.border,
    shadow: base.shadow,
    style: { ...bgStyle, ...colorStyle, ...borderStyle },
    colorStyle,
    bgStyle,
    borderStyle,
  };
}
