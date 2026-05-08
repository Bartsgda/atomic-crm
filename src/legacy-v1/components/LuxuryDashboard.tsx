import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  FileText,
  AlertTriangle,
  RefreshCcw,
  Trello,
  Calendar,
  Car,
  Home,
  Heart,
  Plane,
  ShieldAlert,
  Building2,
  Banknote,
  Plus,
  ChevronRight,
  Clock,
  TrendingUp,
  Bell,
  UserPlus,
  Shield,
  FileEdit,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { AppState, PolicyType, SystemLogEntry } from "../types";

// ── palette ──────────────────────────────────────────────────────────────────
const G = "#d4af37";
const G_D = "#f2ca50";
const G10 = "rgba(212,175,55,0.10)";
const G15 = "rgba(212,175,55,0.15)";
const G25 = "rgba(212,175,55,0.25)";
const S = "#1e1f23";
const SH = "#292a2e";

const DAYS = [
  "Niedziela",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
];
const MONTHS = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

const TYPE_LABEL: Record<string, string> = {
  OC: "OC",
  AC: "AC",
  BOTH: "OC+AC",
  DOM: "Dom",
  ZYCIE: "Życie",
  PODROZ: "Turyst.",
  FIRMA: "Firma",
  INNE: "Inne",
};

const LOG_ICON: Record<string, React.ElementType> = {
  ADD_POLICY: Shield,
  UPDATE_POLICY: FileEdit,
  DELETE_POLICY: Trash2,
  ADD_CLIENT: UserPlus,
  UPDATE_CLIENT: FileEdit,
  DELETE_CLIENT: Trash2,
  ADD_NOTE: FileText,
};

// ── props ─────────────────────────────────────────────────────────────────────
interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onCategorySelect: (
    id: string,
    types: PolicyType[] | undefined,
    sortByDate: boolean,
  ) => void;
}

