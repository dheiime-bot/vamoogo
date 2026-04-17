CREATE OR REPLACE FUNCTION public.find_nearest_drivers(_lat double precision, _lng double precision, _category vehicle_category, _limit integer DEFAULT 5, _max_km double precision DEFAULT 20)
 RETURNS TABLE(driver_id uuid, distance_km double precision, lat double precision, lng double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT dl.driver_id,
         public.haversine_km(_lat, _lng, dl.lat, dl.lng) AS distance_km,
         dl.lat, dl.lng
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id
  WHERE dl.is_online = true
    AND dl.category = _category
    AND dl.lat <> 0
    AND dl.lng <> 0
    AND dl.updated_at > now() - interval '2 minutes'
    AND d.status::text IN ('approved', 'aprovado')
    AND d.balance >= 5
    AND COALESCE(d.online_blocked, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.driver_id = dl.driver_id AND r.status IN ('accepted','in_progress')
    )
    AND public.haversine_km(_lat, _lng, dl.lat, dl.lng) <= _max_km
  ORDER BY distance_km ASC
  LIMIT _limit;
$function$;