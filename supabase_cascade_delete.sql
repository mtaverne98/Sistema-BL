-- ═══════════════════════════════════════════════════════════════════════════════
-- SISTEMA BL — Eliminación en cascada
-- Pegar en: Supabase Dashboard → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════════════════════
-- Resultado: al eliminar un CLIENTE se borran automáticamente sus causas,
-- audiencias, tareas, plazos y documentos.
-- Al eliminar una CAUSA se borran sus audiencias, tareas, plazos y documentos.
-- (siau, pjud y revisiones se borran desde el código, ya que usan texto, no FK)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. causas → clientes (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE causas
  DROP CONSTRAINT IF EXISTS causas_cliente_id_fkey;

ALTER TABLE causas
  ADD CONSTRAINT causas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. audiencias → clientes  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE audiencias
  DROP CONSTRAINT IF EXISTS audiencias_cliente_id_fkey;

ALTER TABLE audiencias
  ADD CONSTRAINT audiencias_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. audiencias → causas  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE audiencias
  DROP CONSTRAINT IF EXISTS audiencias_causa_id_fkey;

ALTER TABLE audiencias
  ADD CONSTRAINT audiencias_causa_id_fkey
  FOREIGN KEY (causa_id) REFERENCES causas(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. tareas → clientes  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tareas
  DROP CONSTRAINT IF EXISTS tareas_cliente_id_fkey;

ALTER TABLE tareas
  ADD CONSTRAINT tareas_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. tareas → causas  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tareas
  DROP CONSTRAINT IF EXISTS tareas_causa_id_fkey;

ALTER TABLE tareas
  ADD CONSTRAINT tareas_causa_id_fkey
  FOREIGN KEY (causa_id) REFERENCES causas(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. plazos → clientes  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE plazos
  DROP CONSTRAINT IF EXISTS plazos_cliente_id_fkey;

ALTER TABLE plazos
  ADD CONSTRAINT plazos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. plazos → causas  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE plazos
  DROP CONSTRAINT IF EXISTS plazos_causa_id_fkey;

ALTER TABLE plazos
  ADD CONSTRAINT plazos_causa_id_fkey
  FOREIGN KEY (causa_id) REFERENCES causas(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. documentos → clientes  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_cliente_id_fkey;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_cliente_id_fkey
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. documentos → causas  (ON DELETE CASCADE)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE documentos
  DROP CONSTRAINT IF EXISTS documentos_causa_id_fkey;

ALTER TABLE documentos
  ADD CONSTRAINT documentos_causa_id_fkey
  FOREIGN KEY (causa_id) REFERENCES causas(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. revisiones → causas  (ON DELETE CASCADE)
--     Nota: revisiones usa causa_id (FK), así que puede cascadear también
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE revisiones
  DROP CONSTRAINT IF EXISTS revisiones_causa_id_fkey;

ALTER TABLE revisiones
  ADD CONSTRAINT revisiones_causa_id_fkey
  FOREIGN KEY (causa_id) REFERENCES causas(id)
  ON DELETE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación — muestra los constraints creados
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name IN ('causas','audiencias','tareas','plazos','documentos','revisiones')
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;
