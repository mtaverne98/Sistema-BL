CREATE TABLE IF NOT EXISTS revision_periodos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date        NOT NULL,
  activa       boolean     DEFAULT true,
  created_at   timestamptz DEFAULT now()
);
