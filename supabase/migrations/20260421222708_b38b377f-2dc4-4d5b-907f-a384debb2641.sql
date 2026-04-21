CREATE OR REPLACE FUNCTION public.admin_send_negative_balance_alert(_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _driver record;
  _alert record;
  _days_left int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())) THEN
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

  INSERT INTO public.negative_balance_alerts (driver_id, last_balance, first_alert_at, last_manual_alert_at)
  VALUES (_driver_id, _driver.balance, now(), now())
  ON CONFLICT (driver_id) DO UPDATE
    SET last_balance = EXCLUDED.last_balance,
        last_manual_alert_at = now(),
        updated_at = now(),
        resolved_at = NULL;

  SELECT * INTO _alert FROM public.negative_balance_alerts WHERE driver_id = _driver_id;
  _days_left := COALESCE(_alert.days_remaining, 30);

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