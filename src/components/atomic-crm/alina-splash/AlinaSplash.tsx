import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { X, Sparkles, Calendar, Shirt, Laugh } from "lucide-react";

// ── Dane strojów ─────────────────────────────────────────────────────────────

interface OutfitOption {
  emoji: string;
  name: string;
  desc: string;
  bg: string;
  tag: string;
}

const OUTFITS: OutfitOption[] = [
  {
    emoji: "👗",
    name: "Klasyczna pewność",
    desc: "Czarna sukienka midi + biały żakiet + szpilki",
    bg: "from-zinc-700 to-zinc-800",
    tag: "Spotkanie z klientem",
  },
  {
    emoji: "🌸",
    name: "Wiosenny business",
    desc: "Pudrowa bluzka + beżowe cygaretki + baleriny",
    bg: "from-pink-900/60 to-rose-900/40",
    tag: "Biuro — miły dzień",
  },
  {
    emoji: "💙",
    name: "Morski akcent",
    desc: "Niebieska bluzka + białe spodnie + nude botki",
    bg: "from-blue-900/60 to-indigo-900/50",
    tag: "Casual elegance",
  },
  {
    emoji: "💪",
    name: "Power look",
    desc: "Bordowy żakiet + czarne spodnie + złote dodatki",
    bg: "from-red-900/50 to-orange-900/40",
    tag: "Ważne spotkanie",
  },
  {
    emoji: "✨",
    name: "Złota godzina",
    desc: "Żółta bluzka + białe spodnie + sandały",
    bg: "from-yellow-900/50 to-amber-900/40",
    tag: "Słoneczny dzień",
  },
  {
    emoji: "🤍",
    name: "Biała magia",
    desc: "Biały komplet marynarka + spodnie + nude szpilki",
    bg: "from-zinc-600 to-zinc-700",
    tag: "Ważny klient",
  },
  {
    emoji: "💚",
    name: "Natura w biurze",
    desc: "Zielona bluzka + beżowe spodnie + brązowe mokasyny",
    bg: "from-green-900/60 to-emerald-900/40",
    tag: "Środa bez spotkań",
  },
  {
    emoji: "👠",
    name: "Retro chic",
    desc: "Kremowa bluzka + brązowe capri + obcasy",
    bg: "from-amber-900/50 to-yellow-900/30",
    tag: "Stylowy piątek",
  },
  {
    emoji: "🦋",
    name: "Motyl w biurze",
    desc: "Kwiatowa sukienka + biały żakiet + sandały",
    bg: "from-violet-900/60 to-purple-900/40",
    tag: "Casual + lato",
  },
  {
    emoji: "⭐",
    name: "Korporacyjna gwiazda",
    desc: "Czarny garnitur spodniowy + złota biżuteria",
    bg: "from-zinc-800 to-zinc-900",
    tag: "Zarząd",
  },
];

// ── Żarty ────────────────────────────────────────────────────────────────────

const JOKES: string[] = [
  "Klient pyta agenta:\n– Ile kosztuje ubezpieczenie mojego życia?\nAgent:\n– A ile pan kosztuje? 😄",

  "W biurze ubezpieczeń:\n– Chcę ubezpieczyć samochód.\n– Dobrze. A od czego?\n– No... od wypadków?\n– A od kogo mu płacić — od żony czy od teściowej? 🚗",

  "Szef do pracownika:\n– Dlaczego pan ciągle się spóźnia?\n– Bo pan mówił żeby nie śpieszyć się z decyzjami. ⏰",

  'Poniedziałek rano w biurze:\nKawa ☕: "Dasz radę!"\nKomputer 💻: "Aktualizuję, proszę czekać..."\nDrukarka: "A ja się zaćięłam."\nTypowy poniedziałek.',

  "Agent do klienta:\n– Proszę pana, mamy ubezpieczenie od wszystkiego!\nKlient:\n– To ubezpiecz mnie od wizyt u was w biurze! 😂",

  "Co mówi optymistyczny agent ubezpieczeniowy?\nWypadek to szansa na poznanie naszych procedur. 🌟",

  "Dlaczego ubezpieczyciel nie śpi w nocy?\nBo liczy owce... i każdej dolicza składkę dodatkową. 🐑",

  "W Trójmieście mówią:\nGdańsk — pada deszcz.\nGdynia — wieje wiatr.\nPuck — pada deszcz i wieje wiatr, ale i tak jest pięknie. 🌊",

  "Najkrótsza definicja piątku:\nDzien, w ktorym Excel zamienia sie w przyjemnosc.\n(klamstwo, ale milo wierzyc) 📊",

  "Klient:\n– Czy mogę ubezpieczyć psa?\nAgent:\n– Oczywiście. Co mu dolega?\nKlient:\n– Na razie nic, ale poznał moją teściową. 🐕",

  "W każdym biurze są 3 typy:\n1. Przychodzi za wcześnie.\n2. Przychodzi punktualnie.\n3. Przychodzi na czas — ustawiony godzinę do tyłu. ⌚",

  "Definicja 'wkrótce' według drukarki biurowej:\nOd 3 minut do końca świata. 🖨️",

  "Dlaczego Excel to najszczerszy program?\nBo zawsze pokazuje błąd w twoim myśleniu. #VALUE! 💚",

  "– Mamo, a ty w pracy co robisz?\n– Dbam o bezpieczeństwo ludzi, skarbie.\n– Jak strażak?\n– Nie, wypełniam formularze i umawiam spotkania.\n– ...to chyba ważniejsze. 💼",

  "Klient pisze maila:\n-- Dzien dobry, mam pilna sprawe.\nAgent mysli:\n-- Pilna sprawa w ubezpieczeniach... plonie dom czy parking? 🔥",
];

