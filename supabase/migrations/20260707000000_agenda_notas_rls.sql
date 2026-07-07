-- ── RLS policy for agenda_notas ──────────────────────────────────────────────
-- Run in Supabase → SQL Editor if INSERT/UPDATE/DELETE from anon are blocked.
ALTER TABLE agenda_notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon agenda_notas" ON agenda_notas;
CREATE POLICY "Acceso total anon agenda_notas"
  ON agenda_notas FOR ALL TO anon
  USING (true) WITH CHECK (true);
