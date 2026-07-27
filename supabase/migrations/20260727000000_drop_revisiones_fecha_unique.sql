-- Eliminar restricción única de causa+fecha en revisiones
-- Permite agregar múltiples seguimientos en el mismo día para una causa
ALTER TABLE revisiones DROP CONSTRAINT IF EXISTS revisiones_causa_fecha_unique;
