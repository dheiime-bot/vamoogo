
-- ============================================
-- 1) VEÍCULOS DO MOTORISTA (1..N por motorista, 1 ativo)
-- ============================================
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  category public.vehicle_category NOT NULL,
  vehicle_brand text,
  vehicle_model text,
  vehicle_color text,
  vehicle_year integer,
  vehicle_plate text NOT NULL,
  crlv_url text,
  vehicle_photo_front_url text,
  vehicle_photo_back_url text,
  vehicle_photo_left_url text,
  vehicle_photo_right_url text,
  status text NOT NULL DEFAULT 'approved', -- 'approved' | 'archived'
  is_active boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dveh_driver ON public.driver_vehicles(driver_id);
-- Apenas 1 veículo ativo por motorista
CREATE UNIQUE INDEX IF NOT EXISTS idx_dveh_one_active
  ON public.driver_vehicles(driver_id) WHERE is_active = true;

ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own vehicles"
  ON public.driver_vehicles FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins manage all vehicles"
  ON public.driver_vehicles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE TRIGGER trg_dveh_updated_at
BEFORE UPDATE ON public.driver_vehicles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: cria 1 veículo "ativo" para cada motorista que já tem dados
INSERT INTO public.driver_vehicles
  (driver_id, category, vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate,
   crlv_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
   status, is_active, approved_at)
SELECT d.user_id, d.category, d.vehicle_brand, d.vehicle_model, d.vehicle_color, d.vehicle_year,
       COALESCE(d.vehicle_plate, 'SEM-PLACA'),
       d.crlv_url, d.vehicle_photo_front_url, d.vehicle_photo_back_url, d.vehicle_photo_left_url, d.vehicle_photo_right_url,
       'approved', true, now()
FROM public.drivers d
WHERE d.vehicle_plate IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.driver_vehicles v WHERE v.driver_id = d.user_id);

-- ============================================
-- 2) SOLICITAÇÕES DE TROCA DE CATEGORIA / NOVO VEÍCULO
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehicle_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  current_category public.vehicle_category,
  new_category public.vehicle_category NOT NULL,
  vehicle_brand text NOT NULL,
  vehicle_model text NOT NULL,
  vehicle_color text NOT NULL,
  vehicle_year integer,
  vehicle_plate text NOT NULL,
  crlv_url text,
  vehicle_photo_front_url text,
  vehicle_photo_back_url text,
  vehicle_photo_left_url text,
  vehicle_photo_right_url text,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_message text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_vehicle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vcr_driver ON public.vehicle_change_requests(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_vcr_status ON public.vehicle_change_requests(status, created_at DESC);
-- Só 1 pedido pendente por motorista
CREATE UNIQUE INDEX IF NOT EXISTS idx_vcr_one_pending
  ON public.vehicle_change_requests(driver_id) WHERE status = 'pending';

ALTER TABLE public.vehicle_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers view own requests"
  ON public.vehicle_change_requests FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Drivers create own requests"
  ON public.vehicle_change_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers cancel own pending requests"
  ON public.vehicle_change_requests FOR UPDATE TO authenticated
  USING (auth.uid() = driver_id AND status = 'pending')
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Admins manage all requests"
  ON public.vehicle_change_requests FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE TRIGGER trg_vcr_updated_at
BEFORE UPDATE ON public.vehicle_change_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 3) RPCs
-- ============================================

-- Motorista cria uma solicitação
CREATE OR REPLACE FUNCTION public.driver_request_vehicle_change(
  _new_category public.vehicle_category,
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
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _cur public.vehicle_category; _id uuid;
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

  INSERT INTO public.vehicle_change_requests (
    driver_id, current_category, new_category,
    vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate,
    crlv_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    reason
  ) VALUES (
    _uid, _cur, _new_category,
    _vehicle_brand, _vehicle_model, _vehicle_color, _vehicle_year, upper(trim(_vehicle_plate)),
    _crlv_url, _vehicle_photo_front_url, _vehicle_photo_back_url, _vehicle_photo_left_url, _vehicle_photo_right_url,
    _reason
  ) RETURNING id INTO _id;

  -- Notifica admins
  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  SELECT ur.user_id, 'vehicle_change_request', 'Nova solicitação de mudança de veículo',
         'Um motorista solicitou mudança de categoria/veículo.', '/admin/drivers',
         jsonb_build_object('request_id', _id, 'driver_id', _uid)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'master'::app_role);

  RETURN _id;
END $$;

