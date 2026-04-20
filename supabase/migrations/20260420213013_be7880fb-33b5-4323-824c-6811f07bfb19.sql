CREATE OR REPLACE FUNCTION public.get_favorite_driver_details(_driver_ids uuid[])
RETURNS TABLE(
  user_id uuid,
  full_name text,
  selfie_url text,
  rating numeric,
  total_rides integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    COALESCE(p.selfie_url, p.selfie_signup_url, d.selfie_liveness_url, d.selfie_with_document_url) AS selfie_url,
    d.rating,
    d.total_rides,
    d.vehicle_brand,
    d.vehicle_model,
    d.vehicle_color,
    d.vehicle_plate
  FROM public.profiles p
  LEFT JOIN public.drivers d ON d.user_id = p.user_id
  WHERE p.user_id = ANY(_driver_ids)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR is_master(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.favorite_drivers fd
        WHERE fd.passenger_id = auth.uid()
          AND fd.driver_id = p.user_id
      )
    );
$$;