
-- 1) Novos campos no perfil do passageiro (mesmo modelo do motorista)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_cancellations INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cancellation_reset DATE,
  ADD COLUMN IF NOT EXISTS cancellation_block_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_block_until TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.cancellation_block_until IS 'Bloqueio temporário por excesso de cancelamentos após aceite. Passageiro não pode pedir corrida até esta data.';

-- 2) Função genérica de horas de bloqueio (mesma escala do motorista)
CREATE OR REPLACE FUNCTION public._cancel_block_hours(_count INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- 1ª = 2h, 2ª = 5h, 3ª = 12h, 4ª = 24h, 5ª = 48h, depois dobra
  RETURN CASE _count
    WHEN 1 THEN 2
    WHEN 2 THEN 5
    WHEN 3 THEN 12
    WHEN 4 THEN 24
    WHEN 5 THEN 48
    ELSE 48 * (2 ^ (_count - 5))::INT
  END;
END $$;

-- 3) Janela de cortesia (segundos) após o aceite
CREATE OR REPLACE FUNCTION public._cancel_grace_seconds() RETURNS INT
LANGUAGE sql IMMUTABLE AS $$ SELECT 120 $$;

-- 4) RPC unificada: cancelar corrida (passageiro ou motorista)
CREATE OR REPLACE FUNCTION public.cancel_ride(_ride_id UUID, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _r RECORD;
  _is_passenger BOOLEAN;
  _is_driver BOOLEAN;
  _is_after_accept BOOLEAN;
  _accept_ref TIMESTAMPTZ;
  _grace_ok BOOLEAN := false;
  _counted BOOLEAN := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501';
  END IF;

  SELECT * INTO _r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corrida não encontrada' USING ERRCODE='P0002';
  END IF;

  _is_passenger := (_r.passenger_id = _uid);
  _is_driver := (_r.driver_id IS NOT NULL AND _r.driver_id = _uid);

  IF NOT (_is_passenger OR _is_driver) THEN
    RAISE EXCEPTION 'Você não participa desta corrida' USING ERRCODE='42501';
  END IF;

  IF _r.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Corrida já finalizada' USING ERRCODE='42501';
  END IF;

  IF _r.status = 'in_progress' THEN
    RAISE EXCEPTION 'Não é possível cancelar uma corrida que já foi iniciada. Entre em contato com o suporte.' USING ERRCODE='42501';
  END IF;

  -- Janela de cortesia: 2 minutos após o aceite/encontro
  _accept_ref := COALESCE(_r.arrived_at, _r.started_at, _r.updated_at);
  _is_after_accept := (_r.status IN ('accepted'));
  IF _is_after_accept AND _accept_ref IS NOT NULL THEN
    _grace_ok := (now() - _accept_ref) <= make_interval(secs => public._cancel_grace_seconds());
  END IF;

  -- Atualiza a corrida
  UPDATE public.rides
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = _uid,
         admin_notes = COALESCE(admin_notes,'') ||
                       CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                       to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || ' — ' ||
                       CASE WHEN _is_passenger THEN 'Passageiro' ELSE 'Motorista' END ||
                       ' cancelou: ' || COALESCE(_reason,'sem motivo')
   WHERE id = _ride_id;

  _counted := _is_after_accept AND NOT _grace_ok;

  RETURN jsonb_build_object(
    'cancelled_by', CASE WHEN _is_passenger THEN 'passenger' ELSE 'driver' END,
    'after_accept', _is_after_accept,
    'within_grace', _grace_ok,
    'counted_for_punishment', _counted
  );
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_ride(UUID, TEXT) TO authenticated;

-- 5) Trigger do MOTORISTA: respeita janela de cortesia
CREATE OR REPLACE FUNCTION public.enforce_driver_cancellation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _driver_id UUID;
  _today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _last_reset DATE;
  _daily INT;
  _block_count INT;
  _hours INT;
  _until TIMESTAMPTZ;
  _driver_name TEXT;
  _accept_ref TIMESTAMPTZ;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('accepted','in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NULL OR NEW.cancelled_by IS DISTINCT FROM NEW.driver_id THEN
    RETURN NEW;
  END IF;

  -- Janela de cortesia de 2 minutos após o aceite
  _accept_ref := COALESCE(OLD.arrived_at, OLD.started_at, OLD.updated_at);
  IF _accept_ref IS NOT NULL AND (now() - _accept_ref) <= make_interval(secs => public._cancel_grace_seconds()) THEN
    RETURN NEW;
  END IF;

  _driver_id := NEW.driver_id;

  SELECT last_cancellation_reset, COALESCE(daily_cancellations,0), COALESCE(cancellation_block_count,0)
    INTO _last_reset, _daily, _block_count
  FROM public.drivers WHERE user_id = _driver_id FOR UPDATE;

  IF _last_reset IS NULL OR _last_reset < _today THEN
    _daily := 0;
    UPDATE public.drivers SET daily_cancellations = 0, last_cancellation_reset = _today WHERE user_id = _driver_id;
  END IF;

  _daily := _daily + 1;
  UPDATE public.drivers SET daily_cancellations = _daily WHERE user_id = _driver_id;

  IF _daily % 3 = 0 THEN
    _block_count := _block_count + 1;
    _hours := public._cancel_block_hours(_block_count);
    _until := now() + (_hours || ' hours')::interval;

    UPDATE public.drivers
       SET cancellation_block_count = _block_count,
           cancellation_block_until = _until
     WHERE user_id = _driver_id;

    UPDATE public.driver_locations SET is_online = false WHERE driver_id = _driver_id;

    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      _driver_id, 'cancellation_block',
      'Bloqueio temporário por cancelamentos ⚠️',
      'Você cancelou ' || _daily || ' corridas hoje após aceitar. Está bloqueado de ficar online por ' || _hours || 'h (até ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || '). Cancelamentos prejudicam passageiros.',
      '/driver/status',
      jsonb_build_object('hours', _hours, 'until', _until, 'daily', _daily, 'block_number', _block_count)
    );

    SELECT full_name INTO _driver_name FROM public.profiles WHERE user_id = _driver_id;
    INSERT INTO public.fraud_alerts (driver_id, ride_id, severity, description, action_taken)
    VALUES (
      _driver_id, NEW.id,
      CASE WHEN _block_count >= 3 THEN 'probable'::fraud_severity
           WHEN _block_count = 2 THEN 'moderate'::fraud_severity
           ELSE 'light'::fraud_severity END,
      COALESCE(_driver_name,'Motorista') || ' cancelou ' || _daily || ' corridas hoje após aceitar. ' ||
      _block_count || 'ª punição: ' || _hours || 'h offline (até ' ||
      to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || ').',
      'auto_block_' || _hours || 'h'
    );

    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    SELECT ur.user_id, 'driver_cancellation_alert',
           'Motorista bloqueado por cancelamentos',
           COALESCE(_driver_name,'Motorista') || ' acumulou ' || _daily || ' cancelamentos hoje. Bloqueado por ' || _hours || 'h.',
           '/admin/drivers',
           jsonb_build_object('driver_id', _driver_id, 'daily', _daily, 'hours', _hours, 'block_number', _block_count)
    FROM public.user_roles ur WHERE ur.role IN ('admin'::app_role, 'master'::app_role);
  END IF;

  RETURN NEW;
