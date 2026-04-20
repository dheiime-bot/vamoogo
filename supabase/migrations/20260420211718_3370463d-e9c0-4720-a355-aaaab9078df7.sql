-- ============================================================
-- 1) UNIQUE constraints (CPF, placa, CNH, RENAVAM)
-- ============================================================

-- profiles.cpf único (passageiro/motorista podem ter o mesmo cpf em tabelas diferentes,
-- mas dentro de profiles deve ser único — profiles é 1:1 por user_id)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL AND cpf <> '';

-- drivers: placa única (quando preenchida) e CNH única (quando preenchida)
CREATE UNIQUE INDEX IF NOT EXISTS drivers_vehicle_plate_unique
  ON public.drivers (vehicle_plate)
  WHERE vehicle_plate IS NOT NULL AND vehicle_plate <> '';

CREATE UNIQUE INDEX IF NOT EXISTS drivers_cnh_number_unique
  ON public.drivers (cnh_number)
  WHERE cnh_number IS NOT NULL AND cnh_number <> '';

-- driver_vehicles: placa única globalmente (não pode haver mesmo veículo em 2 motoristas)
CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicles_plate_unique
  ON public.driver_vehicles (vehicle_plate);

-- ============================================================
-- 2) RENAVAM
-- ============================================================
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_renavam text;

ALTER TABLE public.driver_vehicles
  ADD COLUMN IF NOT EXISTS vehicle_renavam text;

ALTER TABLE public.vehicle_change_requests
  ADD COLUMN IF NOT EXISTS vehicle_renavam text;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_renavam_unique
  ON public.drivers (vehicle_renavam)
  WHERE vehicle_renavam IS NOT NULL AND vehicle_renavam <> '';

CREATE UNIQUE INDEX IF NOT EXISTS driver_vehicles_renavam_unique
  ON public.driver_vehicles (vehicle_renavam)
  WHERE vehicle_renavam IS NOT NULL AND vehicle_renavam <> '';

-- ============================================================
-- 3) Função: check duplicidade no signup (cpf + phone + plate + renavam)
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_signup_dupes(
  _cpf text,
  _phone text,
  _plate text DEFAULT NULL,
  _renavam text DEFAULT NULL
)
RETURNS TABLE (
  cpf_taken boolean,
  phone_taken boolean,
  plate_taken boolean,
  renavam_taken boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.profiles WHERE cpf = _cpf) AS cpf_taken,
    EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone AND _phone IS NOT NULL AND _phone <> '') AS phone_taken,
    EXISTS (
      SELECT 1 FROM public.driver_vehicles
      WHERE _plate IS NOT NULL AND _plate <> '' AND vehicle_plate = upper(regexp_replace(_plate, '[^A-Za-z0-9]', '', 'g'))
      UNION
      SELECT 1 FROM public.drivers
      WHERE _plate IS NOT NULL AND _plate <> '' AND vehicle_plate = upper(regexp_replace(_plate, '[^A-Za-z0-9]', '', 'g'))
    ) AS plate_taken,
    EXISTS (
      SELECT 1 FROM public.driver_vehicles
      WHERE _renavam IS NOT NULL AND _renavam <> '' AND vehicle_renavam = regexp_replace(_renavam, '[^0-9]', '', 'g')
      UNION
      SELECT 1 FROM public.drivers
      WHERE _renavam IS NOT NULL AND _renavam <> '' AND vehicle_renavam = regexp_replace(_renavam, '[^0-9]', '', 'g')
    ) AS renavam_taken;
$$;

