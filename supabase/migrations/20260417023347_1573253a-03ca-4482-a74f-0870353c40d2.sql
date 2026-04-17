-- 1) Coluna active_role em profiles (modo ativo: passageiro ou motorista)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role public.app_role;

-- 2) Função para passageiro virar motorista (sem novo signup)
CREATE OR REPLACE FUNCTION public.become_driver(
  _category public.vehicle_category,
  _vehicle_brand text,
  _vehicle_model text,
  _vehicle_color text,
  _vehicle_year integer,
  _vehicle_plate text,
  _cnh_number text,
  _cnh_ear boolean,
  _cnh_front_url text,
  _cnh_back_url text,
  _crlv_url text,
  _selfie_with_document_url text,
  _criminal_record_url text,
  _criminal_record_issued_at date,
  _selfie_liveness_url text,
  _liveness_verified boolean,
  _vehicle_photo_front_url text,
  _vehicle_photo_back_url text,
  _vehicle_photo_left_url text,
  _vehicle_photo_right_url text,
  _pix_key text,
  _pix_key_type text,
  _pix_holder_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _birth date;
  _age integer;
  _driver_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  -- Valida idade mínima
  SELECT birth_date INTO _birth FROM public.profiles WHERE user_id = _uid;
  IF _birth IS NULL THEN
    RAISE EXCEPTION 'Data de nascimento não cadastrada no perfil' USING ERRCODE = '22023';
  END IF;
  _age := EXTRACT(YEAR FROM age(_birth))::integer;
  IF _age < 21 THEN
    RAISE EXCEPTION 'Idade mínima para motorista é 21 anos (sua idade: %)', _age USING ERRCODE = '22023';
  END IF;

  -- Já é motorista?
  IF EXISTS (SELECT 1 FROM public.drivers WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Você já possui cadastro de motorista' USING ERRCODE = '23505';
  END IF;

  -- Cria registro de motorista
  INSERT INTO public.drivers (
    user_id, category, status,
    vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate,
    cnh_number, cnh_ear, cnh_front_url, cnh_back_url, crlv_url, selfie_with_document_url,
    criminal_record_url, criminal_record_issued_at,
    selfie_liveness_url, liveness_verified,
    vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    pix_key, pix_key_type, pix_holder_name
  ) VALUES (
    _uid, _category, 'cadastro_enviado'::driver_status,
    _vehicle_brand, _vehicle_model, _vehicle_color, _vehicle_year, _vehicle_plate,
    _cnh_number, COALESCE(_cnh_ear, false), _cnh_front_url, _cnh_back_url, _crlv_url, _selfie_with_document_url,
    _criminal_record_url, _criminal_record_issued_at,
    _selfie_liveness_url, COALESCE(_liveness_verified, false),
    _vehicle_photo_front_url, _vehicle_photo_back_url, _vehicle_photo_left_url, _vehicle_photo_right_url,
    _pix_key, _pix_key_type, _pix_holder_name
  )
  RETURNING id INTO _driver_id;

  -- Garante role 'driver'
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'driver'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _driver_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.become_driver(
  public.vehicle_category, text, text, text, integer, text,
  text, boolean, text, text, text, text,
  text, date, text, boolean,
  text, text, text, text,
  text, text, text
) TO authenticated;