// ── Changelog ────────────────────────────────────────────────────────────────

interface ChangeEntry {
  date: string;
  items: string[];
}

const CHANGELOG: ChangeEntry[] = [
  {
    date: "2026-07-25",
    items: [
      "Możesz teraz wybrać rodzaj, wielkość, kolor i pogrubienie czcionki w Ustawieniach (nowa sekcja 'Designer Czcionek' pod suwakiem skali)",
      "PESEL i numery rejestracyjne pojazdów są teraz wyraźnie większe — łatwiej je odczytać na pierwszy rzut oka",
      "Terminarz ma teraz spokojniejsze kolory i większe napisy — łatwiej zobaczyć klientów. Czerwony zostaje tylko przy sprawach naprawdę pilnych (dziś / po terminie)",
      "Statusy polis mają teraz Twoje kolory z Excela — zielony sprzedaż, fioletowy sprzedany itd.",
      "Status »sprzedany« (klient sprzedał auto) nie proponuje już wznowienia; dodano status »pierwszy kontakt«.",
      "Możesz teraz sama ustawić nazwy i kolory statusów w Ustawieniach — Twoje nazwy, Twoje kolory.",
      "Ustawienia otwierają się teraz na pełny ekran — wygodniej.",
    ],
  },
  {
    date: "2026-07-24",
    items: [
      "Nowy tryb testowy (żółty przycisk 🧪 w rogu) — bezpieczny podgląd danych, zmiany nie ruszają prawdziwej bazy",
      "Bezpieczniejsze hasło aplikacji: po 3 błędnych próbach pauza 1 min, po 6 — 5 min, po 9 — blokada do zdjęcia przez administratora",
      "Licznik błędnych prób nie znika już po odświeżeniu strony",
    ],
  },
  {
    date: "2026-05-10",
    items: [
      "Klienci → otwiera Bazę Kontrahentów (nie listę polis)",
      "Kolumna Portfel — sprzedane polisy per klient (🚗 Dom 💗)",
      "Kolumna W toku — aktywne oferty z typem + wznowienia do 30 dni",
      "Pośrednicy — kafelek wrócił do menu luxury-gold",
      "Finanse: fix — wszystkie polisy (sprzedaż/sprzedany) wliczane do obliczeń",
      "Import XLSX: fix dat notatek — używana data polisy zamiast daty importu",
    ],
  },
  {
    date: "2026-05-09",
    items: [
      "Zakładka 'Szyfruj' w importerze — zaszyfruj XLSX hasłem",
      "Korekcje z pliku .ts.enc przy imporcie",
      "Splash screen (to co właśnie widzisz 👋)",
    ],
  },
  {
    date: "2026-05-08",
    items: [
      "Automatyczny snapshot przy pierwszym logowaniu",
      "Poprawki importu: puste imiona, linkedPolicyIds",
      "Motyw luxury-gold jako domyślny",
    ],
  },
  {
    date: "2026-05-07",
    items: [
      "Dashboard: 3 ostatnie kontakty na kafelkach",
      "Magic link logowania na localhost (dev)",
    ],
  },
];

// ── Utility ───────────────────────────────────────────────────────────────────

function seedRng(seed: number) {
  let s = seed >>> 0;
  return (): number => {
    s = Math.imul(s ^ (s >>> 13), s | 1);
    s ^= s >>> 7;
    s = Math.imul(s ^ (s >>> 17), s | 1);
    return (s >>> 0) / 0xffffffff;
  };
}

