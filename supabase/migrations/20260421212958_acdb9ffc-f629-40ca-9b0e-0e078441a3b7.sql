DROP POLICY IF EXISTS "Realtime subscribe own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Realtime publish own topics" ON realtime.messages;

-- SELECT: postgres_changes (prefixo realtime:) já é filtrado pelas RLS das tabelas.
-- Broadcast/presence (qualquer outro tópico) exige uid no nome.
CREATE POLICY "Realtime subscribe scoped"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    realtime.topic() LIKE 'realtime:%'
    OR realtime.topic() LIKE '%' || auth.uid()::text || '%'
  )
);

-- INSERT (publish via broadcast/presence): exige uid no tópico
CREATE POLICY "Realtime publish scoped"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
);