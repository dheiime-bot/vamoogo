-- Função para marcar motoristas zumbi (sem heartbeat há > 2min) como offline
CREATE OR REPLACE FUNCTION public.cleanup_zombie_drivers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.driver_locations
  SET is_online = false
  WHERE is_online = true
    AND updated_at < now() - interval '2 minutes';
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- Índice para acelerar a query de find_nearest_drivers
CREATE INDEX IF NOT EXISTS idx_driver_locations_online_category
  ON public.driver_locations (is_online, category, updated_at)
  WHERE is_online = true;

-- Índice para ride_offers (driver_id + status + expires_at) para o polling rápido
CREATE INDEX IF NOT EXISTS idx_ride_offers_driver_pending
  ON public.ride_offers (driver_id, status, expires_at DESC)
  WHERE status = 'pending';