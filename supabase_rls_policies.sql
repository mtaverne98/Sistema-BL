-- ============================================================
-- Políticas RLS para Sistema Bianchi Leiva
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================
-- Este sistema es interno (sin login de usuarios), por lo que
-- habilitamos acceso completo para la clave anon en todas las tablas.

-- CLIENTES
CREATE POLICY "Acceso total anon" ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);

-- CAUSAS
CREATE POLICY "Acceso total anon" ON causas FOR ALL TO anon USING (true) WITH CHECK (true);

-- AUDIENCIAS
CREATE POLICY "Acceso total anon" ON audiencias FOR ALL TO anon USING (true) WITH CHECK (true);

-- TAREAS
CREATE POLICY "Acceso total anon" ON tareas FOR ALL TO anon USING (true) WITH CHECK (true);

-- PLAZOS
CREATE POLICY "Acceso total anon" ON plazos FOR ALL TO anon USING (true) WITH CHECK (true);

-- SIAU
CREATE POLICY "Acceso total anon" ON siau FOR ALL TO anon USING (true) WITH CHECK (true);

-- PJUD
CREATE POLICY "Acceso total anon" ON pjud FOR ALL TO anon USING (true) WITH CHECK (true);

-- DOCUMENTOS
CREATE POLICY "Acceso total anon" ON documentos FOR ALL TO anon USING (true) WITH CHECK (true);

-- REVISIONES
CREATE POLICY "Acceso total anon" ON revisiones FOR ALL TO anon USING (true) WITH CHECK (true);

-- PROSPECTOS
CREATE POLICY "Acceso total anon" ON prospectos FOR ALL TO anon USING (true) WITH CHECK (true);
