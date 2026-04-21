-- =========================================================
-- 1. REALTIME: restringir tópicos ao usuário autenticado
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can subscribe realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;

-- SELECT (subscribe): permite somente se o tópico contém o uid do usuário,
-- ou se é um tópico de tabela pública (postgres_changes filtra por RLS).
CREATE POLICY "Realtime subscribe own topics"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    -- tópicos de postgres_changes (começam com "realtime:")
    realtime.topic() LIKE 'realtime:%'
    -- ou tópicos broadcast/presence que incluem o uid do próprio usuário
    OR realtime.topic() LIKE '%' || auth.uid()::text || '%'
  )
);

CREATE POLICY "Realtime publish own topics"
ON realtime.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND realtime.topic() LIKE '%' || auth.uid()::text || '%'
);

-- =========================================================
-- 2. STORAGE: restringir uploads anônimos do signup
-- =========================================================
DROP POLICY IF EXISTS "Signup uploads to driver-documents" ON storage.objects;
DROP POLICY IF EXISTS "Signup uploads to selfies" ON storage.objects;

-- Apenas anônimos podem fazer upload em prefixo signup/ com extensão segura
CREATE POLICY "Anon signup uploads driver-documents"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'driver-documents'
  AND name LIKE 'signup/%'
  AND name !~ '\.\.'  -- bloqueia path traversal
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|pdf)$'
  AND length(name) < 300
);

CREATE POLICY "Anon signup uploads selfies"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'selfies'
  AND name LIKE 'signup/%'
  AND name !~ '\.\.'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp)$'
  AND length(name) < 300
);

-- Autenticados podem fazer upload normalmente nas suas pastas (mantém políticas existentes para auth)
CREATE POLICY "Auth users upload driver-documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (
    name LIKE 'signup/%'
    OR name LIKE (auth.uid()::text || '/%')
  )
  AND name !~ '\.\.'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp|pdf)$'
);

CREATE POLICY "Auth users upload selfies"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'selfies'
  AND (
    name LIKE 'signup/%'
    OR name LIKE (auth.uid()::text || '/%')
  )
  AND name !~ '\.\.'
  AND lower(name) ~ '\.(jpg|jpeg|png|webp)$'
);

-- =========================================================
-- 3. CUPONS: remover leitura pública + RPC de validação
-- =========================================================
DROP POLICY IF EXISTS "Authenticated can view active coupons" ON public.coupons;

-- Função para validar cupom de forma segura (retorna só o essencial)
CREATE OR REPLACE FUNCTION public.passenger_validate_coupon(
  _code text,
  _fare numeric DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_fare numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_fare
  FROM public.coupons c
  WHERE auth.uid() IS NOT NULL
    AND lower(c.code) = lower(_code)
    AND c.active = true
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
    AND (c.min_fare IS NULL OR c.min_fare <= _fare)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.passenger_validate_coupon(text, numeric) TO authenticated;

-- RPC para incrementar uso atomicamente (evita race condition)
CREATE OR REPLACE FUNCTION public.passenger_consume_coupon(_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = _coupon_id
    AND active = true
    AND (max_uses IS NULL OR used_count < max_uses);
END;
$$;

GRANT EXECUTE ON FUNCTION public.passenger_consume_coupon(uuid) TO authenticated;

-- =========================================================
-- 4. RATING APPEALS: ocultar passenger_id para motoristas
-- =========================================================
DROP POLICY IF EXISTS "Drivers view own appeals" ON public.rating_appeals;

-- View segura sem passenger_id
CREATE OR REPLACE VIEW public.rating_appeals_driver_view
WITH (security_invoker = on) AS
SELECT
  id,
  ride_id,
  driver_id,
  original_rating,
  reason,
  admin_response,
  status,
  resolved_at,
  created_at,
  updated_at
FROM public.rating_appeals
WHERE auth.uid() = driver_id;

GRANT SELECT ON public.rating_appeals_driver_view TO authenticated;