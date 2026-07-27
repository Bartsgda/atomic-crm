-- 2026-07-27 — Trwałość korekty prowizji + statusów 'sprzedany'/'pierwszy_kontakt' (CRM-Alina).
-- Wgrane najpierw ręcznie przez SQL Editor konta redroadai (produkcja public); ten plik
-- odzwierciedla to w repo. Powiązane: task 94fb705e, formularz wypowiedzenia + sprzedaż auta.
-- UWAGA: objęto TYLKO schemat public. Tryb testowy (test.policies) NIE zmigrowany — jeśli
-- Alina będzie ustawiać 'sprzedany' w sandboxie, uruchomić analogicznie na schemacie test.

-- 1. Kolumny: korekta prowizji po sprzedaży auta + data sprzedaży
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS commission_correction numeric;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS sale_date date;

-- 2. Rozszerz dozwolone statusy (stage) o 'sprzedany' i 'pierwszy_kontakt'
--    (usuń istniejący CHECK na stage, dodaj nowy z pełną listą — obejmuje wszystko,
--     co aplikacja może zapisać przez STAGE_TO_DB w supabaseStorage.ts)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.policies'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%stage%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.policies DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_stage_check CHECK (stage IN (
    'sprzedaz', 'of_do_zrobienia', 'przel_kontakt', 'czekam_na_dane',
    'oferta_wyslana', 'uciety_kontakt', 'rez_po_ofercie',
    'sprzedany', 'pierwszy_kontakt'
  ));
