import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Search,
  FolderOpen,
  User,
  X,
  FileText,
  ExternalLink,
  Trash2,
  Image as ImageIcon,
  Layers,
  Car,
  Home,
  AlertTriangle,
} from "lucide-react";
import { Client, Policy } from "../../types";
import { ClientDocument } from "./types";
import { processImageFile, formatBytes } from "./imageProcessing";
import { DropZone } from "./DropZone";
import { ImageThumb } from "./ImageThumb";

interface Props {
  /** lista klientów (wpięcie: state.clients) */
  clients?: Client[];
  /** lista polis (wpięcie: state.policies) — kontekst pojazd/dom/polisa */
  policies?: Policy[];
  /** opcjonalny klient startowy (np. z widoku szczegółów klienta) */
  initialClientId?: string;
}

const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// --- limity bezpieczeństwa (audyt S4 2026-07-25) ---
/** Twardy limit rozmiaru pojedynczego pliku — chroni pamięć karty (object-URL + canvas resize). */
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
/** Whitelist MIME dla obrazów — NIE polegamy na `startsWith("image/")`, które łapie też `image/svg+xml`. */
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** Krótka etykieta polisy dla kontekstu dokumentu. */
function policyLabel(p: Policy): string {
  if (p.type === "DOM" || p.type === "FIRMA") {
    return p.propertyAddress || `${p.type} ${p.policyNumber || ""}`.trim();
  }
  const veh = [p.vehicleBrand, p.vehicleModel, p.vehicleReg]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (veh) return veh;
  return `${p.type} ${p.policyNumber || ""}`.trim() || p.type;
}

