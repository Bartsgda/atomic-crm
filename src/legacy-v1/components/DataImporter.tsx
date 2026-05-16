import React, { useState, useRef, useEffect } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  FileSpreadsheet,
  Database,
  Shield,
  Terminal,
  Trash2,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { DataMapper } from "../services/dataMapper";
import { storage } from "../services/storage";
import { LegacyRateExtractor } from "../services/legacyRateExtractor";
import { SubAgent, Client, Policy, ClientNote } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ImportStats {
  totalRowsProcessed: number;
  clientsCreated: number;
  clientsUpdated: number;
  policiesCreated: number;
  policiesMerged: number;
  notes: number;
  totalCommission: number;
  subAgentsDetected: number;
  insurersUpdated: number;
  ratesLearned: number;
}

export const DataImporter: React.FC<Props> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [processedRows, setProcessedRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const logEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // .enc passphrase flow (import decrypt)
  const [encPending, setEncPending] = useState<File | null>(null);
  const [encPass, setEncPass] = useState("");
  const [encDecrypting, setEncDecrypting] = useState(false);
  // Tab
  const [activeTab, setActiveTab] = useState<"import" | "encrypt">("import");
  // Encrypt tab
  const [encryptFile, setEncryptFile] = useState<File | null>(null);
  const [encryptPass, setEncryptPass] = useState("");
  const [encryptPassConfirm, setEncryptPassConfirm] = useState("");
  const [encryptBusy, setEncryptBusy] = useState(false);
  const [encryptDone, setEncryptDone] = useState(false);
  const [encryptDragOver, setEncryptDragOver] = useState(false);
  const encryptFileInputRef = useRef<HTMLInputElement>(null);
  // Corrections (.ts.enc)
  const [useCorrections, setUseCorrections] = useState(false);
  const [corrFile, setCorrFile] = useState<File | null>(null);
  const [corrPass, setCorrPass] = useState("");
  const [corrStatus, setCorrStatus] = useState<string | null>(null);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  if (!isOpen) return null;

  const log = (msg: string) => {
    setLogs((prev) => [...prev, msg]);
    console.log(`[Importer] ${msg}`);
  };

  const norm = (str?: string) =>
    str ? str.trim().toLowerCase().replace(/\s+/g, " ") : "";

  const processSpreadsheetData = async (workbook: XLSX.WorkBook) => {
    setIsProcessing(true);
    setProcessedRows(0);
    setError(null);
    setLogs([]);

    let counts: ImportStats = {
      totalRowsProcessed: 0,
      clientsCreated: 0,
      clientsUpdated: 0,
      policiesCreated: 0,
      policiesMerged: 0,
      notes: 0,
      totalCommission: 0,
      subAgentsDetected: 0,
      insurersUpdated: 0,
      ratesLearned: 0,
    };

    try {
      log("🚀 Inicjalizacja procesu importu...");
      if (!storage.hasDEK()) {
        throw new Error(
          'Sesja zaszyfrowania jest zablokowana. Wróć na ekran logowania, ' +
          'wpisz hasło szyfrowania (EncryptionGate) i spróbuj ponownie.',
        );
      }
      const currentState = await storage.init();
      const workingClients: Client[] = [...currentState.clients];
      const clientMap = new Map<string, Client>();
      workingClients.forEach((c) => clientMap.set(c.id, c));

      const allNotes: ClientNote[] = [...currentState.notes];
      const allPolicies: Policy[] = [...currentState.policies];
      const allSubAgents: SubAgent[] = [...currentState.subAgents];
      const allInsurers = new Set<string>(currentState.insurers || []);
      const allInsurerConfigs = { ...currentState.insurerConfigs };

      // --- STEP 1: POLICIES ---
      let policySheetName =
        workbook.SheetNames.find((n) => n.toUpperCase().includes("POLISY")) ||
        workbook.SheetNames[0];
      log(`📂 Wykryto arkusz: ${policySheetName}`);

      const policySheet = workbook.Sheets[policySheetName];
      const policyRows = XLSX.utils.sheet_to_json(policySheet, {
        header: 1,
        defval: "",
      }) as any[][];

      let startIndex = 0;
      for (let i = 0; i < Math.min(20, policyRows.length); i++) {
        const rowStr = JSON.stringify(policyRows[i]).toLowerCase();
        if (
          rowStr.includes("imię") ||
          rowStr.includes("kontakt") ||
          rowStr.includes("nazwisko")
        ) {
          startIndex = i + 1;
          log(`📍 Znaleziono nagłówek w wierszu ${i + 1}.`);
          break;
        }
      }

      const usableRows = policyRows
        .slice(startIndex)
        .filter(
          (row) =>
            row && row.some((cell) => cell && String(cell).trim().length > 1),
        );
      setTotalRows(usableRows.length);
      log(`📊 Do przetworzenia: ${usableRows.length} wierszy.`);

      const subAgentCache = new Map<string, string>();
      allSubAgents.forEach((sa) =>
        subAgentCache.set(sa.name.toLowerCase(), sa.id),
      );

      const importedPolicies: Policy[] = [];

      for (let i = 0; i < usableRows.length; i++) {
        const row = usableRows[i];
        setProcessedRows(i + 1);
        counts.totalRowsProcessed++;

        try {
          const result = DataMapper.mapRow(row);
          if (result) {
            const parsedClient = result.client;
            if (!parsedClient.lastName) {
              log(
                `⚠️ [Wiersz ${i + startIndex + 1}] POMINIĘTO: Brak nazwiska.`,
              );
              continue;
            }

            // Client matching logic
            let existing = workingClients.find((ex) => {
              if (
                ex.pesel &&
                parsedClient.pesel &&
                ex.pesel === parsedClient.pesel &&
                parsedClient.pesel.length === 11
              )
                return true;
              const exLast = norm(ex.lastName);
              const exFirst = norm(ex.firstName);
              const impLast = norm(parsedClient.lastName);
              const impFirst = norm(parsedClient.firstName);
              if (
                exLast &&
                impLast &&
                exLast === impLast &&
                exFirst === impFirst
              )
                return true;
              return false;
            });

            let finalClientId = "";
            if (existing) {
              finalClientId = existing.id;
              counts.clientsUpdated++;
            } else {
              workingClients.push(parsedClient);
              clientMap.set(parsedClient.id, parsedClient);
              finalClientId = parsedClient.id;
              counts.clientsCreated++;
            }

            result.policy.clientId = finalClientId;

            // Deterministyczne ID — ten sam wiersz XLSX → ten sam UUID w DB → upsert UPDATE zamiast INSERT
            result.policy.id = `xlsx_imp_row_${i}`;
            result.notes.forEach((note, noteIdx) => {
              note.id = `n_imp_xlsx_imp_row_${i}_${noteIdx}`;
            });

            // Agency detection
            if (result.sourceName) {
              const normalizedName = result.sourceName.trim();
              const lowerName = normalizedName.toLowerCase();
              let agentId = subAgentCache.get(lowerName);

              if (!agentId) {
                agentId = `sa_imp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                const newAgent: SubAgent = {
                  id: agentId,
                  name: normalizedName,
                  defaultRates: { OC: 0, AC: 0 },
                };
                allSubAgents.push(newAgent);
                subAgentCache.set(lowerName, agentId);
                counts.subAgentsDetected++;
              }
              result.policy.subAgentId = agentId;
            }

            if (result.policy.insurerName?.trim())
              allInsurers.add(result.policy.insurerName.trim());

            const existPIdx = allPolicies.findIndex(p => p.id === result.policy.id);
            if (existPIdx >= 0) {
              allPolicies[existPIdx] = result.policy;
            } else {
              allPolicies.push(result.policy);
            }
            importedPolicies.push(result.policy);
            counts.policiesCreated++;

            if (result.policy.commission > 0)
              counts.totalCommission += result.policy.commission;

            for (const note of result.notes) {
              note.clientId = finalClientId;
              note.linkedPolicyIds = [result.policy.id];
              const existNIdx = allNotes.findIndex(n => n.id === note.id);
              if (existNIdx >= 0) {
                allNotes[existNIdx] = note;
              } else {
                allNotes.push(note);
              }
              counts.notes++;
            }

            if ((i + 1) % 50 === 0) {
              log(`⏳ Postęp: ${i + 1}/${usableRows.length} wierszy...`);
            }
          }
        } catch (rowError) {
          log(`❌ [Wiersz ${i + startIndex + 1}] BŁĄD: ${String(rowError)}`);
        }
      }

      log("🧠 Uruchomienie LegacyRateExtractor (analiza stawek)...");
      const learnedAgents = LegacyRateExtractor.extractAndApplyRates(
        importedPolicies,
        allSubAgents,
      );

      log("💾 Zapisywanie stanu do LocalStorage...");
      await storage.importState({
        ...currentState,
        clients: workingClients,
        policies: allPolicies,
        notes: allNotes,
        subAgents: learnedAgents,
        insurers: Array.from(allInsurers),
        insurerConfigs: allInsurerConfigs,
      });

      counts.ratesLearned = learnedAgents.length;
      log("✅ Import zakończony sukcesem.");

      setStats(counts);
      onImportComplete();
    } catch (e: any) {
      log(`❌ BŁĄD KRYTYCZNY: ${e.message}`);
      setError(e.message || "Błąd przetwarzania pliku.");
    } finally {
      setIsProcessing(false);
    }
  };

  const encryptWithPassphrase = async (
    buf: ArrayBuffer,
    passphrase: string,
  ): Promise<ArrayBuffer> => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, buf);
    const out = new Uint8Array(16 + 12 + ct.byteLength);
    out.set(salt, 0);
    out.set(iv, 16);
    out.set(new Uint8Array(ct), 28);
    return out.buffer;
  };

  const parseTsCorrections = (src: string): Record<string, any> => {
    const result: Record<string, any> = {};
    const declRegex = /export\s+const\s+\w+[^=]*=\s*\{/g;
    let m;
    while ((m = declRegex.exec(src)) !== null) {
      const braceStart = m.index + m[0].lastIndexOf("{");
      let depth = 0;
      let i = braceStart;
      for (; i < src.length; i++) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
      }
      const objectStr = src.slice(braceStart, i + 1);
      try {
        // eslint-disable-next-line no-new-func
        const obj = new Function("return " + objectStr)();
        Object.assign(result, obj);
      } catch {}
    }
    return result;
  };

  const handleEncryptAndDownload = async () => {
    if (!encryptFile || !encryptPass || encryptPass !== encryptPassConfirm) return;
    setEncryptBusy(true);
    setEncryptDone(false);
    setError(null);
    try {
      const buf = await encryptFile.arrayBuffer();
      const encrypted = await encryptWithPassphrase(buf, encryptPass);
      const blob = new Blob([encrypted], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = encryptFile.name + ".enc";
      a.click();
      URL.revokeObjectURL(url);
      setEncryptDone(true);
      setEncryptPass("");
      setEncryptPassConfirm("");
    } catch (err: any) {
      setError(err?.message ?? "Błąd szyfrowania.");
    } finally {
      setEncryptBusy(false);
    }
  };

  const handleLoadCorrections = async () => {
    if (!corrFile || !corrPass) return;
    setCorrStatus(null);
    try {
      const raw = await corrFile.arrayBuffer();
      const decrypted = await decryptWithPassphrase(raw, corrPass);
      const src = new TextDecoder("utf-8").decode(decrypted);
      const parsed = parseTsCorrections(src);
      const count = Object.keys(parsed).length;
      DataMapper.overrideMap = parsed;
      setCorrStatus(`✅ Załadowano ${count} korekcji`);
      setCorrPass("");
    } catch (err: any) {
      setCorrStatus("❌ " + (err?.message ?? "Błąd deszyfrowania"));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // PBKDF2-SHA256 (600k) + AES-256-GCM — ten sam algorytm co PassphraseGate
  // Format pliku .enc: [16B salt][12B IV][ciphertext+GCM tag]
  const decryptWithPassphrase = async (
    buf: ArrayBuffer,
    passphrase: string,
  ): Promise<ArrayBuffer> => {
    const salt = new Uint8Array(buf, 0, 16);
    const iv = new Uint8Array(buf, 16, 12);
    const ct = new Uint8Array(buf, 28);
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    try {
      return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ct);
    } catch {
      throw new Error("Błędne hasło lub uszkodzony plik .enc.");
    }
  };

  const parseAndImport = async (
    buf: ArrayBuffer,
    innerExt: string,
    label: string,
  ) => {
    try {
      if (innerExt === "csv") {
        const text = new TextDecoder("utf-8").decode(buf);
        const workbook = XLSX.read(text, { type: "string", cellDates: true });
        log(`📄 CSV: ${label}`);
        await processSpreadsheetData(workbook);
      } else if (innerExt === "xlsx" || innerExt === "xls") {
        const workbook = XLSX.read(buf, { type: "array", cellDates: true });
        log(`📊 Excel: ${label}`);
        await processSpreadsheetData(workbook);
      } else {
        setError(
          `Format .${innerExt} nie jest importowalny. Plik odszyfrowany OK — skopiuj dane do .csv lub .xlsx.`,
        );
      }
    } catch (err: any) {
      setError(err?.message ?? "Błąd parsowania pliku.");
    }
  };

  const handleDecryptAndImport = async () => {
    if (!encPending || !encPass) return;
    setEncDecrypting(true);
    setError(null);
    const file = encPending;
    const innerName = file.name.slice(0, -4); // strip .enc
    const innerExt = innerName.split(".").pop()?.toLowerCase() ?? "";
    try {
      log(`🔐 Odszyfrowywanie ${file.name}...`);
      const raw = await file.arrayBuffer();
      const decrypted = await decryptWithPassphrase(raw, encPass);
      setEncPending(null);
      setEncPass("");
      log(
        `✅ Odszyfrowano (${(decrypted.byteLength / 1024).toFixed(1)} KB) — importuję...`,
      );
      await parseAndImport(decrypted, innerExt, innerName);
    } catch (err: any) {
      setError(err?.message ?? "Błąd deszyfrowania.");
    } finally {
      setEncDecrypting(false);
    }
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    setError(null);
    setStats(null);
    setLogs([]);

    if (ext === "enc") {
      setEncPending(file);
      setEncPass("");
    } else if (ext === "csv") {
      const text = await file.text();
      const workbook = XLSX.read(text, { type: "string", cellDates: true });
      await processSpreadsheetData(workbook);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const workbook = XLSX.read(e.target?.result as ArrayBuffer, {
            type: "array",
            cellDates: true,
          });
          await processSpreadsheetData(workbook);
        } catch {
          setError("Błąd struktury pliku Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Obsługiwane formaty: .xlsx, .xls, .csv, .enc (zaszyfrowane)");
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md transition-opacity animate-in fade-in"
        onClick={!isProcessing ? onClose : undefined}
      />

      <div className="relative w-full max-w-4xl bg-zinc-900 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)] rounded-[1.75rem] overflow-hidden flex flex-col h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Sandbox Header */}
        <div className="bg-indigo-600 px-6 py-2 flex items-center justify-center gap-2 text-white text-[10px] font-black uppercase tracking-widest flex-shrink-0">
          <Shield size={12} /> Local Sandbox — No Cloud Sync
        </div>

        <div className="p-8 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
                <Database className="text-indigo-400" /> Importer XLSX{" "}
                <span className="text-indigo-500/50 text-sm font-normal">
                  v5.1
                </span>
              </h2>
              <p className="text-zinc-500 mt-1">
                Lokalna destylacja danych ubezpieczeniowych.
              </p>
            </div>
            {!isProcessing && (
              <button
                onClick={onClose}
                className="p-3 hover:bg-white/5 rounded-full transition-colors text-zinc-500 hover:text-white"
              >
                <X size={24} />
              </button>
            )}
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-6 bg-zinc-800/40 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab("import")}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === "import"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Importuj
            </button>
            <button
              onClick={() => { setActiveTab("encrypt"); setError(null); }}
              className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                activeTab === "encrypt"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Szyfruj
            </button>
          </div>

          {stats ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 mb-6 rotate-3">
                <CheckCircle size={56} className="text-white" />
              </div>
              <h3 className="text-4xl font-black text-white tracking-tighter mb-2">
                Gotowe!
              </h3>
              <p className="text-zinc-400 mb-8 max-w-sm">
                Dzięki! Dane są już w Twojej lokalnej piaskownicy.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                <div className="bg-zinc-800/50 p-6 rounded-3xl border border-white/5">
                  <div className="text-3xl font-black text-indigo-400">
                    {stats.policiesCreated}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    Polisy
                  </div>
                </div>
                <div className="bg-zinc-800/50 p-6 rounded-3xl border border-white/5">
                  <div className="text-3xl font-black text-indigo-400">
                    {stats.clientsCreated + stats.clientsUpdated}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                    Klienci
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setStats(null);
                  onClose();
                }}
                className="w-full max-w-xs bg-white text-black py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-xl"
              >
                Zamknij
              </button>
            </div>
          ) : activeTab === "import" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 overflow-hidden">
              {/* Drag Area */}
              <div className="flex flex-col gap-6">
                {encPending ? (
                  /* ── Passphrase form for .enc files ── */
                  <div className="flex-1 rounded-2xl border border-indigo-500/30 bg-indigo-950/30 flex flex-col items-center justify-center p-8 gap-5 animate-in fade-in">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20">
                      <Shield className="text-indigo-400" size={28} />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-base">
                        Plik zaszyfrowany
                      </p>
                      <p className="text-zinc-500 text-xs mt-1 font-mono">
                        {encPending.name}
                      </p>
                    </div>
                    <div className="w-full max-w-xs space-y-3">
                      <input
                        type="password"
                        placeholder="Hasło do odszyfrowania..."
                        value={encPass}
                        onChange={(e) => setEncPass(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleDecryptAndImport()
                        }
                        autoFocus
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleDecryptAndImport}
                          disabled={!encPass || encDecrypting}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          {encDecrypting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />{" "}
                              Odszyfrowywanie...
                            </>
                          ) : (
                            <>
                              <Shield size={14} /> Odszyfruj i importuj
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEncPending(null);
                            setEncPass("");
                          }}
                          className="px-3 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors text-sm"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !isProcessing ? (
                  <div
                    className={`
                                        flex-1 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 transition-colors flex flex-col items-center justify-center p-8 gap-4
                                        ${
                                          isDragOver
                                            ? "border-indigo-400 bg-indigo-500/10 scale-[0.98]"
                                            : "border-zinc-800 bg-zinc-800/30 hover:border-zinc-700 hover:bg-zinc-800/50"
                                        }
                                    `}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".xlsx,.xls,.csv,.enc"
                      onChange={handleFileInput}
                    />
                    <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 border border-indigo-500/20 shadow-inner">
                      <FileSpreadsheet className="text-indigo-400" size={32} />
                    </div>
                    <p className="text-white font-bold text-lg">
                      Wybierz plik Excel / CSV
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                      .xlsx · .xls · .csv · .enc (zaszyfrowane)
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col items-center justify-center p-8 text-center animate-pulse">
                    <div className="relative z-10 text-center">
                      <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6 mx-auto shadow-2xl shadow-indigo-500/40" />
                      <p className="text-white text-xl font-black tracking-tight uppercase">
                        Analiza...
                      </p>
                      <p className="text-indigo-400 mt-2 font-mono text-xs">
                        {processedRows} / {totalRows}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-zinc-800/30 rounded-3xl p-6 border border-white/5 space-y-3">
                  <h4 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <AlertCircle size={14} className="text-amber-500" />{" "}
                    Przewodnik
                  </h4>
                  <ul className="text-[11px] text-zinc-500 space-y-2">
                    <li className="flex gap-2">
                      <span className="text-indigo-500">•</span> Automatyczne
                      łączenie danych po numerze PESEL.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-500">•</span> Detekcja
                      prowizji i stawek agentów legacy.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-500">•</span> Pełna izolacja
                      — dane nie opuszczają przeglądarki.
                    </li>
                  </ul>
                </div>

                {/* Korekcje .ts.enc */}
                <div className="rounded-2xl border border-white/5 bg-zinc-800/20 p-4 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCorrections}
                      onChange={(e) => {
                        setUseCorrections(e.target.checked);
                        if (!e.target.checked) {
                          DataMapper.overrideMap = {};
                          setCorrStatus(null);
                          setCorrFile(null);
                          setCorrPass("");
                        }
                      }}
                      className="w-4 h-4 rounded accent-indigo-500"
                    />
                    <span className="text-xs font-bold text-zinc-400">
                      Użyj pliku korekcji{" "}
                      <span className="text-zinc-600 font-normal">.ts.enc</span>
                    </span>
                  </label>
                  {useCorrections && (
                    <div className="space-y-2 animate-in fade-in">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                        <Shield size={12} className="text-indigo-400" />
                        <span>{corrFile ? corrFile.name : "Wybierz plik .ts.enc..."}</span>
                        <input
                          type="file"
                          accept=".enc"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) { setCorrFile(f); setCorrStatus(null); }
                          }}
                        />
                      </label>
                      {corrFile && (
                        <div className="flex gap-2">
                          <input
                            type="password"
                            placeholder="Hasło do .ts.enc..."
                            value={corrPass}
                            onChange={(e) => setCorrPass(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleLoadCorrections()}
                            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-600 text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            onClick={handleLoadCorrections}
                            disabled={!corrPass}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg text-xs font-bold text-white transition-colors"
                          >
                            Wczytaj
                          </button>
                        </div>
                      )}
                      {corrStatus && (
                        <p className={`text-xs ${corrStatus.startsWith("✅") ? "text-emerald-400" : "text-red-400"}`}>
                          {corrStatus}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Logs Area */}
              <div className="flex flex-col h-full min-h-0 bg-black/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-inner">
                <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
                  <h4 className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    <Terminal size={12} /> Konsola Logowania
                  </h4>
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] text-zinc-600 hover:text-indigo-400 transition-colors uppercase font-bold"
                  >
                    Wyczyść
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar font-mono text-[10px] leading-relaxed">
                  {logs.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-700 italic">
                      Oczekiwanie na plik...
                    </div>
                  ) : (
                    logs.map((logStr, i) => (
                      <div
                        key={i}
                        className={`py-1 ${
                          logStr.includes("❌")
                            ? "text-red-400"
                            : logStr.includes("⚠️")
                              ? "text-amber-400"
                              : logStr.includes("✅")
                                ? "text-emerald-400"
                                : "text-zinc-500"
                        }`}
                      >
                        {logStr}
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          ) : (
            /* ── Zakładka Szyfruj ── */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden">
              {/* Drop zone */}
              <div className="flex flex-col gap-5">
                <div
                  className={`flex-1 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 gap-4 transition-all cursor-pointer ${
                    encryptDragOver
                      ? "border-emerald-400 bg-emerald-500/10 scale-[0.98]"
                      : encryptFile
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setEncryptDragOver(true); }}
                  onDragLeave={() => setEncryptDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setEncryptDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) { setEncryptFile(f); setEncryptDone(false); setError(null); }
                  }}
                  onClick={() => encryptFileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={encryptFileInputRef}
                    className="hidden"
                    accept=".xlsx,.xls,.csv,.ts"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setEncryptFile(f); setEncryptDone(false); setError(null); }
                    }}
                  />
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                    <Shield className="text-emerald-400" size={28} />
                  </div>
                  {encryptFile ? (
                    <div className="text-center">
                      <p className="text-white font-bold">{encryptFile.name}</p>
                      <p className="text-zinc-500 text-xs mt-1">
                        {(encryptFile.size / 1024).toFixed(1)} KB — kliknij żeby zmienić
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-white font-bold text-lg">Przeciągnij plik do zaszyfrowania</p>
                      <p className="text-zinc-500 text-sm">.xlsx · .xls · .csv · .ts</p>
                    </>
                  )}
                </div>

                {encryptFile && (
                  <div className="bg-zinc-800/40 rounded-2xl border border-white/5 p-5 space-y-3 animate-in fade-in">
                    <input
                      type="password"
                      placeholder="Hasło szyfrowania..."
                      value={encryptPass}
                      onChange={(e) => setEncryptPass(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <input
                      type="password"
                      placeholder="Powtórz hasło..."
                      value={encryptPassConfirm}
                      onChange={(e) => setEncryptPassConfirm(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEncryptAndDownload()}
                      className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors ${
                        encryptPassConfirm && encryptPass !== encryptPassConfirm
                          ? "border-red-500/60"
                          : "border-zinc-700 focus:border-emerald-500"
                      }`}
                    />
                    {encryptPassConfirm && encryptPass !== encryptPassConfirm && (
                      <p className="text-red-400 text-xs">Hasła nie są identyczne.</p>
                    )}
                    <button
                      onClick={handleEncryptAndDownload}
                      disabled={
                        !encryptPass ||
                        encryptPass !== encryptPassConfirm ||
                        encryptBusy
                      }
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {encryptBusy ? (
                        <><Loader2 size={16} className="animate-spin" /> Szyfrowanie...</>
                      ) : (
                        <><Shield size={16} /> Zaszyfruj i pobierz .enc</>
                      )}
                    </button>
                    {encryptDone && (
                      <p className="text-emerald-400 text-xs text-center animate-in fade-in">
                        ✅ Plik zaszyfrowany i pobrany jako <strong>{encryptFile.name}.enc</strong>
                      </p>
                    )}
                    {error && (
                      <p className="text-red-400 text-xs text-center">{error}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Info panel */}
              <div className="flex flex-col gap-5">
                <div className="bg-zinc-800/30 rounded-2xl border border-white/5 p-6 space-y-4">
                  <h4 className="text-white text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Shield size={14} className="text-emerald-500" /> Jak to działa
                  </h4>
                  <ul className="text-[11px] text-zinc-500 space-y-3 leading-relaxed">
                    <li className="flex gap-2">
                      <span className="text-emerald-500">1.</span>
                      Wybierz plik XLSX, CSV lub TS z danymi.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-500">2.</span>
                      Wpisz hasło dwukrotnie.
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-500">3.</span>
                      Plik zostanie pobrany jako{" "}
                      <span className="text-zinc-400 font-mono">plik.enc</span> —
                      zaszyfrowany PBKDF2+AES-256-GCM (600k iteracji).
                    </li>
                    <li className="flex gap-2">
                      <span className="text-emerald-500">4.</span>
                      Zaszyfrowany plik możesz wgrać w zakładce{" "}
                      <span className="text-zinc-400">Importuj</span> — system
                      poprosi o hasło przed importem.
                    </li>
                  </ul>
                  <div className="pt-2 border-t border-white/5 text-[10px] text-zinc-600">
                    Szyfrowanie odbywa się wyłącznie w przeglądarce. Hasło nigdy
                    nie opuszcza urządzenia.
                  </div>
                </div>

                <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 p-5">
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    <span className="text-emerald-400 font-bold">Tip dla pliku .ts:</span>{" "}
                    Plik z korekcjami (np. <span className="font-mono">auto.ts</span>)
                    zaszyfruj i zapisz jako <span className="font-mono">auto.ts.enc</span>.
                    Przy następnym imporcie użyj checkboxa „Korekcje" i wczytaj
                    ten plik.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #4f46e550; border-radius: 2px; }
            `}</style>
      </div>
    </div>
  );
};
