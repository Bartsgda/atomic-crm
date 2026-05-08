import { useEffect, useRef, useState, useCallback } from 'react';
import { Eye, LogOut, Clock, Target, Send, X, Loader2, Bug, Sparkles, MessageSquare, Check, Lock, LayoutGrid, List } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, type OnDragEndResponder } from '@hello-pangea/dnd';
import { getSupabaseClient } from '../../components/atomic-crm/providers/supabase/supabase';
import {
  pickElement,
  submitFeedback,
  listFeedback,
  toggleMyFeedbackResolved,
  setFeedbackAdminReply,
  setFeedbackStatus,
  isInsuranceAdmin,
  type CapturedElement,
  type FeedbackItem,
} from '../services/feedbackCapture';

// ─── stałe kanban ─────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { status: 'open' as const, label: 'Otwarte', border: 'border-indigo-500/40', text: 'text-indigo-300', dot: 'bg-indigo-400' },
  { status: 'seen' as const, label: 'W toku', border: 'border-amber-500/40', text: 'text-amber-300', dot: 'bg-amber-400' },
  { status: 'done' as const, label: 'Gotowe', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  { status: 'rejected' as const, label: 'Odrzucone', border: 'border-red-500/40', text: 'text-red-300', dot: 'bg-red-400' },
];

