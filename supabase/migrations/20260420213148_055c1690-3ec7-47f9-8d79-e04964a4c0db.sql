-- 1) Permite leitura pública autenticada da nova chave
DROP POLICY IF EXISTS "Authenticated read public settings" ON public.platform_settings;
CREATE POLICY "Authenticated read public settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (key = ANY (ARRAY[
  'cancellation_rules',
  'tariffs_public',
  'platform_fee_percent',
  'favorite_call_max_km'
]));

-- 2) Atualiza a RPC para retornar online + distância
DROP FUNCTION IF EXISTS public.get_favorite_driver_details(uuid[]);
CREATE OR REPLACE FUNCTION public.get_favorite_driver_details(
  _driver_ids uuid[],
  _passenger_lat double precision DEFAULT NULL,
  _passenger_lng double precision DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  selfie_url text,
  rating numeric,
  total_rides integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  is_online boolean,
  distance_km numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    COALESCE(p.selfie_url, p.selfie_signup_url, d.selfie_liveness_url, d.selfie_with_document_url) AS selfie_url,
    d.rating,
    d.total_rides,
    d.vehicle_brand,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_plate,
    COALESCE(dl.is_online, false) AS is_online,
    CASE
      WHEN _passenger_lat IS NULL OR _passenger_lng IS NULL OR dl.lat IS NULL THEN NULL
      ELSE ROUND(haversine_km(_passenger_lat, dl.lat, _passenger_lng, dl.lng)::numeric, 2)
    END AS distance_km
  FROM public.profiles p
  LEFT JOIN public.drivers d ON d.user_id = p.user_id
  LEFT JOIN public.driver_locations dl ON dl.driver_id = p.user_id
  WHERE p.user_id = ANY(_driver_ids)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.favorite_drivers fd
        WHERE fd.passenger_id = auth.uid()
          AND fd.driver_id = p.user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_driver_details(uuid[], double precision, double precision) TO authenticated;

-- 3) Ação: chamar motorista favorito (envia notificação)
CREATE OR REPLACE FUNCTION public.passenger_call_favorite_driver(
  _driver_id uuid,
  _passenger_lat double precision,
  _passenger_lng double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _passenger uuid := auth.uid();
  _max_km numeric;
  _dl record;
  _dist numeric;
  _passenger_name text;
BEGIN
  IF _passenger IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Confirma favorito
  IF NOT EXISTS (
    SELECT 1 FROM favorite_drivers
    WHERE passenger_id = _passenger AND driver_id = _driver_id
  ) THEN
    RAISE EXCEPTION 'not_favorite';
  END IF;

  -- Lê limite configurado
  SELECT COALESCE((value)::text::numeric, 5)
    INTO _max_km
  FROM platform_settings
  WHERE key = 'favorite_call_max_km';
  _max_km := COALESCE(_max_km, 5);

  -- Verifica online + posição
  SELECT is_online, lat, lng INTO _dl
  FROM driver_locations
  WHERE driver_id = _driver_id;

  IF NOT FOUND OR NOT COALESCE(_dl.is_online, false) THEN
    RAISE EXCEPTION 'driver_offline';
  END IF;

  _dist := haversine_km(_passenger_lat, _dl.lat, _passenger_lng, _dl.lng);

  IF _dist > _max_km THEN
    RAISE EXCEPTION 'too_far';
  END IF;

  -- Nome do passageiro
  SELECT full_name INTO _passenger_name
  FROM profiles WHERE user_id = _passenger;

  -- Notificação para o motorista
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    _driver_id,
    'favorite_call',
    'Passageiro favorito quer te chamar',
    COALESCE(_passenger_name, 'Um passageiro') || ' está a ' || ROUND(_dist, 1) || ' km e quer pedir uma corrida com você.',
    jsonb_build_object('passenger_id', _passenger, 'distance_km', _dist)
  );

  RETURN jsonb_build_object('ok', true, 'distance_km', _dist, 'max_km', _max_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.passenger_call_favorite_driver(uuid, double precision, double precision) TO authenticated;