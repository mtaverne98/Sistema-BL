-- ── agenda_notas — agregar columnas para rediseño de Agenda Diaria ────────────
-- Ejecutar en: Supabase → SQL Editor
ALTER TABLE agenda_notas ADD COLUMN IF NOT EXISTS hora           text;
ALTER TABLE agenda_notas ADD COLUMN IF NOT EXISTS cliente_nombre text;
ALTER TABLE agenda_notas ADD COLUMN IF NOT EXISTS causa_rit      text;
ALTER TABLE agenda_notas ADD COLUMN IF NOT EXISTS tag            text;
