ALTER TABLE causa_alertas         ADD COLUMN revisado boolean NOT NULL DEFAULT true;
ALTER TABLE causa_faltantes       ADD COLUMN revisado boolean NOT NULL DEFAULT true;
ALTER TABLE causa_recomendaciones ADD COLUMN revisado boolean NOT NULL DEFAULT true;
ALTER TABLE causa_contradicciones ADD COLUMN revisado boolean NOT NULL DEFAULT true;
