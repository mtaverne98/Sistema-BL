ALTER TABLE agenda_pendientes
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES agenda_pendientes(id) ON DELETE CASCADE;
