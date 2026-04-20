/**
 * feedbackCapture.ts — przechwytywanie elementów UI i wysyłanie feedbacku do Supabase.
 */

import html2canvas from 'html2canvas';
import { getSupabaseClient } from '../../components/atomic-crm/providers/supabase/supabase';

// ─── Typy publiczne ────────────────────────────────────────────────────────────

export interface CapturedElement {
  /** CSS path elementu, np. 'div.sidebar > button:nth-child(3)' */
  selector: string;
  /** Krótki opis: tag + text content (max 60 znaków) */
  label: string;
  /** data:image/jpeg;base64,... albo null jeśli capture nie zadziałał */
  screenshotB64: string | null;
  viewport: { w: number; h: number };
}

export interface FeedbackPayload {
  message: string;
  severity: 'info' | 'bug' | 'idea' | 'blocker';
  captured?: CapturedElement | null;
}

// ─── Helpers wewnętrzne ────────────────────────────────────────────────────────

/** Generuje CSS path elementu (max 6 segmentów, od rodzica). */
function buildCssPath(el: Element): string {
  const segments: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && segments.length < 6) {
    const tag = current.tagName.toLowerCase();
    const id = current.id ? `#${current.id}` : '';
    const firstClass = current.classList.length > 0 ? `.${current.classList[0]}` : '';

    let nthPart = '';
    if (!id) {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (c) => c.tagName === current!.tagName,
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          nthPart = `:nth-child(${idx})`;
        }
      }
    }

    segments.unshift(`${tag}${id}${firstClass}${nthPart}`);
    if (id) break; // id jest unikalny — wystarczy
    current = current.parentElement;
  }

  return segments.join(' > ');
}

/** Buduje czytelny label elementu (max 60 znaków). */
function buildLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const firstClass = el.classList.length > 0 ? `.${el.classList[0]}` : '';
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const raw = `${tag}${id}${firstClass}${text ? ` — ${text}` : ''}`;
  return raw.slice(0, 60);
}

/** Robi screenshot elementu przez html2canvas, skaluje jeśli trzeba. */
async function captureScreenshot(el: HTMLElement): Promise<string | null> {
  try {
    const canvas = await html2canvas(el, {
      scale: 0.75,
      backgroundColor: null,
      logging: false,
    });

    if (canvas.width <= 600) {
      return canvas.toDataURL('image/jpeg', 0.5);
    }

    // Przeskaluj do max 600 px szerokości
    const ratio = 600 / canvas.width;
    const scaled = document.createElement('canvas');
    scaled.width = 600;
    scaled.height = Math.round(canvas.height * ratio);
    const ctx = scaled.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/jpeg', 0.5);
    ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    return scaled.toDataURL('image/jpeg', 0.5);
  } catch {
    return null;
  }
}

// ─── Stałe stylu highlight ─────────────────────────────────────────────────────

const HIGHLIGHT_OUTLINE = '2px solid #ef4444';
const HIGHLIGHT_BG = '#ef444420';
const HIGHLIGHT_OUTLINE_KEY = '__fb_outline__';
const HIGHLIGHT_BG_KEY = '__fb_bg__';

type AugmentedHTMLElement = HTMLElement & {
  [HIGHLIGHT_OUTLINE_KEY]?: string;
  [HIGHLIGHT_BG_KEY]?: string;
};

function applyHighlight(el: AugmentedHTMLElement) {
  el[HIGHLIGHT_OUTLINE_KEY] = el.style.outline;
  el[HIGHLIGHT_BG_KEY] = el.style.backgroundColor;
  el.style.outline = HIGHLIGHT_OUTLINE;
  el.style.backgroundColor = HIGHLIGHT_BG;
}

function removeHighlight(el: AugmentedHTMLElement) {
  el.style.outline = el[HIGHLIGHT_OUTLINE_KEY] ?? '';
  el.style.backgroundColor = el[HIGHLIGHT_BG_KEY] ?? '';
  delete el[HIGHLIGHT_OUTLINE_KEY];
  delete el[HIGHLIGHT_BG_KEY];
}

// ─── API publiczne ─────────────────────────────────────────────────────────────

/**
 * Startuje tryb "pick element": cursor crosshair, hover highlight, Escape anuluje.
 * Zwraca Promise<CapturedElement | null> — null gdy użytkownik wcisnął Escape.
 */
export async function pickElement(): Promise<CapturedElement | null> {
  return new Promise<CapturedElement | null>((resolve) => {
    // Overlay blokujący tylko wizualnie (pointer-events: none)
    const overlay = document.createElement('div');
    overlay.setAttribute('data-feedback-ui', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
      cursor: 'crosshair',
    });
    document.body.appendChild(overlay);

    // Cursor crosshair na body
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    let lastHovered: AugmentedHTMLElement | null = null;

    function cleanup() {
      document.body.style.cursor = prevCursor;
      if (lastHovered) {
        removeHighlight(lastHovered);
        lastHovered = null;
      }
      overlay.remove();
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    function onMouseOver(e: MouseEvent) {
      const target = e.target as AugmentedHTMLElement;
      if (!target || target === overlay) return;
      if (target.getAttribute('data-feedback-ui') === 'true') return;
      if (lastHovered && lastHovered !== target) {
        removeHighlight(lastHovered);
      }
      lastHovered = target;
      applyHighlight(target);
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as AugmentedHTMLElement;
      if (!target || target === overlay) return;
      removeHighlight(target);
      if (lastHovered === target) lastHovered = null;
    }

    async function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.getAttribute('data-feedback-ui') === 'true') return;

      e.stopPropagation();
      e.preventDefault();

      cleanup();

      const selector = buildCssPath(target);
      const label = buildLabel(target);
      const screenshotB64 = await captureScreenshot(target);
      const viewport = { w: window.innerWidth, h: window.innerHeight };

      resolve({ selector, label, screenshotB64, viewport });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    }

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('mouseout', onMouseOut, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  });
}

/**
 * Wysyła obiekt feedbacku do tabeli insurance_feedback w Supabase.
 * Rzuca błąd po polsku jeśli insert się nie powiedzie.
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const sb = getSupabaseClient();
  const { data: sessionData } = await sb.auth.getSession();
  const user = sessionData?.session?.user ?? null;

  const tenantId =
    (import.meta.env.VITE_SUPABASE_TENANT_ID as string | undefined) ??
    '11111111-1111-1111-1111-111111111111';

  const captured = payload.captured ?? null;
  const ctx: any = (window as any).__CRM_CONTEXT__ ?? {};

  const { error } = await sb.from('insurance_feedback').insert({
    tenant_id: tenantId,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    route: window.location.pathname + window.location.search,
    page_key: ctx.page ?? null,
    page_label: ctx.pageLabel ?? null,
    page_context: Object.keys(ctx).length ? ctx : null,
    element_selector: captured?.selector ?? null,
    element_label: captured?.label ?? null,
    message: payload.message,
    severity: payload.severity,
    screenshot_b64: captured?.screenshotB64 ?? null,
    viewport_w: captured?.viewport.w ?? window.innerWidth,
    viewport_h: captured?.viewport.h ?? window.innerHeight,
    user_agent: navigator.userAgent,
  });

  if (error) {
    throw new Error(
      `Nie udało się zapisać feedbacku w bazie danych: ${error.message} (kod: ${error.code})`,
    );
  }
}
