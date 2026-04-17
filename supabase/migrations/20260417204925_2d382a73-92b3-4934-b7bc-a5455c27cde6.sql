-- Trigger de defesa em profundidade contra valores absurdos em rides
CREATE OR REPLACE FUNCTION public.validate_ride_metrics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.distance_km IS NOT NULL AND NEW.distance_km > 1000 THEN
    RAISE EXCEPTION 'distance_km inválida (% km > 1000)', NEW.distance_km USING ERRCODE = '22023';
  END IF;
  IF NEW.duration_minutes IS NOT NULL AND NEW.duration_minutes > 1440 THEN
    RAISE EXCEPTION 'duration_minutes inválida (% min > 1440)', NEW.duration_minutes USING ERRCODE = '22023';
  END IF;
  IF NEW.price IS NOT NULL AND NEW.price > 5000 THEN
    RAISE EXCEPTION 'price inválido (R$ % > 5000)', NEW.price USING ERRCODE = '22023';
  END IF;
  -- Coordenadas (0,0) são bug clássico; rejeitar quando não-nulas
  IF (NEW.origin_lat = 0 AND NEW.origin_lng = 0)
     OR (NEW.destination_lat = 0 AND NEW.destination_lng = 0) THEN
    RAISE EXCEPTION 'Coordenadas (0,0) não são válidas' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rides_validate_metrics ON public.rides;
CREATE TRIGGER rides_validate_metrics
BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.validate_ride_metrics();

-- Corrigir a corrida zumbi VAMOO1033 com base nas legs (que estão corretas)
UPDATE public.rides
SET distance_km = 1.9, duration_minutes = 5, price = 15.75,
    platform_fee = COALESCE(platform_fee * (15.75/NULLIF(price,0)), 0),
    driver_net = 15.75 - COALESCE(platform_fee * (15.75/NULLIF(price,0)), 0)
WHERE ride_code = 'VAMOO1033';