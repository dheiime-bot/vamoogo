-- 1) Mudança de status da recarga: ao marcar como "creditado" credita saldo + audit + notificação
CREATE OR REPLACE FUNCTION public.admin_set_wallet_topup_status(
  _topup_id uuid,
  _new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Se já está no status alvo, não faz nada
  IF _topup.status = _new_status THEN
    RETURN jsonb_build_object('ok', true, 'noop', true);
  END IF;

  -- Crédito automático ao marcar como "creditado" (somente se ainda não creditou)
  IF _new_status = 'creditado' AND _topup.status <> 'creditado' THEN
    _credit := COALESCE(_topup.valor, 0);
    -- Bônus simples por faixa (igual ao app antigo)
    IF _credit >= 100 THEN _bonus := round(_credit * 0.10, 2);
    ELSIF _credit >= 50 THEN _bonus := round(_credit * 0.05, 2);
    ELSE _bonus := 0;
    END IF;

    SELECT COALESCE(balance, 0) INTO _prev_balance FROM public.drivers WHERE user_id = _topup.driver_id FOR UPDATE;
    IF _prev_balance IS NULL THEN
      RAISE EXCEPTION 'driver row not found for %', _topup.driver_id;
    END IF;
    _new_balance := _prev_balance + _credit + _bonus;

    UPDATE public.drivers SET balance = _new_balance WHERE user_id = _topup.driver_id;

    INSERT INTO public.balance_adjustments (admin_id, driver_id, type, amount, previous_balance, new_balance, reason)
    VALUES (_uid, _topup.driver_id, 'credit', _credit + _bonus, _prev_balance, _new_balance,
            'Recarga via WhatsApp #' || substr(_topup_id::text, 1, 8) ||
            CASE WHEN _bonus > 0 THEN ' (+ bônus R$ ' || _bonus::text || ')' ELSE '' END);

    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (_topup.driver_id, 'wallet',
            'Saldo creditado',
            'Sua recarga de R$ ' || _credit::text ||
              CASE WHEN _bonus > 0 THEN ' + bônus R$ ' || _bonus::text ELSE '' END ||
              ' foi creditada na sua carteira.',
            jsonb_build_object('topup_id', _topup_id, 'amount', _credit, 'bonus', _bonus));
  END IF;

  UPDATE public.wallet_topups SET status = _new_status, updated_at = now() WHERE id = _topup_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'wallet_topup', _topup_id::text, 'set_status',
          jsonb_build_object('from', _topup.status, 'to', _new_status, 'credited', _credit, 'bonus', _bonus));

  RETURN jsonb_build_object('ok', true, 'credited', _credit, 'bonus', _bonus, 'new_balance', _new_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_wallet_topup_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_topup_status(uuid, text) TO authenticated;


-- 2) Edição completa de motorista (inclui CPF, nascimento, endereço, RENAVAM e status)
CREATE OR REPLACE FUNCTION public.admin_update_driver_full(
  _user_id uuid,
  _full_name text,
  _cpf text,
  _email text,
  _phone text,
  _birth_date date,
  _category text,
  _vehicle_brand text,
  _vehicle_model text,
  _vehicle_color text,
  _vehicle_plate text,
  _vehicle_year integer,
  _vehicle_renavam text,
  _cnh_number text,
  _cnh_ear boolean,
  _pix_key text,
  _pix_key_type text,
  _pix_holder_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(_uid, 'admin'::app_role) OR public.is_master(_uid)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.profiles
     SET full_name  = COALESCE(NULLIF(trim(_full_name),  ''), full_name),
         cpf        = COALESCE(NULLIF(regexp_replace(_cpf, '\D', '', 'g'), ''), cpf),
         email      = NULLIF(trim(_email), ''),
         phone      = NULLIF(regexp_replace(_phone, '\D', '', 'g'), ''),
         birth_date = _birth_date,
         updated_at = now()
   WHERE user_id = _user_id;

  UPDATE public.drivers
     SET vehicle_brand   = NULLIF(trim(_vehicle_brand), ''),
         vehicle_model   = NULLIF(trim(_vehicle_model), ''),
         vehicle_color   = NULLIF(trim(_vehicle_color), ''),
         vehicle_plate   = NULLIF(upper(regexp_replace(_vehicle_plate, '\s', '', 'g')), ''),
         vehicle_year    = _vehicle_year,
         vehicle_renavam = NULLIF(regexp_replace(_vehicle_renavam, '\D', '', 'g'), ''),
         category        = COALESCE(_category::vehicle_category, category),
         cnh_number      = NULLIF(regexp_replace(_cnh_number, '\D', '', 'g'), ''),
         cnh_ear         = COALESCE(_cnh_ear, cnh_ear),
         pix_key         = NULLIF(trim(_pix_key), ''),
         pix_key_type    = NULLIF(trim(_pix_key_type), ''),
         pix_holder_name = NULLIF(trim(_pix_holder_name), ''),
         updated_at      = now()
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'driver', _user_id::text, 'update_full',
          jsonb_build_object(
            'full_name', _full_name, 'cpf', _cpf, 'email', _email, 'phone', _phone,
            'birth_date', _birth_date,
            'vehicle', _vehicle_brand || ' ' || _vehicle_model || ' ' || _vehicle_color || ' ' || _vehicle_plate,
            'category', _category, 'cnh_number', _cnh_number, 'cnh_ear', _cnh_ear,
            'pix_key_type', _pix_key_type
          ));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_driver_full(uuid, text, text, text, text, date, text, text, text, text, text, integer, text, text, boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_driver_full(uuid, text, text, text, text, date, text, text, text, text, text, integer, text, text, boolean, text, text, text) TO authenticated;


-- 3) Edição completa de passageiro (inclui CPF e nascimento)
CREATE OR REPLACE FUNCTION public.admin_update_passenger_full(
  _user_id uuid,
  _full_name text,
  _cpf text,
  _email text,
  _phone text,
  _birth_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT (public.has_role(_uid, 'admin'::app_role) OR public.is_master(_uid)) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.profiles
     SET full_name  = COALESCE(NULLIF(trim(_full_name), ''), full_name),
         cpf        = COALESCE(NULLIF(regexp_replace(_cpf, '\D', '', 'g'), ''), cpf),
         email      = NULLIF(trim(_email), ''),
         phone      = NULLIF(regexp_replace(_phone, '\D', '', 'g'), ''),
         birth_date = _birth_date,
         updated_at = now()
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'passenger', _user_id::text, 'update_full',
          jsonb_build_object(
            'full_name', _full_name, 'cpf', _cpf, 'email', _email,
            'phone', _phone, 'birth_date', _birth_date
          ));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_passenger_full(uuid, text, text, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_passenger_full(uuid, text, text, text, text, date) TO authenticated;