function todaySeed(): number {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return parseInt(d, 10);
}

function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  while (result.length < n && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  user: User | null;
}

export const AlinaSplash: React.FC<Props> = ({ user }) => {
  const [visible, setVisible] = useState(false);
  const [pickedOutfits, setPickedOutfits] = useState<OutfitOption[]>([]);
  const [joke, setJoke] = useState("");
  const [jokeIdx, setJokeIdx] = useState(0);
  const [chosenOutfit, setChosenOutfit] = useState<number | null>(null);

  const IS_DEV =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `alina_splash_${today}`;
    // Na dev zawsze pokazuj (żeby móc testować bez czyszczenia localStorage)
    if (!IS_DEV && localStorage.getItem(key)) return;

    const rng = seedRng(todaySeed());
    const outfits = pickN(OUTFITS, 3, rng);
    const idx = Math.floor(rng() * JOKES.length);

    setPickedOutfits(outfits);
    setJokeIdx(idx);
    setJoke(JOKES[idx]);
    setVisible(true);
  }, [user]);

  const nextJoke = () => {
    const next = (jokeIdx + 1) % JOKES.length;
    setJokeIdx(next);
    setJoke(JOKES[next]);
  };

  const dismiss = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`alina_splash_${today}`, "1");
    setVisible(false);
  };

  if (!visible) return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const yesterdayIso = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);

  const todayStr = new Date().toLocaleDateString("pl-PL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const recentChanges = CHANGELOG.filter(
    (e) => e.date === todayIso || e.date === yesterdayIso,
  );

  const labelDate = (d: string) =>
    d === todayIso ? "Dziś" : d === yesterdayIso ? "Wczoraj" : d;

  return (
    <div className="fixed inset-0 z-[99998] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0d0f14] border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-8 py-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-white/70" />
              <span className="text-white/60 text-xs font-semibold uppercase tracking-[0.2em]">
                RedRoad CRM
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Dzień dobry, Alina! 👋
            </h1>
            <p className="text-white/60 text-xs mt-1 capitalize">{todayStr}</p>
          </div>
          <button
            onClick={dismiss}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Zmiany */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest">
                Co nowego
              </h2>
            </div>
            {recentChanges.length === 0 ? (
              <p className="text-zinc-600 text-xs italic">
                Brak nowych zmian w ostatnich dniach.
              </p>
            ) : (
              <div className="space-y-4">
                {recentChanges.map((entry) => (
                  <div key={entry.date}>
                    <div className="text-[10px] font-black text-indigo-400 mb-1.5 uppercase tracking-widest">
                      {labelDate(entry.date)}
                    </div>
                    <ul className="space-y-1.5">
                      {entry.items.map((item, i) => (
                        <li
                          key={i}
                          className="flex gap-2 text-xs text-zinc-400 leading-snug"
                        >
                          <span className="text-indigo-500 flex-shrink-0 mt-0.5">
                            ▸
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Strój dnia */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-pink-500/20 rounded-lg flex items-center justify-center">
                <Shirt className="w-3.5 h-3.5 text-pink-400" />
              </div>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest">
                Co dziś na siebie?
              </h2>
            </div>
            <div className="space-y-2.5">
              {pickedOutfits.map((outfit, i) => (
                <button
                  key={i}
                  onClick={() => setChosenOutfit(chosenOutfit === i ? null : i)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                    chosenOutfit === i
                      ? "border-pink-500/50 bg-pink-500/10 shadow-lg shadow-pink-500/10"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg bg-gradient-to-br ${outfit.bg} flex-shrink-0`}
                    >
                      {outfit.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-pink-500/80 uppercase tracking-widest">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="text-white text-xs font-semibold">
                          {outfit.name}
                        </span>
                        {chosenOutfit === i && (
                          <span className="text-pink-400 text-xs ml-auto">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-zinc-500 text-[11px] mt-0.5 leading-snug">
                        {outfit.desc}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-zinc-500">
                        {outfit.tag}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Żart */}
          <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-amber-500/20 rounded-lg flex items-center justify-center">
                <Laugh className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-white font-bold text-xs uppercase tracking-widest">
                Rozluźnienie
              </h2>
            </div>
            <div className="flex-1 bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">
                {joke}
              </p>
            </div>
            <button
              onClick={nextJoke}
              className="mt-3 w-full py-2 rounded-xl border border-white/5 text-zinc-500 hover:text-zinc-300 hover:border-white/10 transition-all text-xs font-medium"
            >
              Daj inny żart →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={dismiss}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-500/20 text-sm"
          >
            Wchodzę do pracy →
          </button>
        </div>
      </div>
    </div>
  );
};