export const DocumentCenter: React.FC<Props> = ({
  clients = [],
  policies = [],
  initialClientId,
}) => {
  const [query, setQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClientId ?? null,
  );
  const [contextPolicyId, setContextPolicyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [preview, setPreview] = useState<ClientDocument | null>(null);
  const [fileWarning, setFileWarning] = useState<string | null>(null);

  // --- czyszczenie object URL-i przy odmontowaniu (unikamy wycieków pamięci) ---
  const docsRef = useRef(docs);
  useEffect(() => {
    docsRef.current = docs;
  }, [docs]);
  useEffect(() => {
    return () => {
      docsRef.current.forEach((d) => {
        if (d.displayUrl) URL.revokeObjectURL(d.displayUrl);
        if (d.pdfUrl) URL.revokeObjectURL(d.pdfUrl);
      });
    };
  }, []);

  // --- toast ostrzegawczy przy odrzuceniu pliku (limit rozmiaru / typ) ---
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);
  const showFileWarning = useCallback((message: string) => {
    setFileWarning(message);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setFileWarning(null), 5000);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? clients.filter(
          (c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
            `${c.lastName} ${c.firstName}`.toLowerCase().includes(q) ||
            (c.pesel || "").includes(q),
        )
      : clients;
    return base.slice(0, 40);
  }, [clients, query]);

  const clientPolicies = useMemo(
    () => policies.filter((p) => p.clientId === selectedClientId),
    [policies, selectedClientId],
  );

  const clientDocs = useMemo(
    () => docs.filter((d) => d.clientId === selectedClientId),
    [docs, selectedClientId],
  );
  const images = clientDocs.filter((d) => d.kind === "image");
  const pdfs = clientDocs.filter((d) => d.kind === "pdf");

  const updateDoc = useCallback(
    (id: string, patch: Partial<ClientDocument>) => {
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      );
    },
    [],
  );

  // --- dodawanie plików (zdjęcia → resize+EXIF, PDF → lista) ---
  const handleFiles = useCallback(
    async (files: File[]) => {
      if (!selectedClientId) return;
      const clientId = selectedClientId;
      const ctxPolicy = contextPolicyId
        ? clientPolicies.find((p) => p.id === contextPolicyId)
        : undefined;
      const contextLabel = ctxPolicy ? policyLabel(ctxPolicy) : undefined;

      for (const file of files) {
        const id = uid();
        const isPdf =
          file.type === "application/pdf" || /\.pdf$/i.test(file.name);

        // Whitelist MIME zamiast `startsWith("image/")` — ten łapał też
        // `image/svg+xml` (SVG może nieść skrypty). Drag&drop omija ACCEPT
        // z DropZone, więc ta walidacja jest jedyną linią obrony.
        if (!isPdf && !ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
          showFileWarning(
            file.type === "image/svg+xml"
              ? `Pominięto „${file.name}” — pliki SVG są niedozwolone (mogą zawierać skrypty).`
              : `Pominięto „${file.name}” — nieobsługiwany typ pliku${file.type ? ` (${file.type})` : ""}.`,
          );
          continue;
        }

        // Twardy limit rozmiaru — duży plik zapycha pamięć (object-URL +
        // canvas resize) i potrafi zawiesić kartę przeglądarki.
        if (file.size > MAX_FILE_BYTES) {
          showFileWarning(
            `Pominięto „${file.name}” — plik za duży (${formatBytes(file.size)}, limit ${formatBytes(MAX_FILE_BYTES)}).`,
          );
          continue;
        }

        if (isPdf) {
          const pdfUrl = URL.createObjectURL(file);
          setDocs((prev) => [
            {
              id,
              clientId,
              kind: "pdf",
              name: file.name,
              status: "ready",
              createdAt: new Date().toISOString(),
              policyId: ctxPolicy?.id,
              contextLabel,
              pdfUrl,
              pdfFile: file,
              sizeBytes: file.size,
            },
            ...prev,
          ]);
          // TODO storage: upload oryginału PDF do Supabase Storage (bucket per klient) / Cloudflare.
          continue;
        }

        // placeholder w trakcie przetwarzania
        setDocs((prev) => [
          {
            id,
            clientId,
            kind: "image",
            name: file.name,
            status: "processing",
            createdAt: new Date().toISOString(),
            policyId: ctxPolicy?.id,
            contextLabel,
            originalFile: file,
            rotation: 0,
            sizeBytes: file.size,
          },
          ...prev,
        ]);

        try {
          const p = await processImageFile(file, {
            maxEdge: 1800,
            quality: 0.85,
          });
          updateDoc(id, {
            status: "ready",
            displayUrl: p.url,
            width: p.width,
            height: p.height,
            sizeBytes: p.sizeBytes,
          });
          // TODO storage: upload przetworzonego blob (p.blob) do Supabase Storage / Cloudflare.
          // TODO ocr: tu wpłynie rozpoznanie VIN / nr polisy (Flash/Gemma) na p.blob → metadane dokumentu.
        } catch (e) {
          console.error("[DocumentCenter] processImageFile failed:", e);
          updateDoc(id, { status: "error" });
        }
      }
    },
    [
      selectedClientId,
      contextPolicyId,
      clientPolicies,
      updateDoc,
      showFileWarning,
    ],
  );

  // --- ręczny obrót o 90° (re-render z oryginału, spójnie z korekcją EXIF) ---
  const handleRotate = useCallback(
    async (id: string) => {
      const doc = docsRef.current.find((d) => d.id === id);
      if (!doc || !doc.originalFile) return;
      const nextRot = ((doc.rotation ?? 0) + 90) % 360;
      updateDoc(id, { status: "processing" });
      try {
        const p = await processImageFile(doc.originalFile, {
          maxEdge: 1800,
          quality: 0.85,
          extraRotation: nextRot,
        });
        if (doc.displayUrl) URL.revokeObjectURL(doc.displayUrl);
        updateDoc(id, {
          status: "ready",
          rotation: nextRot,
          displayUrl: p.url,
          width: p.width,
          height: p.height,
          sizeBytes: p.sizeBytes,
        });
      } catch (e) {
        console.error("[DocumentCenter] rotate failed:", e);
        updateDoc(id, { status: "error" });
      }
    },
    [updateDoc],
  );

  const handleRemove = useCallback((id: string) => {
    setDocs((prev) => {
      const doc = prev.find((d) => d.id === id);
      if (doc?.displayUrl) URL.revokeObjectURL(doc.displayUrl);
      if (doc?.pdfUrl) URL.revokeObjectURL(doc.pdfUrl);
      return prev.filter((d) => d.id !== id);
    });
    setPreview((cur) => (cur?.id === id ? null : cur));
  }, []);

  const selectClient = (id: string) => {
    setSelectedClientId(id);
    setContextPolicyId(null);
    setQuery("");
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto text-zinc-900 dark:text-zinc-100">
      {/* Toast ostrzegawczy — plik odrzucony (limit rozmiaru / niedozwolony typ) */}
      {fileWarning && (
        <div className="fixed top-4 left-0 right-0 z-[550] flex justify-center px-4 animate-in slide-in-from-top-4 fade-in duration-300 pointer-events-none">
          <div className="flex items-center gap-2 max-w-md rounded-full bg-amber-600 text-white px-4 py-2 shadow-xl text-xs font-bold pointer-events-auto">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{fileWarning}</span>
          </div>
        </div>
      )}

      {/* Nagłówek */}
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              Centrum Dokumentów
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              wszystko o kliencie w jednym miejscu
            </p>
          </div>
        </div>
      </header>

      {/* Wybór klienta */}
      {!selectedClient ? (
        <section>
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj klienta po nazwisku lub PESEL/NIP…"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none focus:border-primary text-sm"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredClients.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectClient(c.id)}
                className="flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <span className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <User className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold truncate">
                    {c.lastName} {c.firstName}
                  </span>
                  <span className="block text-[11px] text-zinc-400 truncate">
                    {c.pesel || c.city || "—"}
                  </span>
                </span>
              </button>
            ))}
            {clients.length === 0 && (
              <p className="text-sm text-zinc-400 col-span-full py-8 text-center">
                Brak klientów do wyświetlenia.
              </p>
            )}
            {clients.length > 0 && filteredClients.length === 0 && (
              <p className="text-sm text-zinc-400 col-span-full py-8 text-center">
                Brak wyników dla „{query}”.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-6">
          {/* Belka wybranego klienta */}
          <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <User className="w-5 h-5" />
              </span>
              <div>
                <p className="text-sm font-black">
                  {selectedClient.lastName} {selectedClient.firstName}
                </p>
                <p className="text-[11px] text-zinc-400">
                  {selectedClient.pesel || selectedClient.city || "—"} ·{" "}
                  {clientDocs.length} dok.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedClientId(null);
                setContextPolicyId(null);
              }}
              className="flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Zmień klienta
            </button>
          </div>

          {/* Kontekst: pojazd / dom / polisa */}
          {clientPolicies.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> Przypnij do (opcjonalnie)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setContextPolicyId(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    contextPolicyId === null
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-primary"
                  }`}
                >
                  Bez kontekstu
                </button>
                {clientPolicies.map((p) => {
                  const isAuto = !["DOM", "FIRMA"].includes(p.type);
                  const active = contextPolicyId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setContextPolicyId(p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-primary"
                      }`}
                    >
                      {isAuto ? (
                        <Car className="w-3.5 h-3.5" />
                      ) : (
                        <Home className="w-3.5 h-3.5" />
                      )}
                      <span className="max-w-[180px] truncate">
                        {policyLabel(p)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strefa drop */}
          <DropZone onFiles={handleFiles} />

          {/* Zdjęcia */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Zdjęcia ({images.length})
            </p>
            {images.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                Brak zdjęć — wrzuć pliki powyżej.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((doc) => (
                  <ImageThumb
                    key={doc.id}
                    doc={doc}
                    onRotate={handleRotate}
                    onRemove={handleRemove}
                    onOpen={setPreview}
                  />
                ))}
              </div>
            )}
          </div>

          {/* PDFy */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Dokumenty PDF ({pdfs.length})
            </p>
            {pdfs.length === 0 ? (
              <p className="text-sm text-zinc-400 py-6 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                Brak plików PDF (polisy, załączniki).
              </p>
            ) : (
              <div className="space-y-2">
                {pdfs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50"
                  >
                    <span className="w-10 h-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-semibold truncate"
                        title={doc.name}
                      >
                        {doc.name}
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {formatBytes(doc.sizeBytes ?? 0)}
                        {doc.contextLabel ? ` · ${doc.contextLabel}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreview(doc)}
                      title="Podgląd"
                      className="p-2 rounded-lg text-zinc-500 hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(doc.id)}
                      title="Usuń"
                      className="p-2 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lightbox / podgląd */}
      {preview && (
        <div
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-w-5xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-white text-sm font-bold truncate">
                {preview.name}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={
                    preview.kind === "pdf" ? preview.pdfUrl : preview.displayUrl
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Otwórz w nowej karcie
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="p-2 rounded-lg text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {preview.kind === "pdf" ? (
              // sandbox="allow-same-origin" (BEZ allow-scripts): blokuje
              // wykonanie JS/skryptów osadzonych w PDF. Samo `sandbox=""`
              // (opaque origin) uniemożliwiłoby wczytanie blob: URL — blob
              // jest związany z origin strony, a sandboxowany iframe bez
              // allow-same-origin dostaje origin "null" i traci do niego
              // dostęp. allow-same-origin bez allow-scripts NIE jest
              // niebezpieczną kombinacją (niebezpieczna jest dopiero z
              // allow-scripts razem — tego tu nie ma).
              <iframe
                title={preview.name}
                src={preview.pdfUrl}
                sandbox="allow-same-origin"
                className="w-full h-[80vh] rounded-xl bg-white"
              />
            ) : (
              <img
                src={preview.displayUrl}
                alt={preview.name}
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
