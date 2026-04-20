import { CRM } from "@/components/atomic-crm/root/CRM";
import V1App from "./legacy-v1/App";
import EncryptionGate from "./legacy-v1/components/EncryptionGate";

/**
 * Entry point — path split:
 *   /v1  -> legacy V1 (CRM-ALINA insurance app, localStorage-based)
 *   /    -> Atomic CRM (Supabase-based, target V2)
 *
 * Hybrid mode: V1 lives as an "island" under /v1 so we can port modules
 * one-by-one into Atomic without breaking the working V1.
 */
const App = () => {
  const isV2 = typeof window !== "undefined" && window.location.pathname.startsWith("/v2");

  if (isV2) {
    return <CRM />;
  }

  return (
    <EncryptionGate>
      <V1App />
    </EncryptionGate>
  );
};

export default App;
