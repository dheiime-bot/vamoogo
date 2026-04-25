CREATE OR REPLACE FUNCTION public.get_active_ride_driver_details(_ride_id uuid)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  selfie_url text,
  selfie_signup_url text,
  rating numeric,
  total_rides integer,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_plate text,
  pix_key text,
  pix_key_type text
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
    p.selfie_signup_url,
    d.rating,
    d.total_rides,
    COALESCE(v.vehicle_brand, d.vehicle_brand) AS vehicle_brand,
    COALESCE(v.vehicle_model, d.vehicle_model) AS vehicle_model,
    COALESCE(v.vehicle_color, d.vehicle_color) AS vehicle_color,
    COALESCE(v.vehicle_plate, d.vehicle_plate) AS vehicle_plate,
    d.pix_key,
    d.pix_key_type
  FROM public.rides r
  JOIN public.drivers d ON d.user_id = r.driver_id
  JOIN public.profiles p ON p.user_id = r.driver_id
  LEFT JOIN public.driver_vehicles v ON v.driver_id = r.driver_id AND v.is_active = true AND v.status = 'approved'
  WHERE r.id = _ride_id
    AND r.driver_id IS NOT NULL
    AND (
      r.passenger_id = auth.uid()
      OR r.driver_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_master(auth.uid())
    )
    AND r.status IN ('accepted'::ride_status, 'in_progress'::ride_status, 'completed'::ride_status);
$$;

GRANT EXECUTE ON FUNCTION public.get_active_ride_driver_details(uuid) TO authenticated;