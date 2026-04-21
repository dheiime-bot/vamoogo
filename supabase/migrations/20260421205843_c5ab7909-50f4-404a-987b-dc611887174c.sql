CREATE OR REPLACE FUNCTION public.admin_set_wallet_topup_status(_topup_id uuid, _new_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _topup record;
  _prev_balance numeric;
  _new_balance numeric;
  _bonus numeric := 0;
  _credit numeric := 0;
BEGIN
  IF NOT (public.has_role(_uid, 'admin'::app_role) OR public.is_master(_uid)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  IF _new_status NOT IN ('pendente','pago','creditado','cancelado') THEN
    RAISE EXCEPTION 'invalid status: %', _new_status;
  END IF;

  SELECT * INTO _topup FROM public.wallet_topups WHERE id = _topup_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'topup not found';
  END IF;

  IF _topup.status = _new_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  IF _new_status = 'creditado' AND _topup.status <> 'creditado' THEN
    _credit := COALESCE(_topup.valor, 0);

    IF _credit >= 100 THEN
      _bonus := round(_credit * 0.10, 2);
    ELSIF _credit >= 50 THEN
      _bonus := round(_credit * 0.05, 2);
    ELSE
      _bonus := 0;
    END IF;

    SELECT COALESCE(balance, 0) INTO _prev_balance
    FROM public.drivers
    WHERE user_id = _topup.driver_id
    FOR UPDATE;

    IF _prev_balance IS NULL THEN
      RAISE EXCEPTION 'driver row not found for %', _topup.driver_id;
    END IF;

    _new_balance := _prev_balance + _credit + _bonus;

    UPDATE public.drivers
    SET balance = _new_balance
    WHERE user_id = _topup.driver_id;

    INSERT INTO public.balance_adjustments (admin_id, driver_id, type, amount, previous_balance, new_balance, reason)
    VALUES (
      _uid,
      _topup.driver_id,
      'topup',
      _credit + _bonus,
      _prev_balance,
      _new_balance,
      'Recarga via Pix/WhatsApp #' || substr(_topup_id::text, 1, 8) ||
      CASE WHEN _bonus > 0 THEN ' (+ bônus R$ ' || _bonus::text || ')' ELSE '' END
    );

    -- type='recharge' é um dos valores permitidos pela constraint notifications_type_check
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      _topup.driver_id,
      'recharge',
      'Saldo creditado',
      'Sua recarga de R$ ' || _credit::text ||
      CASE WHEN _bonus > 0 THEN ' + bônus R$ ' || _bonus::text ELSE '' END ||
      ' foi creditada na sua carteira.',
      jsonb_build_object('topup_id', _topup_id, 'amount', _credit, 'bonus', _bonus)
    );
  END IF;

  UPDATE public.wallet_topups
  SET status = _new_status, updated_at = now()
  WHERE id = _topup_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (
    _uid,
    'wallet_topup',
    _topup_id::text,
    'set_status',
    jsonb_build_object('from', _topup.status, 'to', _new_status, 'credited', _credit, 'bonus', _bonus)
  );

  RETURN jsonb_build_object('ok', true, 'credited', _credit, 'bonus', _bonus, 'new_balance', _new_balance);
END;
$function$;