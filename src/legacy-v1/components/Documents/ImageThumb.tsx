import React from "react";
import {
  RotateCw,
  Trash2,
  AlertTriangle,
  Loader2,
  Maximize2,
} from "lucide-react";
import { ClientDocument } from "./types";
import { formatBytes } from "./imageProcessing";

interface Props {
  doc: ClientDocument;
  onRotate: (id: string) => void;
  onRemove: (id: string) => void;
  onOpen: (doc: ClientDocument) => void;
}

export const ImageThumb: React.FC<Props> = ({
  doc,
  onRotate,
  onRemove,
  onOpen,
}) => {
  const busy = doc.status === "processing";
  const ready = doc.status === "ready";

  return (
    <div className="group relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm">
      {/* obraz / stan */}
      <div
        className={`relative aspect-square bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center ${
          ready ? "cursor-zoom-in" : ""
        }`}
        onClick={() => ready && onOpen(doc)}
      >
        {doc.status === "error" ? (
          <div className="flex flex-col items-center gap-2 text-red-500 px-2 text-center">
            <AlertTriangle className="w-7 h-7" />
            <span className="text-[10px] font-bold uppercase">
              Błąd obróbki
            </span>
          </div>
        ) : doc.displayUrl ? (
          <img
            src={doc.displayUrl}
            alt={doc.name}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[1px]">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {ready && (
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-950/60 text-white">
              <Maximize2 className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>

      {/* pasek narzędzi */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-1 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => onRotate(doc.id)}
          disabled={busy || doc.status === "error"}
          title="Obróć o 90°"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-primary hover:bg-primary/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(doc.id)}
          title="Usuń dokument"
          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* metadane */}
      <div className="px-2 pb-2 -mt-0.5">
        <p
          className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate"
          title={doc.name}
        >
          {doc.name}
        </p>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {ready && doc.width && doc.height
            ? `${doc.width}×${doc.height} · ${formatBytes(doc.sizeBytes ?? 0)}`
            : busy
              ? "Przetwarzanie…"
              : formatBytes(doc.sizeBytes ?? 0)}
        </p>
        {doc.contextLabel && (
          <p className="mt-1 inline-block max-w-full truncate rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5">
            {doc.contextLabel}
          </p>
        )}
      </div>
    </div>
  );
};
