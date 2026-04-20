-- Função: motorista logado tem oferta ativa para a corrida?
CREATE OR REPLACE FUNCTION public._driver_has_active_offer(_ride_id uuid, _driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ride_offers ro
    WHERE ro.ride_id = _ride_id
      AND ro.driver_id = _driver_id
      AND ro.status = 'pending'
      AND ro.expires_at >= now()
  )
$$;

-- Função: usuário é passageiro da corrida?
CREATE OR REPLACE FUNCTION public._is_ride_passenger(_ride_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = _ride_id AND r.passenger_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public._driver_has_active_offer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._driver_has_active_offer(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._is_ride_passenger(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._is_ride_passenger(uuid, uuid) TO authenticated;

-- Substitui policy recursiva em rides
DROP POLICY IF EXISTS "Drivers can view rides offered to them" ON public.rides;
CREATE POLICY "Drivers can view rides offered to them"
ON public.rides
FOR SELECT
USING (
  status = 'requested'::ride_status
  AND public._driver_has_active_offer(id, auth.uid())
);

-- Substitui policy recursiva em ride_offers
DROP POLICY IF EXISTS "Passengers see offers of own ride" ON public.ride_offers;
CREATE POLICY "Passengers see offers of own ride"
ON public.ride_offers
FOR SELECT
USING (public._is_ride_passenger(ride_id, auth.uid()));