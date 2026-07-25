import React from "react";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  ZoomIn,
  ZoomOut,
  Type,
  Briefcase,
  Zap,
  Leaf,
  LayoutTemplate,
  Bold,
  Droplet,
  CaseSensitive,
  RotateCcw,
} from "lucide-react";
import { UiPreferences } from "../types";
import { FONT_FAMILY_OPTIONS } from "../constants";
import { StatusEditor } from "./Settings/StatusEditor";

interface Props {
  prefs: UiPreferences;
  onUpdate: (newPrefs: UiPreferences) => void;
}

const COLORS = [
  { label: "Czerwony (Standard)", val: "#dc2626" }, // red-600
  { label: "Niebieski (Korpo)", val: "#2563eb" }, // blue-600
  { label: "Szmaragdowy (Eco)", val: "#059669" }, // emerald-600
  { label: "Fioletowy (Premium)", val: "#7c3aed" }, // violet-600
  { label: "Bursztynowy (Warm)", val: "#d97706" }, // amber-600
  { label: "Pomarańczowy (Midnight)", val: "#fb923c" }, // orange-400
  { label: "Onyx (Minimal)", val: "#18181b" }, // zinc-900
];

export const ThemeSettings: React.FC<Props> = ({ prefs, onUpdate }) => {
  const handleColorChange = (color: string) => {
    onUpdate({ ...prefs, primaryColor: color });
    // Set CSS variable for immediate effect
    document.documentElement.style.setProperty("--primary-color", color);
  };

  const handleScaleChange = (scale: number) => {
    onUpdate({ ...prefs, fontScale: scale });
    document.documentElement.style.fontSize = `${16 * scale}px`;
  };

  // --- DESIGNER CZCIONEK (2026-07-25) ---
  const handleFontFamilyChange = (key: UiPreferences["fontFamily"]) => {
    onUpdate({ ...prefs, fontFamily: key });
    document.documentElement.style.setProperty(
      "--app-font-family",
      FONT_FAMILY_OPTIONS[key].stack,
    );
  };

  const handleFontColorChange = (color: string) => {
    onUpdate({ ...prefs, fontColor: color });
    document.documentElement.style.setProperty("--app-font-color", color);
  };

  const handleResetFontColor = () => {
    onUpdate({ ...prefs, fontColor: "" });
    document.documentElement.style.removeProperty("--app-font-color");
  };

  const handleFontBoldToggle = (bold: boolean) => {
    onUpdate({ ...prefs, fontBold: bold });
    document.documentElement.style.setProperty(
      "--app-font-weight",
      bold ? "700" : "400",
    );
    document.documentElement.setAttribute(
      "data-app-font-bold",
      bold ? "true" : "false",
    );
  };

  const applySkin = (skin: "default" | "warm" | "midnight" | "luxury-gold") => {
    let newPrefs = { ...prefs, skin };

    if (skin === "warm") {
      newPrefs = { ...newPrefs, theme: "light", primaryColor: "#d97706" };
    } else if (skin === "midnight") {
      newPrefs = { ...newPrefs, theme: "dark", primaryColor: "#fb923c" };
    } else if (skin === "luxury-gold") {
      newPrefs = { ...newPrefs, theme: "dark", primaryColor: "#d4af37" };
    } else if (skin === "default") {
      newPrefs = { ...newPrefs, theme: "dark", primaryColor: "#dc2626" };
    }

    onUpdate(newPrefs);
    document.documentElement.style.setProperty(
      "--primary-color",
      newPrefs.primaryColor,
    );
    document.documentElement.setAttribute("data-v1-skin", skin);
  };

  const applyPreset = (type: "EXEC" | "ONYX" | "FOREST") => {
    let newPrefs = { ...prefs };

    if (type === "EXEC") {
      newPrefs = {
        ...prefs,
        theme: "light",
        primaryColor: "#2563eb",
        density: "comfortable",
        fontScale: 1.0,
      };
    } else if (type === "ONYX") {
      newPrefs = {
        ...prefs,
        theme: "dark",
        primaryColor: "#ef4444",
        density: "compact",
        fontScale: 0.95,
      };
    } else if (type === "FOREST") {
      newPrefs = {
        ...prefs,
        theme: "light",
        primaryColor: "#059669",
        density: "comfortable",
        fontScale: 1.05,
      };
    }

    onUpdate(newPrefs);
    document.documentElement.style.setProperty(
      "--primary-color",
      newPrefs.primaryColor,
    );
    document.documentElement.style.fontSize = `${16 * newPrefs.fontScale}px`;
  };

  return (
    <div className="px-3 py-4 border-t border-zinc-900 mt-2 bg-zinc-950/40 rounded-xl space-y-6 animate-in slide-in-from-left-4 duration-300">
      {/* SKINS SECTION */}
      <div>
        <p className="text-[9px] uppercase font-black text-zinc-500 mb-3 tracking-wider flex items-center gap-2 px-1">
          <Zap size={10} className="text-yellow-500" /> Skórki Główne (Skins)
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => applySkin("luxury-gold")}
            className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === "luxury-gold" || prefs.skin === "premium" ? "border-[#d4af37] bg-[#d4af37]/10" : "border-zinc-800 bg-zinc-900/50 hover:border-[#d4af37]/40"}`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#121317] border border-[#d4af37]/30 flex items-center justify-center shadow-sm overflow-hidden">
              <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-[#1a1b1f]"></div>
                <div className="absolute top-2 left-2 w-4 h-0.5 bg-[#d4af37]/60 rounded-full"></div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase text-[#d4af37]">
              Gold
            </span>
          </button>

          <button
            onClick={() => applySkin("default")}
            className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === "default" ? "border-red-600 bg-red-950/20" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border-2 border-red-600 flex items-center justify-center shadow-sm overflow-hidden">
              <div className="w-full h-full bg-zinc-900 relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-zinc-800 border-r border-red-600/30"></div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase text-zinc-400">
              Zinc
            </span>
          </button>

          <button
            onClick={() => applySkin("warm")}
            className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === "warm" ? "border-amber-600 bg-amber-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#FDFAF6] border border-amber-200 flex items-center justify-center shadow-sm overflow-hidden">
              <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-[#F5EDD9]"></div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase text-zinc-400">
              Warm
            </span>
          </button>

          <button
            onClick={() => applySkin("midnight")}
            className={`flex flex-col items-center gap-2 p-2 rounded-xl border transition-all group ${prefs.skin === "midnight" ? "border-orange-500 bg-orange-500/10" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#1C1917] border border-orange-900 flex items-center justify-center shadow-sm overflow-hidden">
              <div className="w-full h-full relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-[#292524]"></div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase text-zinc-400">
              Night
            </span>
          </button>
        </div>
      </div>

      <div className="h-px bg-zinc-900 w-full"></div>

      {/* PRESETS SECTION */}
      <div>
        <p className="text-[9px] uppercase font-black text-zinc-500 mb-3 tracking-wider flex items-center gap-2 px-1">
          <LayoutTemplate size={10} /> Presety Funkcyjne
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => applyPreset("EXEC")}
            className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-white hover:border-blue-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Briefcase size={14} />
            </div>
            <span className="text-[9px] font-black uppercase text-zinc-900">
              Exec
            </span>
          </button>

          <button
            onClick={() => applyPreset("ONYX")}
            className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-zinc-900 hover:border-red-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-800 text-red-500 border border-zinc-700 flex items-center justify-center shadow-sm">
              <Zap size={14} />
            </div>
            <span className="text-[9px] font-black uppercase text-zinc-400 group-hover:text-white">
              Onyx
            </span>
          </button>

          <button
            onClick={() => applyPreset("FOREST")}
            className="flex flex-col items-center gap-2 p-2 rounded-xl border border-zinc-800 bg-emerald-50 hover:border-emerald-500 transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Leaf size={14} />
            </div>
            <span className="text-[9px] font-black uppercase text-emerald-900">
              Eco
            </span>
          </button>
        </div>
      </div>

      <div className="h-px bg-zinc-900 w-full"></div>

      <p className="text-[9px] uppercase font-black text-zinc-500 mb-2 tracking-wider flex items-center gap-2 px-1">
        <Palette size={10} /> Manualna Korekta
      </p>

      {/* Tryb Jasny / Ciemny */}
      <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
        <button
          onClick={() => onUpdate({ ...prefs, theme: "light" })}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${prefs.theme === "light" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <Sun size={12} /> Jasny
        </button>
        <button
          onClick={() => onUpdate({ ...prefs, theme: "dark" })}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${prefs.theme === "dark" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <Moon size={12} /> Ciemny
        </button>
      </div>

      {/* Kolor Wiodący */}
      <div>
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1">
          KOLOR WIODĄCY
        </p>
        <div className="grid grid-cols-6 gap-2">
          {COLORS.map((c) => (
            <button
              key={c.val}
              onClick={() => handleColorChange(c.val)}
              className={`w-6 h-6 rounded-full border-2 transition-all ${prefs.primaryColor === c.val ? "border-white scale-110 shadow-md" : "border-transparent opacity-50 hover:opacity-100"}`}
              style={{ backgroundColor: c.val }}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Skalowanie Czcionki */}
      <div>
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1 flex items-center gap-2">
          <Type size={10} /> SKALA INTERFEJSU:{" "}
          {Math.round(prefs.fontScale * 100)}%
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScaleChange(0.85)}
            className="p-1 text-zinc-500 hover:text-white"
          >
            <ZoomOut size={14} />
          </button>
          <input
            type="range"
            min="0.85"
            max="1.3"
            step="0.05"
            value={prefs.fontScale}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <button
            onClick={() => handleScaleChange(1.3)}
            className="p-1 text-zinc-500 hover:text-white"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="h-px bg-zinc-900 w-full"></div>

      {/* DESIGNER CZCIONEK (2026-07-25) — rozszerzenie ustawień, stosowane globalnie */}
      <div>
        <p className="text-[9px] uppercase font-black text-zinc-500 mb-3 tracking-wider flex items-center gap-2 px-1">
          <CaseSensitive size={10} /> Designer Czcionek
        </p>

        {/* Rodzina czcionki */}
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1">
          RODZAJ CZCIONKI
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(
            Object.keys(FONT_FAMILY_OPTIONS) as Array<
              keyof typeof FONT_FAMILY_OPTIONS
            >
          ).map((key) => {
            const opt = FONT_FAMILY_OPTIONS[key];
            const active = (prefs.fontFamily || "system") === key;
            return (
              <button
                key={key}
                onClick={() => handleFontFamilyChange(key)}
                title={opt.description}
                className={`flex flex-col items-start gap-0.5 p-2 rounded-xl border text-left transition-all ${active ? "border-white bg-zinc-800" : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"}`}
              >
                <span
                  className={`text-xs ${active ? "text-white" : "text-zinc-300"}`}
                  style={{ fontFamily: opt.stack }}
                >
                  Aa Bb 123
                </span>
                <span className="text-[9px] font-black uppercase text-zinc-500">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Pogrubienie */}
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1 flex items-center gap-2">
          <Bold size={10} /> POGRUBIENIE TEKSTU
        </p>
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800 mb-4">
          <button
            onClick={() => handleFontBoldToggle(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${!prefs.fontBold ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Normalna
          </button>
          <button
            onClick={() => handleFontBoldToggle(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[10px] font-black uppercase transition-all ${prefs.fontBold ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            Pogrubiona
          </button>
        </div>

        {/* Kolor czcionki */}
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1 flex items-center gap-2">
          <Droplet size={10} /> KOLOR TEKSTU (TREŚĆ)
        </p>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="color"
            value={prefs.fontColor || "#e4e4e7"}
            onChange={(e) => handleFontColorChange(e.target.value)}
            className="w-9 h-9 rounded-lg border border-zinc-800 bg-zinc-900 cursor-pointer p-0.5"
            title="Kolor tekstu treści"
          />
          <span className="text-[10px] font-bold text-zinc-400 flex-1">
            {prefs.fontColor
              ? prefs.fontColor.toUpperCase()
              : "Automatyczny (kolor motywu)"}
          </span>
          {prefs.fontColor && (
            <button
              onClick={handleResetFontColor}
              title="Przywróć kolor motywu"
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Rozmiar bazowy — skróty do SKALA INTERFEJSU powyżej */}
        <p className="text-[9px] font-bold text-zinc-500 mb-2 px-1">
          ROZMIAR BAZOWY
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleScaleChange(1.0)}
            className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${prefs.fontScale === 1.0 ? "border-white bg-zinc-800 text-white" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
          >
            Normalny
          </button>
          <button
            onClick={() => handleScaleChange(1.15)}
            className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${prefs.fontScale === 1.15 ? "border-white bg-zinc-800 text-white" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
          >
            Duży
          </button>
          <button
            onClick={() => handleScaleChange(1.3)}
            className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all border ${prefs.fontScale === 1.3 ? "border-white bg-zinc-800 text-white" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
          >
            Bardzo Duży
          </button>
        </div>
      </div>

      <div className="h-px bg-zinc-900 w-full"></div>

      {/* EDYTOR STATUSÓW (2026-07-25) — Twoje nazwy i kolory statusów polis */}
      <StatusEditor />
    </div>
  );
};
