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
    r.driver_id AS user_id,
    COALESCE(NULLIF(trim(p.full_name), ''), 'Motorista') AS full_name,
    COALESCE(
      NULLIF(p.selfie_url, ''),
      NULLIF(p.selfie_signup_url, ''),
      NULLIF(d.selfie_liveness_url, ''),
      NULLIF(d.selfie_with_document_url, '')
    ) AS selfie_url,
    NULLIF(p.selfie_signup_url, '') AS selfie_signup_url,
    COALESCE(d.rating, 5.0) AS rating,
    COALESCE(d.total_rides, 0) AS total_rides,
    COALESCE(NULLIF(v.vehicle_brand, ''), NULLIF(d.vehicle_brand, '')) AS vehicle_brand,
    COALESCE(NULLIF(v.vehicle_model, ''), NULLIF(d.vehicle_model, '')) AS vehicle_model,
    COALESCE(NULLIF(v.vehicle_color, ''), NULLIF(d.vehicle_color, '')) AS vehicle_color,
    COALESCE(NULLIF(v.vehicle_plate, ''), NULLIF(d.vehicle_plate, '')) AS vehicle_plate,
    d.pix_key,
    d.pix_key_type
  FROM public.rides r
  LEFT JOIN public.drivers d ON d.user_id = r.driver_id
  LEFT JOIN public.profiles p ON p.user_id = r.driver_id
  LEFT JOIN LATERAL (
    SELECT dv.vehicle_brand, dv.vehicle_model, dv.vehicle_color, dv.vehicle_plate
    FROM public.driver_vehicles dv
    WHERE dv.driver_id = r.driver_id
      AND dv.status = 'approved'
    ORDER BY dv.is_active DESC, dv.approved_at DESC NULLS LAST, dv.created_at DESC
    LIMIT 1
  ) v ON true
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