
import React from 'react';

interface Props {
  text: string;
  className?: string;
  onLinkClick?: (identifier: string) => void;
}

const TAG_STYLES: Record<string, string> = {
  // Stare tagi
  'ST: OK': 'bg-emerald-500 text-white border-emerald-600',
  'ST: W TOKU': 'bg-blue-500 text-white border-blue-600',
  'ST: OCZEKIWANIE': 'bg-amber-500 text-white border-amber-600',
  'ST: ODRZUT': 'bg-rose-500 text-white border-rose-600',
  'ST: BRAK TEL': 'bg-rose-50 text-rose-600 border-rose-200',
  
  // Nowe Smart Tags
  'MAIL: WYSŁANY': 'bg-purple-100 text-purple-700 border-purple-200 font-bold',
  'MAIL: DO WYSŁANIA': 'bg-purple-50 text-purple-500 border-purple-200',
  'OFERTA: POJAZD': 'bg-indigo-50 text-indigo-600 border-indigo-200',
  'OFERTA: DOM': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'OFERTA: ŻYCIE': 'bg-rose-50 text-rose-600 border-rose-200',
  'OFERTA: PODRÓŻ': 'bg-sky-50 text-sky-600 border-sky-200',
  
  // Tag Współwłaściciel
  'WSP': 'bg-slate-200 text-slate-700 border-slate-300 font-bold'
};

// Regex na hasztagi (#Audi) - łapie wszystko po # do spacji
const HASH_REGEX = /(#[a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_\-\/]+)/g;

export const NoteTagRenderer: React.FC<Props> = ({ text, className = "", onLinkClick }) => {
  if (!text) return null;

  // 1. Extract Tags [TAG: VALUE]
  const tagRegex = /\[([A-Z]+: [^\]]+)\]/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    tags.push(match[1]);
  }
  
  // Clean text from bracket tags for display
  const cleanText = text.replace(tagRegex, '').trim();

  // 2. Parse Content for Hashtags and Links
  const parts = cleanText.split(HASH_REGEX);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Render Tags Chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag, idx) => {
            const style = TAG_STYLES[tag] || 'bg-zinc-100 text-zinc-600 border-zinc-200';
            return (
              <span 
                key={idx} 
                className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight border shadow-sm ${style}`}
              >
                {tag}
              </span>
            );
          })}
        </div>
      )}

      {/* Render Text with Highlights */}
      {cleanText && (
        <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium leading-relaxed whitespace-pre-wrap">
          {parts.map((part, i) => {
              if (part.startsWith('#')) {
                  const label = part.substring(1); // remove #
                  return (
                    <span 
                        key={i} 
                        onClick={(e) => {
                            e.stopPropagation();
                            if(onLinkClick) onLinkClick(label);
                        }}
                        className={`font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 rounded transition-colors ${onLinkClick ? 'cursor-pointer hover:bg-blue-100 hover:underline' : ''}`}
                        title="Kliknij aby przejść do obiektu"
                    >
                        {part}
                    </span>
                  );
              }
              return part;
          })}
        </p>
      )}
    </div>
  );
};
