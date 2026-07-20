-- ── revisiones — campo origen para distinguir fuente de cada entrada ──────────
-- 'causa' = ingresado directamente en la causa (default)
-- 'agenda' = creado desde la Agenda Diaria
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS origen text DEFAULT 'causa';