-- Admin aprova: cria veículo, ativa-o e atualiza categoria do motorista
CREATE OR REPLACE FUNCTION public.admin_approve_vehicle_change(
  _request_id uuid,
  _message text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r record; _vehicle_id uuid;
BEGIN
  PERFORM public._require_admin();

  SELECT * INTO _r FROM public.vehicle_change_requests WHERE id = _request_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já foi analisada'; END IF;

  -- Desativa o atual
  UPDATE public.driver_vehicles SET is_active = false WHERE driver_id = _r.driver_id AND is_active = true;

  -- Cria o novo veículo aprovado e ativo
  INSERT INTO public.driver_vehicles (
    driver_id, category, vehicle_brand, vehicle_model, vehicle_color, vehicle_year, vehicle_plate,
    crlv_url, vehicle_photo_front_url, vehicle_photo_back_url, vehicle_photo_left_url, vehicle_photo_right_url,
    status, is_active, approved_by, approved_at
  ) VALUES (
    _r.driver_id, _r.new_category, _r.vehicle_brand, _r.vehicle_model, _r.vehicle_color, _r.vehicle_year, _r.vehicle_plate,
    _r.crlv_url, _r.vehicle_photo_front_url, _r.vehicle_photo_back_url, _r.vehicle_photo_left_url, _r.vehicle_photo_right_url,
    'approved', true, _uid, now()
  ) RETURNING id INTO _vehicle_id;

  -- Sincroniza tabela drivers (categoria + dados do veículo ativo)
  UPDATE public.drivers
     SET category = _r.new_category,
         vehicle_brand = _r.vehicle_brand,
         vehicle_model = _r.vehicle_model,
         vehicle_color = _r.vehicle_color,
         vehicle_year = _r.vehicle_year,
         vehicle_plate = _r.vehicle_plate,
         crlv_url = COALESCE(_r.crlv_url, crlv_url),
         vehicle_photo_front_url = COALESCE(_r.vehicle_photo_front_url, vehicle_photo_front_url),
         vehicle_photo_back_url = COALESCE(_r.vehicle_photo_back_url, vehicle_photo_back_url),
         vehicle_photo_left_url = COALESCE(_r.vehicle_photo_left_url, vehicle_photo_left_url),
         vehicle_photo_right_url = COALESCE(_r.vehicle_photo_right_url, vehicle_photo_right_url),
         updated_at = now()
   WHERE user_id = _r.driver_id;

  -- Atualiza categoria da localização (impacta dispatch)
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
END $$;

-- Admin rejeita
CREATE OR REPLACE FUNCTION public.admin_reject_vehicle_change(
  _request_id uuid,
  _message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r record;
BEGIN
  PERFORM public._require_admin();
  IF _message IS NULL OR length(trim(_message)) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo da rejeição';
  END IF;

  SELECT * INTO _r FROM public.vehicle_change_requests WHERE id = _request_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF _r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já foi analisada'; END IF;

  UPDATE public.vehicle_change_requests
     SET status = 'rejected', admin_message = _message,
         reviewed_by = _uid, reviewed_at = now()
   WHERE id = _request_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_r.driver_id, 'vehicle_change_rejected', 'Solicitação de veículo rejeitada',
          _message, '/driver/profile');

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'vehicle_change', _request_id::text, 'reject_vehicle_change',
          jsonb_build_object('driver_id', _r.driver_id, 'message', _message));
END $$;

-- Admin troca o veículo ativo manualmente (entre veículos já aprovados do motorista)
CREATE OR REPLACE FUNCTION public.admin_set_active_vehicle(
  _vehicle_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _v record;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO _v FROM public.driver_vehicles WHERE id = _vehicle_id;
  IF _v IS NULL THEN RAISE EXCEPTION 'Veículo não encontrado'; END IF;
  IF _v.status <> 'approved' THEN RAISE EXCEPTION 'Veículo não está aprovado'; END IF;

  UPDATE public.driver_vehicles SET is_active = false WHERE driver_id = _v.driver_id AND is_active = true;
  UPDATE public.driver_vehicles SET is_active = true WHERE id = _vehicle_id;

  UPDATE public.drivers
     SET category = _v.category,
         vehicle_brand = _v.vehicle_brand, vehicle_model = _v.vehicle_model,
         vehicle_color = _v.vehicle_color, vehicle_year = _v.vehicle_year,
         vehicle_plate = _v.vehicle_plate,
         crlv_url = COALESCE(_v.crlv_url, crlv_url),
         vehicle_photo_front_url = COALESCE(_v.vehicle_photo_front_url, vehicle_photo_front_url),
         vehicle_photo_back_url = COALESCE(_v.vehicle_photo_back_url, vehicle_photo_back_url),
         vehicle_photo_left_url = COALESCE(_v.vehicle_photo_left_url, vehicle_photo_left_url),
         vehicle_photo_right_url = COALESCE(_v.vehicle_photo_right_url, vehicle_photo_right_url),
         updated_at = now()
   WHERE user_id = _v.driver_id;

  UPDATE public.driver_locations SET category = _v.category WHERE driver_id = _v.driver_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'driver_vehicle', _vehicle_id::text, 'set_active_vehicle',
          jsonb_build_object('driver_id', _v.driver_id, 'category', _v.category));
END $$;
