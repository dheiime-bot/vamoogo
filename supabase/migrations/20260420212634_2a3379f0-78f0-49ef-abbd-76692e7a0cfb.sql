-- 1) Remove a versão antiga (sem punição) da cancel_ride
DROP FUNCTION IF EXISTS public.cancel_ride(uuid, text);

-- 2) Garante que a versão nova aceita chamadas sem _reason_code
--    (já tem default null, então qualquer chamada antiga cai aqui).
--    Não precisamos recriar — só confirmar que existe a assinatura completa.

-- 3) Função segura para buscar dados públicos do motorista favoritado
CREATE OR REPLACE FUNCTION public.get_favorite_driver_details(_driver_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  full_name text,
  selfie_url text,
  rating numeric,
  total_rides integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    COALESCE(p.selfie_url, p.selfie_signup_url) AS selfie_url,
    d.rating,
    d.total_rides,
    d.vehicle_brand,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_plate
  FROM public.profiles p
  LEFT JOIN public.drivers d ON d.user_id = p.user_id
  WHERE p.user_id = ANY(_driver_ids)
    AND (
      -- Apenas se o solicitante for admin OU se ele realmente favoritou esse motorista
      has_role(auth.uid(), 'admin'::app_role)
      OR is_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.favorite_drivers fd
        WHERE fd.passenger_id = auth.uid()
          AND fd.driver_id = p.user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_favorite_driver_details(uuid[]) TO authenticated;