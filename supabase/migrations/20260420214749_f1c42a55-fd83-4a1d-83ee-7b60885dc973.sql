CREATE POLICY "Passengers view favorited driver location"
ON public.driver_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.favorite_drivers fd
    WHERE fd.driver_id = driver_locations.driver_id
      AND fd.passenger_id = auth.uid()
  )
);