// ── component ─────────────────────────────────────────────────────────────────
export const LuxuryDashboard: React.FC<Props> = ({
  state,
  onNavigate,
  onCategorySelect,
}) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const h = now.getHours();
  const greeting =
    h < 12 ? "Dzień dobry" : h < 18 ? "Dzień dobry" : "Dobry wieczór";
  const dayName = DAYS[now.getDay()];
  const dateStr = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = `${String(h).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    const renewals = (state.policies ?? []).filter((p) => {
      if (!p.policyEndDate || p.type === "PODROZ") return false;
      const d = differenceInDays(new Date(p.policyEndDate), today);
      return d >= -7 && d <= 30;
    }).length;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const newThisMonth = (state.policies ?? []).filter((p) => {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      return d && d >= monthStart;
    }).length;
    return [
      {
        label: "Klientów",
        value: state.clients?.length ?? 0,
        Icon: Users,
        color: "#60a5fa",
      },
      {
        label: "Polis",
        value: state.policies?.length ?? 0,
        Icon: FileText,
        color: G,
      },
      {
        label: "Wznowień (30d)",
        value: renewals,
        Icon: RefreshCcw,
        color: renewals > 0 ? "#fb923c" : G,
      },
      {
        label: "Wypowiedzeń",
        value: state.terminations?.length ?? 0,
        Icon: AlertTriangle,
        color: (state.terminations?.length ?? 0) > 0 ? "#f87171" : "#5a5950",
      },
    ];
  }, [state]);

  // ── Urgent renewals ────────────────────────────────────────────────────────
  const urgent = useMemo(() => {
    const today = new Date();
    return (state.policies ?? [])
      .filter((p) => {
        if (!p.policyEndDate) return false;
        const d = differenceInDays(new Date(p.policyEndDate), today);
        return d >= -3 && d <= 21;
      })
      .sort(
        (a, b) =>
          new Date(a.policyEndDate).getTime() -
          new Date(b.policyEndDate).getTime(),
      )
      .slice(0, 6)
      .map((p) => {
        const client = (state.clients ?? []).find((c) => c.id === p.clientId);
        const diff = differenceInDays(new Date(p.policyEndDate), today);
        return { policy: p, client, diff };
      });
  }, [state.policies, state.clients]);

  // ── Nav tiles ─────────────────────────────────────────────────────────────
  const goTo = (
    catId: string,
    types: PolicyType[] | undefined,
    sortBy: boolean,
    page: string,
  ) => {
    onCategorySelect(catId, types, sortBy);
    onNavigate(page);
  };

  const recentData = useMemo(() => {
    const byCreated = <T extends { createdAt?: string }>(arr: T[]) =>
      [...arr].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime(),
      );
    const cliName = (clientId: string) => {
      const c = (state.clients ?? []).find((x) => x.id === clientId);
      return c ? `${c.firstName} ${c.lastName}` : null;
    };
    const polNames = (types: string[]) =>
      byCreated((state.policies ?? []).filter((p) => types.includes(p.type)))
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—");
    const today = new Date();
    return {
      clients: byCreated(state.clients ?? [])
        .slice(0, 3)
        .map((c) => `${c.firstName} ${c.lastName}`),
      offers: byCreated(
        (state.policies ?? []).filter((p) =>
          [
            "of_do zrobienia",
            "przeł kontakt",
            "oferta_wysłana",
            "ucięty kontakt",
          ].includes(p.stage),
        ),
      )
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—"),
      vehicles: polNames(["OC", "AC", "BOTH"]),
      property: polNames(["DOM"]),
      life: polNames(["ZYCIE"]),
      travel: polNames(["PODROZ"]),
      terminations: byCreated((state.terminations ?? []) as any[])
        .slice(0, 3)
        .map((t: any) => cliName(t.clientId) ?? t.policyNumber ?? "—"),
      renewals: [...(state.policies ?? [])]
        .filter((p) => {
          const d = differenceInDays(new Date(p.policyEndDate), today);
          return d >= 0 && d <= 30;
        })
        .sort(
          (a, b) =>
            new Date(a.policyEndDate).getTime() -
            new Date(b.policyEndDate).getTime(),
        )
        .slice(0, 3)
        .map((p) => cliName(p.clientId) ?? p.policyNumber ?? "—"),
    };
  }, [state.clients, state.policies, state.terminations]);

  const tiles = [
    {
      id: "clients",
      label: "Klienci",
      Icon: Users,
      count: state.clients?.length ?? 0,
      recent: recentData.clients,
      onAdd: () => onNavigate("clients", { autoCreate: true }),
      onClick: () => onNavigate("clients"),
    },
    {
      id: "offers",
      label: "Tablica",
      Icon: Trello,
      count: (state.policies ?? []).filter((p) =>
        [
          "of_do zrobienia",
          "przeł kontakt",
          "oferta_wysłana",
          "ucięty kontakt",
        ].includes(p.stage),
      ).length,
      recent: recentData.offers,
      onClick: () => {
        onCategorySelect("offers", undefined, false);
        onNavigate("offers");
      },
    },
    {
      id: "calendar",
      label: "Terminarz",
      Icon: Calendar,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("calendar"),
    },
    {
      id: "vehicles",
      label: "Pojazdy",
      Icon: Car,
      count: (state.policies ?? []).filter((p) =>
        ["OC", "AC", "BOTH"].includes(p.type),
      ).length,
      recent: recentData.vehicles,
      onAdd: () => onNavigate("new", { initialType: "OC" }),
      onClick: () =>
        goTo(
          "vehicles",
          ["OC", "AC", "BOTH"] as PolicyType[],
          false,
          "dashboard",
        ),
    },
    {
      id: "property",
      label: "Majątek",
      Icon: Home,
      count: (state.policies ?? []).filter((p) => p.type === "DOM").length,
      recent: recentData.property,
      onAdd: () => onNavigate("new", { initialType: "DOM" }),
      onClick: () =>
        goTo("property", ["DOM"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "life",
      label: "Życiowe",
      Icon: Heart,
      count: (state.policies ?? []).filter((p) => p.type === "ZYCIE").length,
      recent: recentData.life,
      onAdd: () => onNavigate("new", { initialType: "ZYCIE" }),
      onClick: () =>
        goTo("life", ["ZYCIE"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "travel",
      label: "Turyst.",
      Icon: Plane,
      count: (state.policies ?? []).filter((p) => p.type === "PODROZ").length,
      recent: recentData.travel,
      onAdd: () => onNavigate("new", { initialType: "PODROZ" }),
      onClick: () =>
        goTo("travel", ["PODROZ"] as PolicyType[], false, "dashboard"),
    },
    {
      id: "terminations",
      label: "Wypow.",
      Icon: ShieldAlert,
      count: state.terminations?.length ?? 0,
      recent: recentData.terminations,
      onClick: () => onNavigate("terminations"),
    },
    {
      id: "renewals",
      label: "Wznowienia",
      Icon: RefreshCcw,
      count: kpis[2].value,
      recent: recentData.renewals,
      onClick: () =>
        goTo(
          "renewals",
          ["OC", "AC", "BOTH", "DOM", "ZYCIE", "FIRMA", "INNE"] as PolicyType[],
          true,
          "dashboard",
        ),
    },
    {
      id: "insurers",
      label: "Towarzystwa",
      Icon: Building2,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("insurers"),
    },
    {
      id: "finance",
      label: "Finanse",
      Icon: Banknote,
      count: 0,
      recent: [] as string[],
      onClick: () => onNavigate("finance"),
    },
  ];

  // ── Recent logs ───────────────────────────────────────────────────────────
  const recent = useMemo(
    () =>
      [...(state.logs ?? [])]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 8),
    [state.logs],
  );

  const relTime = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60_000);
    if (diff < 1) return "przed chwilą";
    if (diff < 60) return `${diff} min temu`;
    const hh = Math.floor(diff / 60);
    if (hh < 24) return `${hh} godz. temu`;
    return `${Math.floor(hh / 24)} dni temu`;
  };

  // ── urgency color ─────────────────────────────────────────────────────────
  const urgColor = (d: number) =>
    d <= 0 ? "#ef4444" : d <= 3 ? "#f97316" : d <= 7 ? "#eab308" : G;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen pb-10"
      style={{
        background: "#121317",
        color: "#e3e2e7",
        fontFamily: "'Manrope',sans-serif",
      }}
    >
      {/* ── 1. HEADER: data + godzina ─────────────────────────────────── */}
      <div
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: `1px solid ${G15}` }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="text-xs font-bold uppercase mb-0.5"
              style={{ color: G, letterSpacing: "0.2em" }}
            >
              {greeting}
            </p>
            <p className="text-sm font-semibold" style={{ color: "#b0aea8" }}>
              {dayName}, {dateStr}
            </p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
            style={{ background: G10, border: `1px solid ${G15}` }}
          >
            <Clock size={12} style={{ color: G }} />
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: G }}
            >
              {timeStr}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. KPI strip ──────────────────────────────────────────────── */}
      <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: S, border: `1px solid ${G15}` }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: G10 }}
            >
              <Icon size={18} strokeWidth={1.5} style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-black leading-none" style={{ color }}>
                {value}
              </p>
              <p
                className="text-[11px] font-bold uppercase tracking-wider mt-0.5"
                style={{ color: "#5a5950" }}
              >
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. PILNE: wygasające polisy ────────────────────────────────── */}
      {urgent.length > 0 && (
        <div className="px-4 mb-4">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(251,146,60,0.25)" }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                background: "rgba(251,146,60,0.08)",
                borderBottom: "1px solid rgba(251,146,60,0.15)",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} style={{ color: "#fb923c" }} />
                <span
                  className="text-xs font-black uppercase tracking-wider"
                  style={{ color: "#fb923c" }}
                >
                  Do Działania — Wygasające Polisy
                </span>
              </div>
              <button
                onClick={() =>
                  goTo(
                    "renewals",
                    [
                      "OC",
                      "AC",
                      "BOTH",
                      "DOM",
                      "ZYCIE",
                      "FIRMA",
                      "INNE",
                    ] as PolicyType[],
                    true,
                    "dashboard",
                  )
                }
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: "#78716c" }}
              >
                Wszystkie →
              </button>
            </div>
            {/* rows */}
            <div style={{ background: "#18191d" }}>
              {urgent.map(({ policy: p, client, diff }) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() =>
                    onNavigate("client-details", {
                      client,
                      highlightPolicyId: p.id,
                    })
                  }
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: urgColor(diff) }}
                  />
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-sm font-semibold truncate block"
                      style={{ color: "#e3e2e7" }}
                    >
                      {client
                        ? `${client.firstName} ${client.lastName}`
                        : "Nieznany klient"}
                    </span>
                    <span className="text-[11px]" style={{ color: "#5a5950" }}>
                      {p.policyNumber || "—"} · {TYPE_LABEL[p.type] ?? p.type}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-sm font-bold"
                      style={{ color: urgColor(diff) }}
                    >
                      {diff <= 0
                        ? "PRZETERMINOWANA"
                        : diff === 1
                          ? "jutro"
                          : `${diff} dni`}
                    </p>
                    <p className="text-[11px]" style={{ color: "#5a5950" }}>
                      {new Date(p.policyEndDate).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 4. NAWIGACJA: kafle ───────────────────────────────────────── */}
      <div className="px-4 mb-4">
        <p
          className="text-[11px] font-black uppercase mb-2 px-0.5"
          style={{ color: "#4d4635", letterSpacing: "0.15em" }}
        >
          Nawigacja
        </p>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {tiles.map((tile) => (
            <div
              key={tile.id}
              onClick={tile.onClick}
              className="relative cursor-pointer rounded-xl p-3 transition-all duration-200"
              style={{ background: S, border: `1px solid ${G15}` }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = SH;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = S;
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <tile.Icon size={18} strokeWidth={1.5} style={{ color: G }} />
                {"onAdd" in tile && tile.onAdd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      (tile as any).onAdd();
                    }}
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ border: `1px solid ${G25}`, color: G }}
                  >
                    <Plus size={9} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              {tile.count > 0 && (
                <div className="absolute top-2 left-8">
                  <span
                    className="text-[10px] font-bold px-1 py-px rounded-full"
                    style={{ background: G, color: "#1c1500" }}
                  >
                    {tile.count}
                  </span>
                </div>
              )}
              <p
                className="text-xs font-bold uppercase tracking-wide leading-tight"
                style={{ color: "#b0aea8" }}
              >
                {tile.label}
              </p>
              {tile.recent.length > 0 && (
                <div
                  style={{
                    borderTop: "1px solid rgba(212,175,55,0.07)",
                    marginTop: 6,
                    paddingTop: 5,
                  }}
                >
                  {tile.recent.map((name, i) => (
                    <p
                      key={i}
                      className="text-[10px] truncate leading-relaxed"
                      style={{ color: "#4d4635" }}
                    >
                      {name}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. OSTATNIE DZIAŁANIA ─────────────────────────────────────── */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p
            className="text-[11px] font-black uppercase px-0.5"
            style={{ color: "#4d4635", letterSpacing: "0.15em" }}
          >
            Ostatnie działania
          </p>
        </div>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${G15}` }}
        >
          {recent.length === 0 ? (
            <div
              className="py-8 text-center text-sm"
              style={{ color: "#5a5950", background: S }}
            >
              Brak aktywności
            </div>
          ) : (
            recent.map((log, i) => {
              const Icon = LOG_ICON[log.action] ?? Bell;
              const isDel = log.action.startsWith("DELETE");
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{
                    background: i % 2 === 0 ? S : "#1a1b1f",
                    borderBottom:
                      i < recent.length - 1
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isDel ? "rgba(239,68,68,0.1)" : G10 }}
                  >
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      style={{ color: isDel ? "#ef4444" : G }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium leading-snug truncate"
                      style={{ color: "#d0cec8" }}
                    >
                      {log.details}
                    </p>
                    <p className="text-[11px]" style={{ color: "#4d4635" }}>
                      {log.entity}
                    </p>
                  </div>
                  <p
                    className="text-[11px] flex-shrink-0"
                    style={{ color: "#4d4635" }}
                  >
                    {relTime(log.timestamp)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
