import React, { useCallback, useRef, useState } from "react";
import { UploadCloud, ImagePlus, FileText } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

// jpg/png/webp dla zdjęć + pdf (polisy, załączniki)
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export const DropZone: React.FC<Props> = ({ onFiles, disabled = false }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const emit = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      emit(e.dataTransfer.files);
    },
    [disabled, emit],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={[
        "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
        disabled
          ? "opacity-50 pointer-events-none border-zinc-300 dark:border-zinc-800"
          : "cursor-pointer",
        dragging
          ? "border-primary bg-primary/10 scale-[1.01]"
          : "border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 hover:border-primary hover:bg-primary/5",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex items-center gap-2 text-primary">
        <UploadCloud className="w-8 h-8" />
      </div>
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-zinc-700 dark:text-zinc-200">
          Przeciągnij i upuść pliki
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-1">
          lub kliknij, aby wybrać z dysku / telefonu
        </p>
      </div>
      <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        <span className="flex items-center gap-1">
          <ImagePlus className="w-3.5 h-3.5" /> JPG · PNG
        </span>
        <span className="flex items-center gap-1">
          <FileText className="w-3.5 h-3.5" /> PDF
        </span>
      </div>
      <p className="text-[10px] text-zinc-400 dark:text-zinc-600">
        Zdjęcia są automatycznie zmniejszane i prostowane (EXIF) w przeglądarce.
      </p>
    </div>
  );
};
