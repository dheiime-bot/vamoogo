
CREATE TABLE public.ride_route_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL,
  changed_by_role TEXT NOT NULL DEFAULT 'passenger',
  previous_destination_address TEXT,
  previous_destination_lat NUMERIC,
  previous_destination_lng NUMERIC,
  previous_distance_km NUMERIC,
  previous_price NUMERIC,
  new_destination_address TEXT NOT NULL,
  new_destination_lat NUMERIC,
  new_destination_lng NUMERIC,
  new_distance_km NUMERIC,
  new_price NUMERIC,
  driven_km NUMERIC,
  driven_price NUMERIC,
  new_leg_km NUMERIC,
  new_leg_price NUMERIC,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ride_route_changes_ride_id ON public.ride_route_changes(ride_id);
CREATE INDEX idx_ride_route_changes_created_at ON public.ride_route_changes(created_at DESC);

ALTER TABLE public.ride_route_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ride participants view route changes"
ON public.ride_route_changes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_route_changes.ride_id
      AND (r.passenger_id = auth.uid() OR r.driver_id = auth.uid())
  )
);

CREATE POLICY "Passenger inserts own route changes"
ON public.ride_route_changes FOR INSERT
WITH CHECK (
  auth.uid() = changed_by
  AND EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_route_changes.ride_id
      AND r.passenger_id = auth.uid()
  )
);

CREATE POLICY "Admins manage all route changes"
ON public.ride_route_changes FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_route_changes;
