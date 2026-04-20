-- become_driver: aceita _vehicle_renavam (obrigatório a partir de agora — quem chama envia)
CREATE OR REPLACE FUNCTION public.become_driver(
  _category vehicle_category,
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
  _pix_holder_name text,
  _vehicle_renavam text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _birth date;
  _age integer;
  _driver_id uuid;
  _clean_plate text := upper(regexp_replace(coalesce(_vehicle_plate,''), '[^A-Za-z0-9]', '', 'g'));
  _clean_renavam text := regexp_replace(coalesce(_vehicle_renavam,''), '[^0-9]', '', 'g');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT birth_date INTO _birth FROM public.profiles WHERE user_id = _uid;
  IF _birth IS NULL THEN
    RAISE EXCEPTION 'Data de nascimento não cadastrada no perfil' USING ERRCODE = '22023';
  END IF;
  _age := EXTRACT(YEAR FROM age(_birth))::integer;
  IF _age < 21 THEN
    RAISE EXCEPTION 'Idade mínima para motorista é 21 anos (sua idade: %)', _age USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.drivers WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Você já possui cadastro de motorista' USING ERRCODE = '23505';
  END IF;

  -- valida duplicidade explícita (mensagem amigável)
  IF EXISTS (SELECT 1 FROM public.drivers WHERE vehicle_plate = _clean_plate)
     OR EXISTS (SELECT 1 FROM public.driver_vehicles WHERE vehicle_plate = _clean_plate) THEN
    RAISE EXCEPTION 'Esta placa já está cadastrada em outro motorista' USING ERRCODE = '23505';
  END IF;
  IF _clean_renavam <> '' AND (
       EXISTS (SELECT 1 FROM public.drivers WHERE vehicle_renavam = _clean_renavam)
    OR EXISTS (SELECT 1 FROM public.driver_vehicles WHERE vehicle_renavam = _clean_renavam)
  ) THEN
    RAISE EXCEPTION 'Este RENAVAM já está cadastrado em outro veículo' USING ERRCODE = '23505';
  END IF;
  IF _cnh_number IS NOT NULL AND _cnh_number <> ''
     AND EXISTS (SELECT 1 FROM public.drivers WHERE cnh_number = _cnh_number) THEN
    RAISE EXCEPTION 'Esta CNH já está cadastrada em outro motorista' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.drivers (
    user_id, category, status,
    vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, vehicle_renavam,
    cnh_number, cnh_ear, cnh_front_url, cnh_back_url, crlv_url, selfie_with_document_url,
    criminal_record_url, criminal_record_issued_at,
    selfie_liveness_url, liveness_verified,
    vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    pix_key, pix_key_type, pix_holder_name
  ) VALUES (
    _uid, _category, 'cadastro_enviado'::driver_status,
    _vehicle_brand, _vehicle_model, _vehicle_color, _vehicle_year, _clean_plate, NULLIF(_clean_renavam,''),
    _cnh_number, COALESCE(_cnh_ear, false), _cnh_front_url, _cnh_back_url, _crlv_url, _selfie_with_document_url,
    _criminal_record_url, _criminal_record_issued_at,
    _selfie_liveness_url, COALESCE(_liveness_verified, false),
    _vehicle_photo_front_url, _vehicle_photo_back_url, _vehicle_photo_left_url, _vehicle_photo_right_url,
    _pix_key, _pix_key_type, _pix_holder_name
  )
  RETURNING id INTO _driver_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'driver'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _driver_id;
END;
$function$;

-- driver_request_vehicle_change: aceita _vehicle_renavam
CREATE OR REPLACE FUNCTION public.driver_request_vehicle_change(
  _new_category vehicle_category,
  _vehicle_brand text,
  _vehicle_model text,
  _vehicle_color text,
  _vehicle_year integer,
  _vehicle_plate text,
  _crlv_url text,
  _vehicle_photo_front_url text,
  _vehicle_photo_back_url text,
  _vehicle_photo_left_url text,
  _vehicle_photo_right_url text,
  _reason text DEFAULT NULL::text,
  _vehicle_renavam text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _cur public.vehicle_category;
  _id uuid;
  _clean_plate text := upper(regexp_replace(coalesce(_vehicle_plate,''), '[^A-Za-z0-9]', '', 'g'));
  _clean_renavam text := regexp_replace(coalesce(_vehicle_renavam,''), '[^0-9]', '', 'g');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _vehicle_brand IS NULL OR _vehicle_model IS NULL OR _vehicle_color IS NULL OR _vehicle_plate IS NULL THEN
    RAISE EXCEPTION 'Preencha marca, modelo, cor e placa';
  END IF;

  SELECT category INTO _cur FROM public.drivers WHERE user_id = _uid;
  IF _cur IS NULL THEN RAISE EXCEPTION 'Cadastro de motorista não encontrado'; END IF;

  IF EXISTS(SELECT 1 FROM public.vehicle_change_requests WHERE driver_id = _uid AND status = 'pending') THEN
    RAISE EXCEPTION 'Você já tem uma solicitação pendente. Aguarde a análise do admin.';
  END IF;

  -- bloqueia placa/renavam já em uso por outro motorista
  IF EXISTS (SELECT 1 FROM public.driver_vehicles WHERE vehicle_plate = _clean_plate AND driver_id <> _uid) THEN
    RAISE EXCEPTION 'Esta placa já está cadastrada em outro motorista' USING ERRCODE = '23505';
  END IF;
  IF _clean_renavam <> '' AND EXISTS (
    SELECT 1 FROM public.driver_vehicles WHERE vehicle_renavam = _clean_renavam AND driver_id <> _uid
  ) THEN
    RAISE EXCEPTION 'Este RENAVAM já está cadastrado em outro veículo' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.vehicle_change_requests (
    driver_id, current_category, new_category,
    vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, vehicle_renavam,
    crlv_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    reason
  ) VALUES (
    _uid, _cur, _new_category,
    _vehicle_brand, _vehicle_model, _vehicle_color, _vehicle_year, _clean_plate, NULLIF(_clean_renavam,''),
    _crlv_url, _vehicle_photo_front_url, _vehicle_photo_back_url, _vehicle_photo_left_url, _vehicle_photo_right_url,
    _reason
  ) RETURNING id INTO _id;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  SELECT ur.user_id, 'vehicle_change_request', 'Nova solicitação de mudança de veículo',
         'Um motorista solicitou mudança de categoria/veículo.', '/admin/drivers',
         jsonb_build_object('request_id', _id, 'driver_id', _uid)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'master'::app_role);

  RETURN _id;
END;
$function$;

-- admin_approve_vehicle_change: propaga renavam
CREATE OR REPLACE FUNCTION public.admin_approve_vehicle_change(
  _request_id uuid,
  _message text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _r record; _vehicle_id uuid;
BEGIN
  PERFORM public._require_admin();

  SELECT * INTO _r FROM public.vehicle_change_requests WHERE id = _request_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já foi analisada'; END IF;

  UPDATE public.driver_vehicles SET is_active = false WHERE driver_id = _r.driver_id AND is_active = true;

  INSERT INTO public.driver_vehicles (
    driver_id, category, vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate, vehicle_renavam,
    crlv_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    status, is_active, approved_by, approved_at
  ) VALUES (
    _r.driver_id, _r.new_category, _r.vehicle_brand, _r.vehicle_model, _r.vehicle_color, _r.vehicle_year, _r.vehicle_plate, _r.vehicle_renavam,
    _r.crlv_url, _r.vehicle_photo_front_url, _r.vehicle_photo_back_url, _r.vehicle_photo_left_url, _r.vehicle_photo_right_url,
    'approved', true, _uid, now()
  ) RETURNING id INTO _vehicle_id;

  UPDATE public.drivers
     SET category = _r.new_category,
         vehicle_brand = _r.vehicle_brand,
         vehicle_model = _r.vehicle_model,
         vehicle_color = _r.vehicle_color,
         vehicle_year = _r.vehicle_year,
         vehicle_plate = _r.vehicle_plate,
         vehicle_renavam = COALESCE(_r.vehicle_renavam, vehicle_renavam),
         crlv_url = COALESCE(_r.crlv_url, crlv_url),
         vehicle_photo_front_url = COALESCE(_r.vehicle_photo_front_url, vehicle_photo_front_url),
         vehicle_photo_back_url = COALESCE(_r.vehicle_photo_back_url, vehicle_photo_back_url),
         vehicle_photo_left_url = COALESCE(_r.vehicle_photo_left_url, vehicle_photo_left_url),
         vehicle_photo_right_url = COALESCE(_r.vehicle_photo_right_url, vehicle_photo_right_url),
         updated_at = now()
   WHERE user_id = _r.driver_id;

  UPDATE public.driver_locations SET category = _r.new_category WHERE driver_id = _r.driver_id;

  UPDATE public.vehicle_change_requests
     SET status = 'approved', admin_message = _message,
         reviewed_by = _uid, reviewed_at = now(),
         created_vehicle_id = _vehicle_id
   WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_r.driver_id, 'vehicle_change_approved', 'Mudança de veículo aprovada ✅',
          COALESCE(_message, 'Seu novo veículo (' || _r.vehicle_brand || ' ' || _r.vehicle_model || ' • ' || _r.vehicle_plate || ') já está ativo.'),
          '/driver/profile');

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'vehicle_change', _request_id::text, 'approve_vehicle_change',
          jsonb_build_object('driver_id', _r.driver_id, 'new_category', _r.new_category, 'vehicle_id', _vehicle_id));

  RETURN _vehicle_id;
END $function$;