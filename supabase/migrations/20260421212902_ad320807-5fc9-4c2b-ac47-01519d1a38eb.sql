-- =========================================================
-- 1. REALTIME: restringir a tópicos do próprio uid
-- =========================================================
DROP POLICY IF EXISTS "Realtime subscribe own topics" ON realtime.messages;

CREATE POLICY "Realtime subscribe own topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

-- =========================================================
-- 2. DRIVER LOCATIONS: remover acesso via favoritos
-- =========================================================
DROP POLICY IF EXISTS "Passengers view favorited driver location" ON public.driver_locations;