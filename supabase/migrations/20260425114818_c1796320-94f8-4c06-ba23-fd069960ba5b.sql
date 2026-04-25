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
  SELECT
    p.user_id,
    p.full_name,
    p.selfie_url,
    p.selfie_signup_url,
    CASE WHEN p.user_id = r.driver_id THEN 'driver' ELSE 'passenger' END AS user_type
  FROM public.rides r
  JOIN public.profiles p
    ON p.user_id = r.passenger_id OR p.user_id = r.driver_id
  WHERE r.id = _ride_id
    AND (r.passenger_id = auth.uid() OR r.driver_id = auth.uid());
$$;