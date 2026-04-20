import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseClient } from "../../components/atomic-crm/providers/supabase/supabase";
import { supabaseStorage } from "../services/supabaseStorage";
import PassphraseGate from "./PassphraseGate";
import StatusEye from "./StatusEye";

const TENANT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_SUPABASE_TENANT_ID) ||
  "11111111-1111-1111-1111-111111111111";

interface EncryptionGateProps {
  children: React.ReactNode;
}

export const EncryptionGate: React.FC<EncryptionGateProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const sb = getSupabaseClient();
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? "" });
      }
      setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
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
        <StatusEye />
      </>
    );
  }

  return <>{children}</>;
};

export default EncryptionGate;
