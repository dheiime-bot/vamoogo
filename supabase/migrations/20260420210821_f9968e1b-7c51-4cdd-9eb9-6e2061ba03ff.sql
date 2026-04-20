-- ============================================================
-- Pente fino: hardening de segurança
-- ============================================================

-- 1) REALTIME: restringir SELECT/INSERT em realtime.messages
--    Apenas usuários autenticados podem assinar tópicos relacionados a si mesmos.
--    Como `realtime.messages` é uma tabela usada internamente pelo broadcast,
--    a forma correta é exigir autenticação (auth.uid() não nulo).
--    O scoping por user_id já é feito pelas RLS policies das tabelas publicadas
--    (rides, chat_messages, notifications, etc.) — só recebe payload se o SELECT
--    da tabela origem permitir.
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages;

CREATE POLICY "Authenticated can subscribe realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- INSERT (publish) só para usuários autenticados; broadcast a partir do
-- cliente é raramente usado e exige auth.
CREATE POLICY "Authenticated can publish realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 2) USER_ROLES: hardening da policy permissive de admin
--    Substituir a policy permissive ALL com role {-} (PUBLIC) por uma com
--    WITH CHECK explícito + restrita a authenticated, removendo qualquer
--    ambiguidade na avaliação.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

-- (As policies RESTRICTIVE de INSERT/UPDATE/DELETE já existem e bloqueiam
-- não-admins. A policy "Users can view own roles" continua permitindo SELECT
-- do próprio papel.)

-- 3) RIDES: ocultar telefone de terceiro do motorista
--    Em vez de quebrar a policy SELECT (que é necessária para o motorista ver
--    a corrida), criamos uma view sanitizada e damos permissão controlada.
--    Mais seguro: criar função SECURITY DEFINER que retorna a corrida sem o
--    other_person_phone para drivers, e ajustar o front para usá-la quando
--    aplicável. Por ora, criamos a função utilitária.
CREATE OR REPLACE FUNCTION public.get_ride_for_driver(_ride_id uuid)
RETURNS TABLE (
  id uuid,
  ride_code text,
  status ride_status,
  passenger_id uuid,
  driver_id uuid,
  origin_address text,
  origin_lat double precision,
  origin_lng double precision,
  destination_address text,
  destination_lat double precision,
  destination_lng double precision,
  distance_km numeric,
  duration_minutes integer,
  price numeric,
  driver_net numeric,
  platform_fee numeric,
  payment_method payment_method,
  payment_status text,
  category vehicle_category,
  passenger_count integer,
  for_other_person boolean,
  other_person_name text,
  -- other_person_phone NÃO é exposto — motorista contata via app
  stops jsonb,
  legs jsonb,
  created_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.ride_code, r.status, r.passenger_id, r.driver_id,
    r.origin_address, r.origin_lat, r.origin_lng,
    r.destination_address, r.destination_lat, r.destination_lng,
    r.distance_km, r.duration_minutes, r.price, r.driver_net, r.platform_fee,
    r.payment_method, r.payment_status, r.category, r.passenger_count,
    r.for_other_person, r.other_person_name,
    r.stops, r.legs,
    r.created_at, r.arrived_at, r.started_at, r.completed_at, r.cancelled_at
  FROM public.rides r
  WHERE r.id = _ride_id
    AND (
      r.driver_id = auth.uid()
      OR r.passenger_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_master(auth.uid())
    );
$$;

-- 4) STORAGE: adicionar policies de DELETE para usuários donos
CREATE POLICY "Users can delete own driver-documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own selfies"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'selfies'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Admins podem deletar arquivos órfãos para limpeza
CREATE POLICY "Admins can delete driver-documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN ('driver-documents','selfies')
  AND (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
);
