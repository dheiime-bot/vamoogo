-- Allow drivers to delete their own change requests once they are no longer pending
CREATE POLICY "Drivers delete own resolved requests"
ON public.vehicle_change_requests
FOR DELETE
TO authenticated
USING (
  auth.uid() = driver_id
  AND status IN ('approved', 'rejected', 'cancelled')
);