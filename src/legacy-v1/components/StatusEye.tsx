import { useEffect, useRef, useState } from 'react';
import { Eye, LogOut, Clock, Target, Send, X, Loader2, Bug, Sparkles } from 'lucide-react';
import { getSupabaseClient } from '../../components/atomic-crm/providers/supabase/supabase';
import { pickElement, submitFeedback, type CapturedElement } from '../services/feedbackCapture';

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
export default function StatusEye() {
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
            <div className="px-4 py-3">
              <button
                onClick={handleReportClick}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium transition-colors"
                data-feedback-ui="true"
              >
                <Target className="w-4 h-4" />
                Zgłoś problem
              </button>
            </div>

            {/* narzędzia dodatkowe */}
            <div className="border-t border-white/10" />
            <div className="px-4 py-3 flex gap-2">
              <button
                onClick={() => { setExpanded(false); window.dispatchEvent(new CustomEvent('crm:open-tester')); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-medium transition-colors"
                data-feedback-ui="true"
                title="Tester / demo generator"
              >
                <Bug className="w-3.5 h-3.5" /> Tester
              </button>
              <button
                onClick={() => { setExpanded(false); window.dispatchEvent(new CustomEvent('crm:open-agent')); }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-medium transition-colors"
                data-feedback-ui="true"
                title="Agent AI (Karateka)"
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
            className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
            data-feedback-ui="true"
            aria-label="Status i zgłoś problem"
          >
            <Eye className="w-6 h-6" />
          </button>
          {/* tooltip */}
          {!expanded && (
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-[#1a1d24] border border-white/10 px-3 py-1.5 text-xs text-gray-300 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              Status + Zgłoś problem
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
    </>
  );
}
