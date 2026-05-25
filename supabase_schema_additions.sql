-- ============================================================
-- Migración: Agregar columnas faltantes a las tablas
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── CAUSAS ────────────────────────────────────────────────────────────────────
ALTER TABLE causas ADD COLUMN IF NOT EXISTS etapa_procesal text;

-- ── DOCUMENTOS ───────────────────────────────────────────────────────────────
-- La tabla documentos existe con estructura mínima; aquí se agregan todos los
-- campos necesarios para el editor de documentos del sistema.
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tipo               text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS estado             text DEFAULT 'borrador';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS responsable        text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS favorito           boolean DEFAULT false;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS contenido          text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS etiquetas          jsonb DEFAULT '[]'::jsonb;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS versiones          jsonb DEFAULT '[]'::jsonb;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS comentarios        jsonb DEFAULT '[]'::jsonb;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS relaciones         jsonb DEFAULT '{"reunion_ids":[],"tarea_ids":[],"audiencia_ids":[]}'::jsonb;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_creacion     date  DEFAULT CURRENT_DATE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_modificacion date  DEFAULT CURRENT_DATE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS causa_ruc          text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tribunal           text;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS cliente            text;  -- alias de cliente_nombre

-- ── PROSPECTOS ────────────────────────────────────────────────────────────────
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS presupuesto_enviado boolean DEFAULT false;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS descripcion         text;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS antecedentes        text;
ALTER TABLE prospectos ADD COLUMN IF NOT EXISTS interacciones       jsonb DEFAULT '[]'::jsonb;

-- ── REVISIONES ────────────────────────────────────────────────────────────────
-- Esta tabla necesita las columnas core del módulo "Revisión de Causas"
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS semana_key     text;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS revisada       boolean DEFAULT false;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS nota           text;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS proxima_accion text;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS responsable    text;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS fecha          date;

-- Índice para el upsert que usa onConflict: 'semana_key,causa_id'
CREATE UNIQUE INDEX IF NOT EXISTS revisiones_semana_causa_idx
  ON revisiones (semana_key, causa_id);

-- RLS (por si no está habilitado en las tablas nuevas)
ALTER TABLE revisiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon" ON revisiones;
CREATE POLICY "Acceso total anon" ON revisiones FOR ALL TO anon USING (true) WITH CHECK (true);