const SEV_COLORS: Record<string, string> = {
  blocker: 'bg-red-500/20 text-red-300 border-red-500/30',
  bug: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  idea: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

// ─── stałe sesji ──────────────────────────────────────────────────────────────
const SESSION_MS = 120 * 60 * 1000;
const WARNING_MS = 5 * 60 * 1000;
const CRITICAL_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

// ─── typy ─────────────────────────────────────────────────────────────────────
type ConnectionStatus = 'checking' | 'online' | 'offline';
type Severity = 'info' | 'bug' | 'idea' | 'blocker';

interface UserInfo {
  id: string;
  email: string;
  avatar_url?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return 'przed chwilą';
  if (diff < 60) return `${diff}s temu`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min temu`;
  return `${Math.floor(diff / 3600)}h temu`;
}

// ─── główny komponent ─────────────────────────────────────────────────────────
export default function StatusEye({ isUnlocked = false }: { isUnlocked?: boolean }) {
  // połączenie
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [lastPing, setLastPing] = useState<Date | null>(null);

  // user
  const [user, setUser] = useState<UserInfo | null>(null);

  // sesja
  const [remaining, setRemaining] = useState(SESSION_MS);
  const expiryRef = useRef<number>(Date.now() + SESSION_MS);
  const lastResetRef = useRef<number>(Date.now());

  // UI
  const [expanded, setExpanded] = useState(false);

  // feedback
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [captured, setCaptured] = useState<CapturedElement | null>(null);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<Severity>('bug');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // lista zgloszen (sesja 2026-05-04)
  const [listOpen, setListOpen] = useState(false);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReply, setSavingReply] = useState<Record<string, boolean>>({});
  const [movingStatus, setMovingStatus] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const reloadList = useCallback(async () => {
    if (!isUnlocked) return; // NIE pobieraj danych przed odszyfrowaniem
    setLoadingList(true);
    setListError(null);
    try {
      const items = await listFeedback();
      setFeedbackList(items);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setLoadingList(false);
    }
  }, [isUnlocked]);

  // Sprawdz czy jestes adminem (raz przy zalogowaniu)
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    isInsuranceAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
  }, [user]);

  // Load list gdy user otworzy panel/modal
  useEffect(() => {
    if (expanded || listOpen) reloadList();
  }, [expanded, listOpen, reloadList]);

  const handleToggleResolved = async (id: string) => {
    try {
      await toggleMyFeedbackResolved(id);
      reloadList();
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Nieznany błąd');
    }
  };

  const handleSaveReply = async (id: string) => {
    const text = replyDrafts[id] ?? '';
    setSavingReply((s) => ({ ...s, [id]: true }));
    try {
      await setFeedbackAdminReply(id, text);
      setReplyDrafts((d) => { const n = { ...d }; delete n[id]; return n; });
      reloadList();
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setSavingReply((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  };

  const handleMoveStatus = async (id: string, newStatus: FeedbackItem['status']) => {
    setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
    setMovingStatus((s) => ({ ...s, [id]: true }));
    try {
      await setFeedbackStatus(id, newStatus);
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : 'Nieznany błąd');
      reloadList();
    } finally {
      setMovingStatus((s) => { const n = { ...s }; delete n[id]; return n; });
    }
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    handleMoveStatus(draggableId, destination.droppableId as FeedbackItem['status']);
  };

  // licznik nieprzeczytanych otwartych dla user-a (jego wlasne open + bez admin_reply)
  const myOpenCount = feedbackList.filter(f =>
    f.user_id === user?.id && f.status !== 'done'
  ).length;

  // ── efekt 1: sesja Supabase / user ────────────────────────────────────────
  useEffect(() => {
    const sb = getSupabaseClient();

    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s?.user) {
        setUser({
          id: s.user.id,
          email: s.user.email ?? '',
          avatar_url: s.user.user_metadata?.avatar_url,
        });
      }
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email ?? '',
          avatar_url: session.user.user_metadata?.avatar_url,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── efekt: reload list when unlocked ──
  useEffect(() => {
    if (isUnlocked) {
      reloadList();
    }
  }, [isUnlocked, reloadList]);

  // ── efekt 2: ping Supabase co 30s ─────────────────────────────────────────
  useEffect(() => {
    const ping = async () => {
      try {
        const sb = getSupabaseClient();
        const { error } = await sb.from('tenants').select('id').limit(1);
        if (error) throw error;
        setStatus('online');
        setLastPing(new Date());
      } catch {
        setStatus('offline');
      }
    };

    ping(); // natychmiastowy pierwszy ping
    const iv = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  // ── efekt 3: timer sesji ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, expiryRef.current - Date.now()));
    const iv = setInterval(tick, 1000);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastResetRef.current > ACTIVITY_THROTTLE_MS) {
        lastResetRef.current = now;
        expiryRef.current = now + SESSION_MS;
        tick();
      }
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, onActivity));

    return () => {
      clearInterval(iv);
      events.forEach(e => window.removeEventListener(e, onActivity));
    };
  }, []);

  // ── efekt 4: online/offline ────────────────────────────────────────────────
  useEffect(() => {
    const onOnline = () => setStatus('online');
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── odświeżanie tagu "ping X temu" ────────────────────────────────────────
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => forceRerender(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  // ── handlery ──────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await getSupabaseClient().auth.signOut();
    window.location.reload();
  };

  const handleReportClick = async () => {
    setExpanded(false);
    const el = await pickElement();
    if (!el) return;
    setCaptured(el);
    setFeedbackOpen(true);
    setMessage('');
    setSeverity('bug');
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitFeedback({ message: message.trim(), severity, captured });
      setSubmitSuccess(true);
      setTimeout(() => {
        setFeedbackOpen(false);
        setCaptured(null);
      }, 1500);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Nieznany błąd');
    } finally {
      setSubmitting(false);
    }
  };

  // ── kolory sesji ──────────────────────────────────────────────────────────
  const sessionColor =
    remaining < CRITICAL_MS
      ? 'text-red-400'
      : remaining < WARNING_MS
      ? 'text-amber-400'
      : 'text-gray-400';

  // ── dot statusu ───────────────────────────────────────────────────────────
  const StatusDot = () => {
    if (status === 'checking')
      return <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />;
    if (status === 'online')
      return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />;
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
  };

  const statusLabel =
    status === 'checking' ? 'Łączenie…' : status === 'online' ? 'Online' : 'Offline';

  // ── avatar ────────────────────────────────────────────────────────────────
  const Avatar = () => {
    if (user?.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt="avatar"
          className="w-7 h-7 rounded-full object-cover border border-white/10"
        />
      );
    }
    const letter = user?.email?.[0]?.toUpperCase() ?? '?';
    return (
      <div className="w-7 h-7 rounded-full bg-indigo-500/40 border border-indigo-400/30 flex items-center justify-center text-xs font-semibold text-indigo-200">
        {letter}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── pływający przycisk + panel ─────────────────────────────────────── */}
      <div
        className="fixed bottom-5 right-5 z-[100000] flex flex-col items-end gap-2"
        data-feedback-ui="true"
      >
        {/* panel rozwinięty */}
        {expanded && (
          <div
            className="w-80 rounded-2xl border border-white/10 bg-[#111318] backdrop-blur shadow-2xl overflow-hidden"
            data-feedback-ui="true"
          >
            {/* header: user */}
            <div className="flex items-center gap-2 px-4 py-3">
              <Avatar />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate">{user?.email ?? 'Niezalogowany'}</p>
              </div>
              <button
                onClick={handleLogout}
                title="Wyloguj"
                className="text-gray-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-white/5"
                data-feedback-ui="true"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="border-t border-white/10" />

            {/* status Supabase */}
            <div className="flex items-center gap-2 px-4 py-2.5">
              <StatusDot />
              <span className="text-xs text-gray-300 flex-1">Supabase: {statusLabel}</span>
              {lastPing && (
                <span className="text-[10px] text-gray-600">{timeAgo(lastPing)}</span>
              )}
            </div>

            {/* timer sesji */}
            <div className="flex items-center gap-2 px-4 py-2.5">
              <Clock className={`w-3.5 h-3.5 ${sessionColor}`} />
              <span className="text-xs text-gray-300 flex-1">Sesja:</span>
              <span className={`text-xs font-mono tabular-nums ${sessionColor}`}>
                {formatRemaining(remaining)}
              </span>
            </div>

            <div className="border-t border-white/10" />

            {/* przycisk zgłoś problem */}
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={handleReportClick}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
                data-feedback-ui="true"
              >
                <Target className="w-4 h-4" />
                Zgłoś problem
              </button>
              <button
                onClick={() => { if (isUnlocked) { setExpanded(false); setListOpen(true); } }}
                disabled={!isUnlocked}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-sm font-medium transition-colors ${
                  isUnlocked
                    ? 'bg-white/5 hover:bg-white/10 text-gray-200'
                    : 'bg-white/5 text-gray-500 opacity-50 cursor-not-allowed'
                }`}
                data-feedback-ui="true"
              >
                <MessageSquare className="w-4 h-4" />
                {isAdmin ? 'Wszystkie zgłoszenia' : 'Moje zgłoszenia'}
                {isUnlocked && myOpenCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-[10px] font-semibold text-indigo-200">
                    {myOpenCount}
                  </span>
                )}
              </button>
            </div>

            {/* narzędzia dodatkowe */}
            <div className="border-t border-white/10" />
            <div className="px-4 py-3 flex gap-2">
              <button
                onClick={() => { if (isUnlocked) { setExpanded(false); window.dispatchEvent(new CustomEvent('crm:open-tester')); } }}
                disabled={!isUnlocked}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  isUnlocked
                    ? 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
                    : 'bg-gray-500/10 border-white/5 text-gray-600 opacity-50 cursor-not-allowed'
                }`}
                data-feedback-ui="true"
                title={isUnlocked ? "Tester / demo generator" : "Zablokowane (wymagane hasło)"}
              >
                <Bug className="w-3.5 h-3.5" /> Tester
              </button>
              <button
                onClick={() => { if (isUnlocked) { setExpanded(false); window.dispatchEvent(new CustomEvent('crm:open-agent')); } }}
                disabled={!isUnlocked}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  isUnlocked
                    ? 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-300'
                    : 'bg-gray-500/10 border-white/5 text-gray-600 opacity-50 cursor-not-allowed'
                }`}
                data-feedback-ui="true"
                title={isUnlocked ? "Agent AI (Karateka)" : "Zablokowane (wymagane hasło)"}
              >
                <Sparkles className="w-3.5 h-3.5" /> Agent AI
              </button>
            </div>
          </div>
        )}

        {/* ikona Eye */}
        <div className="relative group">
          <button
            onClick={() => setExpanded(v => !v)}
            className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform ${
              isUnlocked 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                : 'bg-gradient-to-br from-gray-600 to-gray-800 border border-white/10'
            }`}
            data-feedback-ui="true"
            aria-label="Status i zgłoś problem"
          >
            {isUnlocked ? <Eye className="w-6 h-6" /> : <Lock className="w-6 h-6 text-gray-400" />}
          </button>
          {/* tooltip */}
          {!expanded && (
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-[#1a1d24] border border-white/10 px-3 py-1.5 text-xs text-gray-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              {isUnlocked ? 'Status + Zgłoś problem' : 'Zablokowane (Podaj hasło)'}
            </div>
          )}
        </div>
      </div>

      {/* ── modal feedback ────────────────────────────────────────────────────── */}
      {feedbackOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          data-feedback-ui="true"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111318] shadow-2xl overflow-hidden"
            data-feedback-ui="true"
          >
            {/* modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-400" />
                Zgłoś problem
              </h2>
              <button
                onClick={() => { setFeedbackOpen(false); setCaptured(null); }}
                className="text-gray-500 hover:text-white transition-colors"
                data-feedback-ui="true"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* miniatura screenshota */}
              {captured?.screenshotB64 && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={`data:image/png;base64,${captured.screenshotB64}`}
                    alt="Zrzut ekranu"
                    className="max-w-full object-contain"
                    style={{ maxWidth: 300 }}
                  />
                </div>
              )}

              {/* info o elemencie */}
              {captured?.label && (
                <p className="text-[11px] text-gray-500 font-mono break-all">
                  Element: {captured.label}
                </p>
              )}

              {/* severity */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Typ zgłoszenia</label>
                <select
                  value={severity}
                  onChange={e => setSeverity(e.target.value as Severity)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 text-sm text-gray-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  data-feedback-ui="true"
                >
                  <option value="info">Info</option>
                  <option value="bug">Błąd</option>
                  <option value="idea">Pomysł</option>
                  <option value="blocker">Blokuje pracę</option>
                </select>
              </div>

              {/* textarea */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Opis</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Co się dzieje? Co powinno się stać?"
                  className="w-full rounded-xl border border-white/10 bg-white/5 text-sm text-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
                  data-feedback-ui="true"
                />
              </div>

              {/* błąd */}
              {submitError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">
                  Błąd: {submitError}
                </p>
              )}

              {/* sukces */}
              {submitSuccess && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 rounded-xl px-3 py-2">
                  ✓ Wysłano — dziękujemy!
                </p>
              )}
            </div>

            {/* modal footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => { setFeedbackOpen(false); setCaptured(null); }}
                disabled={submitting}
                className="flex-1 px-4 py-2 rounded-xl border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                data-feedback-ui="true"
              >
                Anuluj
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !message.trim() || submitSuccess}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-40"
                data-feedback-ui="true"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Wyślij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── panel Kanban / Lista zgłoszeń (full-screen) ──────────────────────── */}
      {listOpen && (
        <div
          className="fixed inset-3 z-[9999] flex flex-col rounded-2xl border border-white/10 bg-[#111318] shadow-2xl overflow-hidden"
          data-feedback-ui="true"
        >
          {/* ── header ── */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 flex-shrink-0">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              {isAdmin ? 'Wszystkie zgłoszenia' : 'Moje zgłoszenia'}
              <span className="text-xs text-gray-500 font-normal">({feedbackList.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs transition-colors ${viewMode === 'kanban' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  data-feedback-ui="true"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs border-l border-white/10 transition-colors ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  data-feedback-ui="true"
                >
                  <List className="w-3.5 h-3.5" />
                  Lista
                </button>
              </div>
              <button
                onClick={reloadList}
                disabled={loadingList}
                title="Odśwież"
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                data-feedback-ui="true"
              >
                <Loader2 className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setListOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                data-feedback-ui="true"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {listError && (
            <div className="px-4 py-1.5 flex-shrink-0 border-b border-white/10">
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-1.5">Błąd: {listError}</p>
            </div>
          )}

          {loadingList && feedbackList.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
            </div>
          )}

          {/* ── WIDOK KANBAN ── */}
          {viewMode === 'kanban' && !(loadingList && feedbackList.length === 0) && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="flex-1 overflow-hidden min-h-0">
                <div className="h-full grid grid-cols-4 gap-2 p-3">
                  {KANBAN_COLS.map((col) => {
                    const colItems = feedbackList.filter((f) => f.status === col.status);
                    return (
                      <div
                        key={col.status}
                        className={`flex flex-col rounded-xl border ${col.border} bg-white/[0.02]`}
                      >
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                          <span className={`text-xs font-semibold ${col.text}`}>{col.label}</span>
                          <span className="ml-auto text-[10px] text-gray-500 bg-white/5 rounded-full px-1.5 py-0.5 tabular-nums">{colItems.length}</span>
                        </div>
                        <Droppable droppableId={col.status}>
                          {(droppableProvided, snapshot) => (
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/[0.04]' : ''}`}
                            >
                              {colItems.length === 0 && !snapshot.isDraggingOver && (
                                <p className="text-center text-xs text-gray-700 py-8">—</p>
                              )}
                              {colItems.map((f, index) => {
                                const sevColor = SEV_COLORS[f.severity] ?? SEV_COLORS.info;
                                const date = new Date(f.created_at).toLocaleString('pl-PL', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                });
                                return (
                                  <Draggable key={f.id} draggableId={f.id} index={index}>
                                    {(draggableProvided, draggableSnapshot) => (
                                      <div
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        {...draggableProvided.dragHandleProps}
                                        className={`rounded-xl border bg-[#0e1015] p-2.5 space-y-2 select-none cursor-grab active:cursor-grabbing transition-shadow ${
                                          draggableSnapshot.isDragging
                                            ? 'border-indigo-500/50 shadow-2xl shadow-black/60 ring-1 ring-indigo-500/30'
                                            : 'border-white/10 hover:border-white/20'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${sevColor}`}>
                                            {f.severity}
                                          </span>
                                          <span className="text-[9px] text-gray-600 ml-auto tabular-nums">{date}</span>
                                        </div>
                                        {isAdmin && f.user_email && (
                                          <p className="text-[9px] text-gray-500 font-mono truncate">{f.user_email}</p>
                                        )}
                                        <p className="text-xs text-gray-200 leading-relaxed">{f.message}</p>
                                        {f.element_label && (
                                          <p className="text-[9px] text-gray-600 font-mono truncate">{f.element_label}</p>
                                        )}
                                        {f.admin_reply && !isAdmin && (
                                          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2 py-1.5">
                                            <p className="text-[9px] uppercase font-semibold text-indigo-300 mb-0.5">Odpowiedź</p>
                                            <p className="text-xs text-gray-300 whitespace-pre-wrap">{f.admin_reply}</p>
                                          </div>
                                        )}
                                        {isAdmin && (
                                          <div className="space-y-1 pt-1 border-t border-white/5">
                                            <textarea
                                              rows={2}
                                              value={replyDrafts[f.id] ?? f.admin_reply ?? ''}
                                              onChange={(e) => setReplyDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                                              placeholder="Odpowiedź…"
                                              onMouseDown={(e) => e.stopPropagation()}
                                              className="w-full rounded-lg border border-white/10 bg-white/5 text-xs text-gray-200 px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
                                              data-feedback-ui="true"
                                            />
                                            <button
                                              onClick={() => handleSaveReply(f.id)}
                                              disabled={!!savingReply[f.id]}
                                              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition-colors disabled:opacity-40"
                                              data-feedback-ui="true"
                                            >
                                              {savingReply[f.id] ? (
                                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                              ) : (
                                                <Send className="w-2.5 h-2.5" />
                                              )}
                                              Zapisz
                                            </button>
                                          </div>
                                        )}
                                        {!isAdmin && f.user_id === user?.id && (
                                          <button
                                            onClick={() => handleToggleResolved(f.id)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                                              f.status === 'done'
                                                ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                                                : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                            data-feedback-ui="true"
                                          >
                                            {f.status === 'done' ? (
                                              <>
                                                <Check className="w-3 h-3" /> Rozwiązane
                                              </>
                                            ) : (
                                              '✓ Oznacz'
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>
          )}

          {/* ── WIDOK LISTY ── */}
          {viewMode === 'list' && !(loadingList && feedbackList.length === 0) && (
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              {feedbackList.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-12">Brak zgłoszeń.</p>
              )}
              <div className="space-y-2 max-w-4xl mx-auto">
                {feedbackList.map((f) => {
                  const isMine = f.user_id === user?.id;
                  const sevColor = SEV_COLORS[f.severity] ?? SEV_COLORS.info;
                  const colCfg = KANBAN_COLS.find((c) => c.status === f.status)!;
                  const date = new Date(f.created_at).toLocaleString('pl-PL', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${sevColor}`}>{f.severity}</span>
                        <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${colCfg.border} ${colCfg.text}`}>{colCfg.label}</span>
                        {isAdmin && f.user_email && <span className="text-xs text-gray-400 font-mono">{f.user_email}</span>}
                        <span className="text-xs text-gray-500 ml-auto tabular-nums">{date}</span>
                      </div>
                      <p className="text-sm text-gray-200">{f.message}</p>
                      {f.element_label && <p className="text-[10px] text-gray-600 font-mono truncate">{f.element_label}</p>}
                      {f.admin_reply && !isAdmin && (
                        <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                          <p className="text-[10px] uppercase font-semibold text-indigo-300 mb-1">Odpowiedź</p>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{f.admin_reply}</p>
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex gap-4 flex-wrap">
                          <div className="flex-1 min-w-[240px] space-y-1.5">
                            <textarea
                              rows={2}
                              value={replyDrafts[f.id] ?? f.admin_reply ?? ''}
                              onChange={(e) => setReplyDrafts((d) => ({ ...d, [f.id]: e.target.value }))}
                              placeholder="Odpowiedź admina…"
                              className="w-full rounded-lg border border-white/10 bg-white/5 text-sm text-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-gray-600"
                              data-feedback-ui="true"
                            />
                            <button
                              onClick={() => handleSaveReply(f.id)}
                              disabled={!!savingReply[f.id]}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
                              data-feedback-ui="true"
                            >
                              {savingReply[f.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Zapisz odpowiedź
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <p className="text-[10px] text-gray-500 uppercase font-semibold">Przenieś do</p>
                            <div className="flex flex-wrap gap-1.5">
                              {KANBAN_COLS.filter((c) => c.status !== f.status).map((c) => (
                                <button
                                  key={c.status}
                                  onClick={() => handleMoveStatus(f.id, c.status)}
                                  disabled={!!movingStatus[f.id]}
                                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${c.border} ${c.text} hover:bg-white/5`}
                                  data-feedback-ui="true"
                                >
                                  {movingStatus[f.id] ? '…' : c.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      {!isAdmin && isMine && (
                        <button
                          onClick={() => handleToggleResolved(f.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                            f.status === 'done'
                              ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20'
                              : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                          }`}
                          data-feedback-ui="true"
                        >
                          {f.status === 'done' ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Rozwiązane
                            </>
                          ) : (
                            '✓ Oznacz jako rozwiązane'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
