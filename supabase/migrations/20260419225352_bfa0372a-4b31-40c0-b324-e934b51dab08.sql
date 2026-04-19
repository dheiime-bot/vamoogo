CREATE POLICY "Drivers can view rides offered to them"
ON public.rides
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.ride_offers ro
    WHERE ro.ride_id = rides.id
      AND ro.driver_id = auth.uid()
      AND ro.status = 'pending'
      AND ro.expires_at >= now()
      AND rides.status = 'requested'
  )
);