ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS siau_revisado     boolean DEFAULT false;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS pjud_revisado     boolean DEFAULT false;
ALTER TABLE revisiones ADD COLUMN IF NOT EXISTS es_revision_semanal boolean DEFAULT false;
