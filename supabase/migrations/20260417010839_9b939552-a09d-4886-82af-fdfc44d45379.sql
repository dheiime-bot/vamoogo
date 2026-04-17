-- 1. find_nearest_drivers respeita novos status
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
    AND d.status::text IN ('approved', 'aprovado')
    AND d.balance >= 5
    AND NOT EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.driver_id = dl.driver_id AND r.status IN ('accepted','in_progress')
    )
    AND public.haversine_km(_lat, _lng, dl.lat, dl.lng) <= _max_km
  ORDER BY distance_km ASC
  LIMIT _limit;
$function$;

-- 2. Trigger handle_new_user com todos os campos do motorista
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, email, phone, birth_date, selfie_signup_url, selfie_url, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'cpf', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'birth_date','')::date,
    NEW.raw_user_meta_data->>'selfie_signup_url',
    NEW.raw_user_meta_data->>'selfie_signup_url',
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'passenger')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::app_role, 'passenger')
  );

  IF NEW.raw_user_meta_data->>'user_type' = 'driver' THEN
    INSERT INTO public.drivers (
      user_id, category, status,
      vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate,
      cnh_number, cnh_front_url, cnh_back_url, crlv_url, selfie_with_document_url,
      pix_key, pix_key_type, pix_holder_name
    )
    VALUES (
      NEW.id,
      COALESCE((NEW.raw_user_meta_data->>'category')::vehicle_category, 'economico'),
      'cadastro_enviado'::driver_status,
      NEW.raw_user_meta_data->>'vehicle_brand',
      NEW.raw_user_meta_data->>'vehicle_model',
      NEW.raw_user_meta_data->>'vehicle_color',
      NULLIF(NEW.raw_user_meta_data->>'vehicle_year','')::integer,
      NEW.raw_user_meta_data->>'vehicle_plate',
      NEW.raw_user_meta_data->>'cnh_number',
      NEW.raw_user_meta_data->>'cnh_front_url',
      NEW.raw_user_meta_data->>'cnh_back_url',
      NEW.raw_user_meta_data->>'crlv_url',
      NEW.raw_user_meta_data->>'selfie_with_document_url',
      NEW.raw_user_meta_data->>'pix_key',
      NEW.raw_user_meta_data->>'pix_key_type',
      NEW.raw_user_meta_data->>'pix_holder_name'
    );
  END IF;

  RETURN NEW;
END;
$function$;
