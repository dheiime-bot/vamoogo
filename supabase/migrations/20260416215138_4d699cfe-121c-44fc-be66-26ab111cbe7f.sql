
-- 1. Driver locations table (posição em tempo real)
CREATE TABLE public.driver_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL UNIQUE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT false,
  category public.vehicle_category NOT NULL DEFAULT 'car',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_locations_online ON public.driver_locations (is_online, category);
CREATE INDEX idx_driver_locations_coords ON public.driver_locations (lat, lng) WHERE is_online = true;

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers manage own location"
  ON public.driver_locations FOR ALL
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins view all locations"
  ON public.driver_locations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Passenger pode ver location do driver da sua corrida ativa
CREATE POLICY "Passengers view active driver location"
  ON public.driver_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.driver_id = driver_locations.driver_id
        AND r.passenger_id = auth.uid()
        AND r.status IN ('accepted','in_progress')
    )
  );

CREATE TRIGGER trg_driver_locations_updated
  BEFORE UPDATE ON public.driver_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;

-- 2. Ride offers (match por proximidade)
CREATE TABLE public.ride_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected|expired
  distance_to_pickup_km NUMERIC,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_ride_offers_driver_pending ON public.ride_offers (driver_id, status) WHERE status = 'pending';
CREATE INDEX idx_ride_offers_ride ON public.ride_offers (ride_id);

ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers see own offers"
  ON public.ride_offers FOR SELECT
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers respond to own offers"
  ON public.ride_offers FOR UPDATE
  USING (auth.uid() = driver_id);

CREATE POLICY "Passengers see offers of own ride"
  ON public.ride_offers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND r.passenger_id = auth.uid()));

CREATE POLICY "Admins manage offers"
  ON public.ride_offers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_offers;
ALTER TABLE public.ride_offers REPLICA IDENTITY FULL;

-- Garante realtime full em rides também
ALTER TABLE public.rides REPLICA IDENTITY FULL;

-- 3. Função haversine
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r CONSTANT DOUBLE PRECISION := 6371;
  dlat DOUBLE PRECISION := radians(lat2 - lat1);
  dlng DOUBLE PRECISION := radians(lng2 - lng1);
  a DOUBLE PRECISION;
BEGIN
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END;
$$;

-- 4. Função para encontrar motoristas online mais próximos
CREATE OR REPLACE FUNCTION public.find_nearest_drivers(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _category public.vehicle_category,
  _limit INT DEFAULT 5,
  _max_km DOUBLE PRECISION DEFAULT 20
) RETURNS TABLE(driver_id UUID, distance_km DOUBLE PRECISION, lat DOUBLE PRECISION, lng DOUBLE PRECISION)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT 
    dl.driver_id,
    public.haversine_km(_lat, _lng, dl.lat, dl.lng) AS distance_km,
    dl.lat,
    dl.lng
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id
  WHERE dl.is_online = true
    AND dl.category = _category
    AND d.status = 'approved'
    AND d.balance >= 5  -- saldo mínimo para receber corrida
    AND NOT EXISTS (
      SELECT 1 FROM public.rides r 
      WHERE r.driver_id = dl.driver_id AND r.status IN ('accepted','in_progress')
    )
    AND public.haversine_km(_lat, _lng, dl.lat, dl.lng) <= _max_km
  ORDER BY distance_km ASC
  LIMIT _limit;
$$;
