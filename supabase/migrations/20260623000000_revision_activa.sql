CREATE TABLE IF NOT EXISTS revision_activa (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  causas_revisadas jsonb       NOT NULL DEFAULT '[]',
  total_revisadas  int         NOT NULL DEFAULT 0,
  fecha_inicio     timestamptz NOT NULL DEFAULT now(),
  activa           boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);
