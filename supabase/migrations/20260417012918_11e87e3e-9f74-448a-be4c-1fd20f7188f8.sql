
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_photo_front_url text,
  ADD COLUMN IF NOT EXISTS vehicle_photo_back_url text,
  ADD COLUMN IF NOT EXISTS vehicle_photo_left_url text,
  ADD COLUMN IF NOT EXISTS vehicle_photo_right_url text;

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
      cnh_number, cnh_ear, cnh_front_url, cnh_back_url, crlv_url, selfie_with_document_url,
      criminal_record_url, criminal_record_issued_at,
      selfie_liveness_url, liveness_verified,
      vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
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
      COALESCE((NEW.raw_user_meta_data->>'cnh_ear')::boolean, false),
      NEW.raw_user_meta_data->>'cnh_front_url',
      NEW.raw_user_meta_data->>'cnh_back_url',
      NEW.raw_user_meta_data->>'crlv_url',
      NEW.raw_user_meta_data->>'selfie_with_document_url',
      NEW.raw_user_meta_data->>'criminal_record_url',
      NULLIF(NEW.raw_user_meta_data->>'criminal_record_issued_at','')::date,
      NEW.raw_user_meta_data->>'selfie_liveness_url',
      COALESCE((NEW.raw_user_meta_data->>'liveness_verified')::boolean, false),
      NEW.raw_user_meta_data->>'vehicle_photo_front_url',
      NEW.raw_user_meta_data->>'vehicle_photo_back_url',
      NEW.raw_user_meta_data->>'vehicle_photo_left_url',
      NEW.raw_user_meta_data->>'vehicle_photo_right_url',
      NEW.raw_user_meta_data->>'pix_key',
      NEW.raw_user_meta_data->>'pix_key_type',
      NEW.raw_user_meta_data->>'pix_holder_name'
    );
  END IF;

  RETURN NEW;
END;
$function$;
