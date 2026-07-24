import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";
import { supabaseStorage } from "../services/supabaseStorage";
import PassphraseGate from "./PassphraseGate";
import StatusEye from "./StatusEye";
import { TestModeBanner } from "./TestModeBanner";

const TENANT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SUPABASE_TENANT_ID) ||
  "11111111-1111-1111-1111-111111111111";

interface EncryptionGateProps {
  children: React.ReactNode;
}

// Idle timeout: po jakim czasie bezczynności wymusić ponowne podanie passphrase
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 min
// Sleep/hibernate threshold: jeśli minęło >5 min od ostatniej widoczności, lock
const SUSPEND_LOCK_THRESHOLD_MS = 5 * 60 * 1000;

export const EncryptionGate: React.FC<EncryptionGateProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<number | null>(null);

  // Auto-lock po idle timeout lub sleep/hibernate
  const lock = () => {
    setUnlocked(false);
    supabaseStorage.setDEK(null);
  };

  useEffect(() => {
    if (!unlocked) return;

    // 1) Reset idle timer przy każdej aktywności użytkownika
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(lock, IDLE_TIMEOUT_MS);
    };
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"];
    activityEvents.forEach((e) =>
      window.addEventListener(e, markActivity, { passive: true }),
    );
    markActivity(); // start

    // 2) Sleep/hibernate detection: gdy karta wraca z hidden, sprawdź ile minęło
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const gap = Date.now() - lastActivityRef.current;
        if (gap > SUSPEND_LOCK_THRESHOLD_MS) {
          console.warn(
            `[EncryptionGate] Suspend detected (${Math.round(gap / 1000)}s offline) - lockuje sesje`,
          );
          lock();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // 3) BFCache restore: gdy przeglądarka przywraca strone z back-forward cache
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.warn("[EncryptionGate] BFCache restore - lockuje sesje");
        lock();
      }
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      activityEvents.forEach((e) =>
        window.removeEventListener(e, markActivity),
      );
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [unlocked]);

  useEffect(() => {
    const sb = getSupabaseClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
      } else {
        setUser(null);
        setUnlocked(false);
        supabaseStorage.setDEK(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUnlocked = (dek: CryptoKey) => {
    supabaseStorage.setDEK(dek);
    setUnlocked(true);
  };

  const handleLogout = async () => {
    const sb = getSupabaseClient();
    supabaseStorage.setDEK(null);
    await sb.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090b] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  // Brak sesji — AuthBarrier pokazuje ekran logowania, my nic nie renderujemy.
  if (!user) return null;

  if (!unlocked) {
    return (
      <>
        <PassphraseGate
          userId={user.id}
          tenantId={TENANT_ID}
          userEmail={user.email}
          onUnlocked={handleUnlocked}
          onLogout={handleLogout}
        />
        <StatusEye isUnlocked={false} />
      </>
    );
  }

  return (
    <>
      {children}
      <StatusEye isUnlocked={true} />
      <TestModeBanner />
    </>
  );
};

export default EncryptionGate;
