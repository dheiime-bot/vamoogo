CREATE OR REPLACE FUNCTION public.get_ride_chat_participants(_ride_id uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  selfie_url text,
  selfie_signup_url text,
  user_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.selfie_url, p.selfie_signup_url, p.user_type::text
  FROM public.rides r
  JOIN public.profiles p
    ON p.user_id = r.passenger_id OR p.user_id = r.driver_id
  WHERE r.id = _ride_id
    AND (r.passenger_id = auth.uid() OR r.driver_id = auth.uid());
$$;

DROP POLICY IF EXISTS "Ride participants can read active ride selfies" ON storage.objects;

CREATE POLICY "Ride participants can read active ride selfies"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.rides r
      ON p.user_id = r.passenger_id OR p.user_id = r.driver_id
    WHERE (r.passenger_id = auth.uid() OR r.driver_id = auth.uid())
      AND r.status IN ('accepted'::public.ride_status, 'in_progress'::public.ride_status)
      AND (
        p.selfie_url = storage.objects.name
        OR p.selfie_signup_url = storage.objects.name
        OR p.selfie_url LIKE ('%' || storage.objects.name)
        OR p.selfie_signup_url LIKE ('%' || storage.objects.name)
      )
  )
);