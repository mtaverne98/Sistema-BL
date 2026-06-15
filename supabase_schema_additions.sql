-- ============================================================
-- Migración: Agregar columnas faltantes a las tablas
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── CAUSAS ────────────────────────────────────────────────────────────────────
ALTER TABLE causas ADD COLUMN IF NOT EXISTS etapa_procesal text;
ALTER TABLE causas ADD COLUMN IF NOT EXISTS responsable    text;
ALTER TABLE causas ADD COLUMN IF NOT EXISTS prioridad      text DEFAULT 'Media';

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
-- Solo en filas con semana_key no nulo (seguimiento diario puede tener múltiples
-- filas null por causa_id y eso es válido)
CREATE UNIQUE INDEX IF NOT EXISTS revisiones_semana_causa_idx
  ON revisiones (semana_key, causa_id)
  WHERE semana_key IS NOT NULL;

-- RLS (por si no está habilitado en las tablas nuevas)
ALTER TABLE revisiones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon" ON revisiones;
CREATE POLICY "Acceso total anon" ON revisiones FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── SEGUIMIENTO SEMANAL — checkbox revisado ───────────────────────────────────
-- Campo para marcar entradas individuales como revisadas en la tabla de seguimiento
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS revisado boolean DEFAULT false;

-- ── REVISADO ESTA SEMANA — dropdown SI/NO por causa ──────────────────────────
-- revisado_semana: 'SI' | 'NO' | NULL — se guarda en registros con semana_key = 'W-YYYY-MM-DD'
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS revisado_semana text;

-- ── TAREAS — columnas extendidas ──────────────────────────────────────────
-- Requeridas por los formularios de nueva tarea en Revisión de Causas,
-- CausaView (PJUD/SIAU) y el módulo Tareas.
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS responsable        text;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS causa_rit          text;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS causa_ruc          text;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS causa_id           uuid REFERENCES causas(id);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS prioridad          text DEFAULT 'Media';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_vencimiento  date;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS categoria          text;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS notas              text;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS cliente_nombre     text;

-- ── ESTADOS DE CAUSA — NORMALIZACIÓN ─────────────────────────────────────────
-- Estados válidos: Abierta | Revisar | Suspendida | Cerrada
-- Ejecutar para migrar valores legacy:
UPDATE causas SET estado = 'Abierta'
  WHERE estado IN ('En tramitación', 'Administrativa')
    AND estado NOT IN ('Abierta', 'Revisar', 'Suspendida', 'Cerrada');

UPDATE causas SET estado = 'Cerrada'
  WHERE estado IN ('Terminada', 'Archivada')
    AND estado NOT IN ('Abierta', 'Revisar', 'Suspendida', 'Cerrada');

-- Verificar resultado:
-- SELECT estado, count(*) FROM causas GROUP BY estado ORDER BY estado;