-- ============================================================
-- 4) Função: motorista checa duplicidade antes de cadastrar veículo novo
-- ============================================================
CREATE OR REPLACE FUNCTION public.driver_check_vehicle_dupes(
  _plate text,
  _renavam text
)
RETURNS TABLE (
  plate_taken boolean,
  renavam_taken boolean,
  plate_owner_is_self boolean,
  renavam_owner_is_self boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT upper(regexp_replace(coalesce(_plate,''), '[^A-Za-z0-9]', '', 'g')) AS plate,
           regexp_replace(coalesce(_renavam,''), '[^0-9]', '', 'g') AS renavam
  )
  SELECT
    EXISTS (SELECT 1 FROM public.driver_vehicles dv, p WHERE p.plate <> '' AND dv.vehicle_plate = p.plate) AS plate_taken,
    EXISTS (SELECT 1 FROM public.driver_vehicles dv, p WHERE p.renavam <> '' AND dv.vehicle_renavam = p.renavam) AS renavam_taken,
    EXISTS (SELECT 1 FROM public.driver_vehicles dv, p WHERE p.plate <> '' AND dv.vehicle_plate = p.plate AND dv.driver_id = auth.uid()) AS plate_owner_is_self,
    EXISTS (SELECT 1 FROM public.driver_vehicles dv, p WHERE p.renavam <> '' AND dv.vehicle_renavam = p.renavam AND dv.driver_id = auth.uid()) AS renavam_owner_is_self;
$$;

-- ============================================================
-- 5) Função admin: transferir veículo entre motoristas
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_transfer_vehicle(
  _vehicle_id uuid,
  _new_driver_id uuid,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _old_driver uuid;
  _plate text;
  _was_active boolean;
BEGIN
  IF NOT (has_role(_admin, 'admin'::app_role) OR is_master(_admin)) THEN
    RAISE EXCEPTION 'Apenas administradores podem transferir veículos';
  END IF;

  SELECT driver_id, vehicle_plate, is_active
    INTO _old_driver, _plate, _was_active
  FROM public.driver_vehicles
  WHERE id = _vehicle_id;

  IF _old_driver IS NULL THEN
    RAISE EXCEPTION 'Veículo não encontrado';
  END IF;

  IF _old_driver = _new_driver_id THEN
    RAISE EXCEPTION 'O veículo já pertence a este motorista';
  END IF;

  -- valida que o destino é um motorista
  IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE user_id = _new_driver_id) THEN
    RAISE EXCEPTION 'Motorista destino não existe';
  END IF;

  -- transferir: muda dono, desativa
  UPDATE public.driver_vehicles
  SET driver_id = _new_driver_id,
      is_active = false,
      updated_at = now()
  WHERE id = _vehicle_id;

  -- se o veículo estava como ativo no motorista antigo, limpa os campos vehicle_* dele
  IF _was_active THEN
    UPDATE public.drivers
    SET vehicle_plate = NULL,
        vehicle_brand = NULL,
        vehicle_model = NULL,
        vehicle_color = NULL,
        vehicle_year = NULL,
        vehicle_renavam = NULL,
        vehicle_photo_front_url = NULL,
        vehicle_photo_back_url = NULL,
        vehicle_photo_left_url = NULL,
        vehicle_photo_right_url = NULL,
        crlv_url = NULL,
        updated_at = now()
    WHERE user_id = _old_driver;

    -- opcional: tirar do online
    UPDATE public.driver_locations SET is_online = false WHERE driver_id = _old_driver;
  END IF;

  -- audit log
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (
    _admin,
    'vehicle_transfer',
    'driver_vehicle',
    _vehicle_id::text,
    jsonb_build_object(
      'from_driver', _old_driver,
      'to_driver', _new_driver_id,
      'plate', _plate,
      'reason', _reason
    )
  );

  -- notificações
  INSERT INTO public.notifications (user_id, title, message, type, data)
  VALUES
    (_old_driver, 'Veículo removido', 'O veículo de placa ' || _plate || ' foi transferido pelo suporte.', 'vehicle_transfer', jsonb_build_object('plate', _plate, 'reason', _reason)),
    (_new_driver_id, 'Veículo transferido para você', 'O veículo de placa ' || _plate || ' agora está vinculado à sua conta. Acesse "Meus veículos" para ativá-lo.', 'vehicle_transfer', jsonb_build_object('plate', _plate, 'vehicle_id', _vehicle_id));
END;
$$;