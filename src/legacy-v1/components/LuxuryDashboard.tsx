import React from "react";
import {
  Zap,
  Users,
  Trello,
  Calendar,
  Car,
  Home,
  Heart,
  Plane,
  ShieldAlert,
  RefreshCcw,
  Plus,
  Bell,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Building2,
  ChevronRight,
  FileEdit,
  UserPlus,
  Shield,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { AppState, PolicyType, SystemLogEntry } from "../types";

interface Props {
  state: AppState;
  onNavigate: (page: string, data?: any) => void;
  onCategorySelect: (
    id: string,
    types: PolicyType[] | undefined,
    sortByDate: boolean,
  ) => void;
}

interface Tile {
  id: string;
  label: string;
  Icon: React.ElementType;
  count: number;
  addType?: PolicyType;
  onAdd?: () => void;
  onClick: () => void;
}

const GOLD = "#d4af37";
const GOLD_10 = "rgba(212,175,55,0.10)";
const GOLD_15 = "rgba(212,175,55,0.15)";
const GOLD_20 = "rgba(212,175,55,0.20)";
const SURFACE = "#1e1f23";
const SURFACE_HIGH = "#292a2e";

const ACTION_ICONS: Record<string, React.ElementType> = {
  ADD_POLICY: Shield,
  UPDATE_POLICY: FileEdit,
  DELETE_POLICY: AlertCircle,
  ADD_CLIENT: UserPlus,
  UPDATE_CLIENT: FileEdit,
  DELETE_CLIENT: AlertCircle,
  ADD_NOTE: FileEdit,
};

function activityIcon(log: SystemLogEntry): React.ElementType {
  return ACTION_ICONS[log.action] ?? Bell;
}

function activityColor(log: SystemLogEntry): string {
  if (log.action.startsWith("DELETE")) return "#ef4444";
  if (log.action.startsWith("ADD")) return GOLD;
  return "#99907c";
}

export const LuxuryDashboard: React.FC<Props> = ({
  state,
  onNavigate,
  onCategorySelect,
}) => {
  const { clients, policies, terminations, logs } = state;

  const offersCount = policies.filter((p) =>
    [
      "of_do zrobienia",
      "przeł kontakt",
      "oferta_wysłana",
      "ucięty kontakt",
    ].includes(p.stage),
  ).length;

  const renewalsCount = (() => {
    const today = new Date();
    return policies.filter((p) => {
      if (p.type === "PODROZ") return false;
      const diff = differenceInDays(new Date(p.policyEndDate), today);
      return diff >= -30 && diff <= 45;
    }).length;
  })();

  const nav = (
    catId: string,
    types: PolicyType[] | undefined,
    sortByDate: boolean,
    page: string,
  ) => {
    onCategorySelect(catId, types, sortByDate);
    onNavigate(page);
  };

  const tiles: Tile[] = [
    {
      id: "all",
      label: "Pulpit",
      Icon: Zap,
      count: policies.length,
      onClick: () => nav("all", undefined, false, "dashboard"),
    },
    {
      id: "clients",
      label: "Baza Klientów",
      Icon: Users,
      count: clients.length,
      onAdd: () => onNavigate("clients", { autoCreate: true }),
      onClick: () => onNavigate("clients"),
    },
    {
      id: "offers",
      label: "Tablica",
      Icon: Trello,
      count: offersCount,
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
      onClick: () => onNavigate("calendar"),
    },
    {
      id: "terminations",
      label: "Wypowiedzenia",
      Icon: ShieldAlert,
      count: terminations?.length ?? 0,
      onClick: () => onNavigate("terminations"),
    },
    {
      id: "renewals",
      label: "Wznowienia",
      Icon: RefreshCcw,
      count: renewalsCount,
      onClick: () =>
        nav(
          "renewals",
          ["OC", "AC", "BOTH", "DOM", "ZYCIE", "FIRMA", "INNE"],
          true,
          "dashboard",
        ),
    },
    {
      id: "vehicles",
      label: "Pojazdy",
      Icon: Car,
      count: policies.filter((p) => ["OC", "AC", "BOTH"].includes(p.type))
        .length,
      addType: "OC",
      onAdd: () => onNavigate("new", { initialType: "OC" }),
      onClick: () => nav("vehicles", ["OC", "AC", "BOTH"], false, "dashboard"),
    },
    {
      id: "property",
      label: "Majątek",
      Icon: Home,
      count: policies.filter((p) => p.type === "DOM").length,
      addType: "DOM",
      onAdd: () => onNavigate("new", { initialType: "DOM" }),
      onClick: () => nav("property", ["DOM"], false, "dashboard"),
    },
    {
      id: "life",
      label: "Życiowe",
      Icon: Heart,
      count: policies.filter((p) => p.type === "ZYCIE").length,
      addType: "ZYCIE",
      onAdd: () => onNavigate("new", { initialType: "ZYCIE" }),
      onClick: () => nav("life", ["ZYCIE"], false, "dashboard"),
    },
    {
      id: "travel",
      label: "Turystyczne",
      Icon: Plane,
      count: policies.filter((p) => p.type === "PODROZ").length,
      addType: "PODROZ",
      onAdd: () => onNavigate("new", { initialType: "PODROZ" }),
      onClick: () => nav("travel", ["PODROZ"], false, "dashboard"),
    },
    {
      id: "insurers",
      label: "Towarzystwa",
      Icon: Building2,
      count: state.insurers?.length ?? 0,
      onClick: () => onNavigate("insurers"),
    },
    {
      id: "finance",
      label: "Finanse",
      Icon: Banknote,
      count: 0,
      onClick: () => onNavigate("finance"),
    },
  ];

  const recentLogs = [...(logs || [])]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 6);

  return (
    <div
      className="min-h-screen pb-12"
      style={{
        background: "#121317",
        color: "#e3e2e7",
        fontFamily: "'Manrope', sans-serif",
      }}
    >
      {/* ── Hero ── */}
      <div className="px-6 pt-8 pb-6">
        <p
          className="text-[10px] font-bold uppercase mb-1"
          style={{ color: GOLD, letterSpacing: "0.25em" }}
        >
          Witamy ponownie,
        </p>
        <h2
          className="text-2xl font-bold tracking-tight"
          style={{ color: "#e3e2e7" }}
        >
          Twój panel
        </h2>
        {/* Gold dust divider */}
        <div
          className="mt-4 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.25) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* ── Tile Grid ── */}
      <div className="px-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-10">
        {tiles.map((tile) => (
          <div
            key={tile.id}
            onClick={tile.onClick}
            className="relative cursor-pointer rounded-xl p-5 transition-all duration-300 group"
            style={{
              background: SURFACE,
              border: `1px solid ${GOLD_15}`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background =
                SURFACE_HIGH;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = SURFACE;
            }}
          >
            {/* Icon row */}
            <div className="flex justify-between items-start mb-6">
              <tile.Icon
                size={28}
                strokeWidth={1.5}
                style={{ color: GOLD, flexShrink: 0 }}
              />
              {tile.onAdd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    tile.onAdd!();
                  }}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-200"
                  style={{ border: `1px solid ${GOLD_20}`, color: GOLD }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      GOLD;
                    (e.currentTarget as HTMLButtonElement).style.color = "#000";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = GOLD;
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Count badge */}
            {tile.count > 0 && (
              <div className="absolute top-4 left-11">
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: GOLD, color: "#1c1500" }}
                >
                  {tile.count}
                </span>
              </div>
            )}

            {/* Label */}
            <p
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: "#e3e2e7" }}
            >
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Recent Activity ── */}
      <div className="px-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold" style={{ color: GOLD }}>
            Ostatnia Aktywność
          </h3>
          <button
            onClick={() => onNavigate("dashboard")}
            className="text-[10px] font-bold uppercase tracking-wider transition-colors"
            style={{ color: "#99907c", letterSpacing: "0.1em" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = GOLD;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#99907c";
            }}
          >
            Zobacz Wszystko
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div
            className="text-center py-12 text-sm"
            style={{ color: "#5a5950" }}
          >
            Brak aktywności
          </div>
        ) : (
          <div className="space-y-3">
            {recentLogs.map((log) => {
              const Icon = activityIcon(log);
              const iconColor = activityColor(log);
              return (
                <div
                  key={log.id}
                  className="rounded-xl p-4 flex items-center gap-4"
                  style={{
                    background: SURFACE,
                    border: `1px solid ${GOLD_15}`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: GOLD_10 }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={1.5}
                      style={{ color: iconColor }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium leading-snug truncate"
                      style={{ color: "#e3e2e7" }}
                    >
                      {log.details}
                    </p>
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "#5a5950" }}
                    >
                      {log.entity} •{" "}
                      {new Date(log.timestamp).toLocaleString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <ChevronRight
                    size={16}
                    style={{ color: "#4d4635", flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
