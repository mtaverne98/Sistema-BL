-- ============================================================
-- Crear tablas faltantes: gastos y reuniones
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ── GASTOS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gastos (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha        date NOT NULL DEFAULT CURRENT_DATE,
  categoria    text NOT NULL DEFAULT 'Otros',
  notas        text,
  monto        numeric(12,0) NOT NULL DEFAULT 0,
  estado       text NOT NULL DEFAULT 'pendiente',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon gastos" ON gastos;
CREATE POLICY "Acceso total anon gastos" ON gastos FOR ALL TO anon USING (true) WITH CHECK (true);

-- ── REUNIONES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reuniones (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha             date,
  hora_inicio       text,
  hora_fin          text,
  estado            text DEFAULT 'Programada',
  tipo              text DEFAULT 'Reunión semanal',
  participantes     jsonb DEFAULT '["MT","AB","CL"]'::jsonb,
  bandeja           jsonb DEFAULT '[]'::jsonb,
  causas_discutidas jsonb DEFAULT '[]'::jsonb,
  decisiones        jsonb DEFAULT '[]'::jsonb,
  tareas_ids        jsonb DEFAULT '[]'::jsonb,
  proxima_accion    text,
  proxima_reunion   date,
  minuta            text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE reuniones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon reuniones" ON reuniones;
CREATE POLICY "Acceso total anon reuniones" ON reuniones FOR ALL TO anon USING (true) WITH CHECK (true);
