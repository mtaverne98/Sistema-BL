create table agenda_pendientes (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  causa_id uuid references causas(id),
  resuelto boolean default false,
  created_at timestamptz default now(),
  resuelto_at timestamptz
);

ALTER TABLE agenda_pendientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total anon agenda_pendientes" ON agenda_pendientes;
CREATE POLICY "Acceso total anon agenda_pendientes"
  ON agenda_pendientes FOR ALL TO anon
  USING (true) WITH CHECK (true);