END $$;

-- 6) Trigger do PASSAGEIRO (espelho da do motorista, em profiles)
CREATE OR REPLACE FUNCTION public.enforce_passenger_cancellation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _passenger_id UUID;
  _today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _last_reset DATE;
  _daily INT;
  _block_count INT;
  _hours INT;
  _until TIMESTAMPTZ;
  _name TEXT;
  _accept_ref TIMESTAMPTZ;
BEGIN
  -- Só conta se foi cancelado APÓS aceite e por quem cancelou foi o passageiro
  IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('accepted') THEN
    RETURN NEW;
  END IF;
  IF NEW.cancelled_by IS DISTINCT FROM NEW.passenger_id THEN
    RETURN NEW;
  END IF;

  -- Cortesia de 2 min
  _accept_ref := COALESCE(OLD.arrived_at, OLD.updated_at);
  IF _accept_ref IS NOT NULL AND (now() - _accept_ref) <= make_interval(secs => public._cancel_grace_seconds()) THEN
    RETURN NEW;
  END IF;

  _passenger_id := NEW.passenger_id;

  SELECT last_cancellation_reset, COALESCE(daily_cancellations,0), COALESCE(cancellation_block_count,0)
    INTO _last_reset, _daily, _block_count
  FROM public.profiles WHERE user_id = _passenger_id FOR UPDATE;

  IF _last_reset IS NULL OR _last_reset < _today THEN
    _daily := 0;
    UPDATE public.profiles SET daily_cancellations = 0, last_cancellation_reset = _today WHERE user_id = _passenger_id;
  END IF;

  _daily := _daily + 1;
  UPDATE public.profiles SET daily_cancellations = _daily WHERE user_id = _passenger_id;

  IF _daily % 3 = 0 THEN
    _block_count := _block_count + 1;
    _hours := public._cancel_block_hours(_block_count);
    _until := now() + (_hours || ' hours')::interval;

    UPDATE public.profiles
       SET cancellation_block_count = _block_count,
           cancellation_block_until = _until
     WHERE user_id = _passenger_id;

    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      _passenger_id, 'cancellation_block',
      'Bloqueio temporário por cancelamentos ⚠️',
      'Você cancelou ' || _daily || ' corridas hoje após o motorista aceitar. Está impedido de pedir nova corrida por ' || _hours || 'h (até ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || ').',
      '/passenger/home',
      jsonb_build_object('hours', _hours, 'until', _until, 'daily', _daily, 'block_number', _block_count)
    );

    SELECT full_name INTO _name FROM public.profiles WHERE user_id = _passenger_id;
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    SELECT ur.user_id, 'passenger_cancellation_alert',
           'Passageiro bloqueado por cancelamentos',
           COALESCE(_name,'Passageiro') || ' acumulou ' || _daily || ' cancelamentos hoje. Bloqueado por ' || _hours || 'h.',
           '/admin/passengers',
           jsonb_build_object('passenger_id', _passenger_id, 'daily', _daily, 'hours', _hours, 'block_number', _block_count)
    FROM public.user_roles ur WHERE ur.role IN ('admin'::app_role, 'master'::app_role);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_passenger_cancellation_limit ON public.rides;
CREATE TRIGGER trg_enforce_passenger_cancellation_limit
AFTER UPDATE OF status ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_passenger_cancellation_limit();

-- 7) Bloqueia novo pedido de corrida enquanto o passageiro estiver punido
CREATE OR REPLACE FUNCTION public.enforce_passenger_can_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _p record; _remaining_min INT;
BEGIN
  SELECT cancellation_block_until, status::text AS status
    INTO _p
  FROM public.profiles WHERE user_id = NEW.passenger_id;

  IF _p IS NULL THEN RETURN NEW; END IF;

  IF _p.cancellation_block_until IS NOT NULL AND _p.cancellation_block_until > now() THEN
    _remaining_min := CEIL(EXTRACT(EPOCH FROM (_p.cancellation_block_until - now())) / 60)::INT;
    RAISE EXCEPTION 'Você está bloqueado por excesso de cancelamentos. Volta em % minutos (até %).',
      _remaining_min,
      to_char(_p.cancellation_block_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_passenger_can_request ON public.rides;
CREATE TRIGGER trg_enforce_passenger_can_request
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_passenger_can_request();
