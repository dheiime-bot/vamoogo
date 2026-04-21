-- Reescreve as funções para usar 'low_balance' (já está no check constraint)
-- em vez de 'negative_balance' / 'account_blocked' que não existem.

CREATE OR REPLACE FUNCTION public.admin_send_negative_balance_alert(_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean;
  _driver record;
  _alert record;
  _days_left int;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO _is_admin;
  IF NOT _is_admin THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT d.user_id, d.balance, p.full_name
    INTO _driver
  FROM public.drivers d
  JOIN public.profiles p ON p.user_id = d.user_id
  WHERE d.user_id = _driver_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  IF COALESCE(_driver.balance, 0) >= 0 THEN
    RAISE EXCEPTION 'Motorista não possui saldo negativo';
  END IF;

  -- Garante que existe registro de alerta
  INSERT INTO public.negative_balance_alerts (driver_id, last_balance, first_alert_at, last_manual_alert_at)
  VALUES (_driver_id, _driver.balance, now(), now())
  ON CONFLICT (driver_id) DO UPDATE
    SET last_balance = EXCLUDED.last_balance,
        last_manual_alert_at = now(),
        updated_at = now(),
        resolved_at = NULL;

  SELECT * INTO _alert FROM public.negative_balance_alerts WHERE driver_id = _driver_id;
  _days_left := COALESCE(_alert.days_remaining, 30);

  -- Notificação ao motorista (usa tipo permitido 'low_balance')
  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (
    _driver_id,
    'low_balance',
    '⚠️ Regularize sua carteira',
    'Sua carteira está negativa em R$ ' || to_char(_driver.balance, 'FM999990.00') ||
    '. Você tem ' || _days_left || ' dia(s) para regularizar antes do bloqueio da conta.',
    '/driver/wallet',
    jsonb_build_object(
      'event', 'negative_balance_manual',
      'balance', _driver.balance,
      'days_remaining', _days_left
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'driver_id', _driver_id,
    'balance', _driver.balance,
    'days_remaining', _days_left
  );
END;
$$;

-- Atualiza também a função do batch diário para usar 'low_balance'
CREATE OR REPLACE FUNCTION public.process_negative_balance_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _driver record;
  _alert record;
  _new_days int;
  _processed int := 0;
  _blocked int := 0;
  _resolved int := 0;
BEGIN
  -- Resolver alertas de motoristas que regularizaram
  UPDATE public.negative_balance_alerts a
     SET resolved_at = now(),
         updated_at = now()
   FROM public.drivers d
   WHERE a.driver_id = d.user_id
     AND a.resolved_at IS NULL
     AND COALESCE(d.balance, 0) >= 0;
  GET DIAGNOSTICS _resolved = ROW_COUNT;

  -- Para cada motorista com saldo negativo
  FOR _driver IN
    SELECT d.user_id, d.balance, p.full_name
    FROM public.drivers d
    JOIN public.profiles p ON p.user_id = d.user_id
    WHERE COALESCE(d.balance, 0) < 0
      AND d.status <> 'blocked'
  LOOP
    -- Cria ou pega o alerta
    INSERT INTO public.negative_balance_alerts (driver_id, last_balance, days_remaining, first_alert_at, last_alert_at)
    VALUES (_driver.user_id, _driver.balance, 30, now(), now())
    ON CONFLICT (driver_id) DO NOTHING;

    SELECT * INTO _alert FROM public.negative_balance_alerts WHERE driver_id = _driver.user_id;

    -- Se já tinha sido alertado hoje, pula
    IF _alert.last_alert_at IS NOT NULL AND _alert.last_alert_at::date = CURRENT_DATE THEN
      CONTINUE;
    END IF;

    _new_days := GREATEST(0, COALESCE(_alert.days_remaining, 30) - 1);

    UPDATE public.negative_balance_alerts
       SET days_remaining = _new_days,
           last_alert_at = now(),
           last_balance = _driver.balance,
           updated_at = now(),
           blocked_at = CASE WHEN _new_days = 0 THEN now() ELSE blocked_at END
     WHERE driver_id = _driver.user_id;

    IF _new_days = 0 THEN
      -- Bloqueia conta
      UPDATE public.drivers
         SET status = 'blocked',
             online_blocked = true,
             online_blocked_reason = 'Conta bloqueada por inadimplência (30 dias com saldo negativo)',
             updated_at = now()
       WHERE user_id = _driver.user_id;

      INSERT INTO public.notifications (user_id, type, title, message, link, data)
      VALUES (
        _driver.user_id,
        'low_balance',
        '🚫 Conta bloqueada por inadimplência',
        'Sua conta foi bloqueada após 30 dias com saldo negativo (R$ ' ||
        to_char(_driver.balance, 'FM999990.00') || '). Regularize para reativar.',
        '/driver/wallet',
        jsonb_build_object('event', 'account_blocked_negative', 'balance', _driver.balance)
      );
      _blocked := _blocked + 1;
    ELSE
      INSERT INTO public.notifications (user_id, type, title, message, link, data)
      VALUES (
        _driver.user_id,
        'low_balance',
        '⚠️ Regularize sua conta — ' || _new_days || ' dia(s) restante(s)',
        'Sua carteira está negativa em R$ ' || to_char(_driver.balance, 'FM999990.00') ||
        '. Você tem ' || _new_days || ' dia(s) antes do bloqueio da conta.',
        '/driver/wallet',
        jsonb_build_object(
          'event', 'negative_balance_daily',
          'balance', _driver.balance,
          'days_remaining', _new_days
        )
      );
    END IF;

    _processed := _processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', _processed,
    'blocked', _blocked,
    'resolved', _resolved
  );
END;
$$;