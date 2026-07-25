/**
 * imageProcessing.ts — client-side resize + EXIF-orientation fix dla zdjęć z telefonu.
 *
 * Podejście natywne (Canvas + createImageBitmap), zero zewnętrznych zależności.
 * - dłuższy bok skalowany do maxEdge (domyślnie 1800 px), nigdy nie powiększamy,
 * - orientacja EXIF naprawiana automatycznie (telefony często zapisują obrócone),
 * - opcjonalny ręczny obrót o 90/180/270°,
 * - eksport do JPEG (domyślnie quality 0.85 → mała waga, dobra jakość).
 *
 * Best practice 2026 (WebSearch): createImageBitmap(file, { imageOrientation: 'from-image' })
 * honoruje EXIF; fallback przez <img> (nowoczesne przeglądarki mają domyślnie
 * image-orientation: from-image, więc drawImage też uwzględnia orientację).
 */

export interface ProcessedImage {
  blob: Blob;
  /** object URL przetworzonego JPEG — WYWOŁUJĄCY musi zrobić URL.revokeObjectURL przy odrzuceniu */
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface ProcessOptions {
  /** limit dłuższego boku w px (domyślnie 1800) */
  maxEdge?: number;
  /** jakość JPEG 0..1 (domyślnie 0.85) */
  quality?: number;
  /** ręczny obrót w stopniach (0 | 90 | 180 | 270) — nakładany na korekcję EXIF */
  extraRotation?: number;
}

const DEFAULT_MAX_EDGE = 1800;
const DEFAULT_QUALITY = 0.85;

interface DecodedSource {
  source: CanvasImageSource;
  w: number;
  h: number;
  close: () => void;
}

/** Dekoduje plik do bitmapy z JUŻ naprawioną orientacją EXIF. */
async function decodeOriented(file: File): Promise<DecodedSource> {
  // Ścieżka preferowana: createImageBitmap z imageOrientation 'from-image' stosuje EXIF.
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        source: bmp,
        w: bmp.width,
        h: bmp.height,
        close: () => bmp.close(),
      };
    } catch {
      // przechodzimy do fallbacku <img>
    }
  }

  // Fallback: HTMLImageElement. Nowoczesne przeglądarki domyślnie stosują
  // image-orientation: from-image, więc rysowanie na canvas honoruje EXIF.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Nie udało się wczytać obrazu"));
      el.src = url;
    });
    return {
      source: img,
      w: img.naturalWidth,
      h: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Zmniejsza + (opcjonalnie) obraca zdjęcie, zwraca JPEG jako blob + object URL. */
export async function processImageFile(
  file: File,
  opts: ProcessOptions = {},
): Promise<ProcessedImage> {
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = opts.quality ?? DEFAULT_QUALITY;
  const rot = (((opts.extraRotation ?? 0) % 360) + 360) % 360;

  const decoded = await decodeOriented(file);
  try {
    const { source, w: srcW, h: srcH } = decoded;

    // skaluj tak, aby dłuższy bok <= maxEdge (nigdy nie powiększaj)
    const longer = Math.max(srcW, srcH);
    const scale = longer > maxEdge ? maxEdge / longer : 1;
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));

    const swap = rot === 90 || rot === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? drawH : drawW;
    canvas.height = swap ? drawW : drawH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Brak kontekstu canvas 2D");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("Konwersja do JPEG nie powiodła się")),
        "image/jpeg",
        quality,
      );
    });

    return {
      blob,
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      sizeBytes: blob.size,
    };
  } finally {
    decoded.close();
  }
}

/** Czytelny rozmiar pliku (B / KB / MB). */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
