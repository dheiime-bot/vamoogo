CREATE POLICY "Drivers can accept offered rides"
  ON public.rides
  FOR UPDATE
  TO public
  USING (
    status = 'requested'
    AND driver_id IS NULL
    AND public._driver_has_active_offer(id, auth.uid())
  )
  WITH CHECK (
    auth.uid() = driver_id
    AND status = 'accepted'
  );