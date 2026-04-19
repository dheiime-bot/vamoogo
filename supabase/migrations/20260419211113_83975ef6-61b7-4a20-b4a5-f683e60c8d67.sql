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
BEGIN
  -- Só interessa quando vira 'cancelled' a partir de 'accepted' ou 'in_progress' E quem cancelou foi o motorista
  IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('accepted','in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NULL OR NEW.cancelled_by IS DISTINCT FROM NEW.driver_id THEN
    RETURN NEW;
  END IF;

  _driver_id := NEW.driver_id;

  -- Reset diário (meia-noite horário local)
  SELECT last_cancellation_reset, COALESCE(daily_cancellations,0), COALESCE(cancellation_block_count,0)
    INTO _last_reset, _daily, _block_count
  FROM public.drivers WHERE user_id = _driver_id FOR UPDATE;

  IF _last_reset IS NULL OR _last_reset < _today THEN
    _daily := 0;
    UPDATE public.drivers
       SET daily_cancellations = 0,
           last_cancellation_reset = _today
     WHERE user_id = _driver_id;
  END IF;

  -- Incrementa contador do dia
  _daily := _daily + 1;

  UPDATE public.drivers
     SET daily_cancellations = _daily
   WHERE user_id = _driver_id;

  -- A cada múltiplo de 3, aplica bloqueio progressivo + alerta admin
  IF _daily % 3 = 0 THEN
    _block_count := _block_count + 1;
    _hours := public._driver_cancel_block_hours(_block_count);
    _until := now() + (_hours || ' hours')::interval;

    UPDATE public.drivers
       SET cancellation_block_count = _block_count,
           cancellation_block_until = _until
     WHERE user_id = _driver_id;

    UPDATE public.driver_locations
       SET is_online = false
     WHERE driver_id = _driver_id;

    -- Notifica motorista
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      _driver_id,
      'cancellation_block',
      'Bloqueio temporário por cancelamentos ⚠️',
      'Você cancelou ' || _daily || ' corridas hoje após aceitar. Está bloqueado de ficar online por ' || _hours || 'h (até ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || '). Cancelamentos prejudicam passageiros.',
      '/driver/status',
      jsonb_build_object('hours', _hours, 'until', _until, 'daily', _daily, 'block_number', _block_count)
    );

    -- Alerta na central de fraude para admins acompanharem
    SELECT full_name INTO _driver_name FROM public.profiles WHERE user_id = _driver_id;

    INSERT INTO public.fraud_alerts (driver_id, ride_id, severity, description, action_taken)
    VALUES (
      _driver_id,
      NEW.id,
      CASE
        WHEN _block_count >= 3 THEN 'probable'::fraud_severity
        WHEN _block_count = 2 THEN 'moderate'::fraud_severity
        ELSE 'light'::fraud_severity
      END,
      COALESCE(_driver_name,'Motorista') || ' cancelou ' || _daily || ' corridas hoje após aceitar. ' ||
      _block_count || 'ª punição aplicada: ' || _hours || 'h offline (até ' ||
      to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || ').',
      'auto_block_' || _hours || 'h'
    );

    -- Notifica todos os admins/master
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    SELECT ur.user_id, 'driver_cancellation_alert',
           'Motorista bloqueado por cancelamentos',
           COALESCE(_driver_name,'Motorista') || ' acumulou ' || _daily || ' cancelamentos hoje. Bloqueado por ' || _hours || 'h.',
           '/admin/drivers',
           jsonb_build_object('driver_id', _driver_id, 'daily', _daily, 'hours', _hours, 'block_number', _block_count)
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'master'::app_role);
  END IF;

  RETURN NEW;
END;
$$;