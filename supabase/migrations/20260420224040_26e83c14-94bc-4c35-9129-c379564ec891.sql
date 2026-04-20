CREATE OR REPLACE FUNCTION public.cancel_ride(_ride_id uuid, _reason text, _reason_code text DEFAULT NULL::text, _reason_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _r rides%ROWTYPE;
  _uid uuid := auth.uid();
  _is_pass boolean;
  _is_drv boolean;
  _kind text;
  _grace int;
  _now timestamptz := now();
  _ref timestamptz;
  _within_grace boolean := false;
  _counted boolean := false;
  _settings jsonb;
  _apply_to_pass boolean;
  _apply_to_drv boolean;
  _daily_limit int;
  _block_seq jsonb;
  _multiplier numeric;
  _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _new_count int;
  _new_block_idx int;
  _hours int;
  _block_until timestamptz;
  _block_count int;
  _label_resolved text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT * INTO _r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Corrida não encontrada';
  END IF;

  _is_pass := (_r.passenger_id = _uid);
  _is_drv  := (_r.driver_id IS NOT NULL AND _r.driver_id = _uid);
  IF NOT (_is_pass OR _is_drv) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar esta corrida';
  END IF;

  IF _r.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Corrida já finalizada';
  END IF;

  _kind := CASE WHEN _is_pass THEN 'passenger' ELSE 'driver' END;

  -- Carrega regras
  SELECT value INTO _settings FROM public.platform_settings WHERE key = 'cancellation_rules';
  IF _settings IS NULL THEN
    _settings := jsonb_build_object(
      'grace_seconds', 120,
      'daily_limit', 3,
      'block_hours_sequence', jsonb_build_array(2,5,12,24,48),
      'after_sequence_multiplier', 2,
      'apply_to_passenger', true,
      'apply_to_driver', true
    );
  END IF;
  _grace          := COALESCE((_settings->>'grace_seconds')::int, 120);
  _daily_limit    := COALESCE((_settings->>'daily_limit')::int, 3);
  _block_seq      := COALESCE(_settings->'block_hours_sequence', '[2,5,12,24,48]'::jsonb);
  _multiplier     := COALESCE((_settings->>'after_sequence_multiplier')::numeric, 2);
  _apply_to_pass  := COALESCE((_settings->>'apply_to_passenger')::boolean, true);
  _apply_to_drv   := COALESCE((_settings->>'apply_to_driver')::boolean, true);

  -- Janela de cortesia:
  --  • Passageiro: enquanto a corrida está apenas 'requested' OU dentro de _grace
  --    desde o último update (aceite/chegada).
  --  • Motorista: NUNCA tem grace. Todo cancelamento com motivo punível conta.
  IF _is_pass THEN
    _ref := COALESCE(_r.arrived_at, _r.started_at, _r.updated_at);
    IF _r.status = 'requested' THEN
      _within_grace := true;
    ELSE
      _within_grace := EXTRACT(EPOCH FROM (_now - _ref)) <= _grace;
    END IF;
  ELSE
    _within_grace := false;
  END IF;

  -- Verifica se o motivo escolhido conta como punição (override do banco)
  DECLARE
    _reason_punishes boolean := true;
  BEGIN
    IF _reason_code IS NOT NULL THEN
      SELECT counts_as_punishment INTO _reason_punishes
      FROM public.cancellation_reasons
      WHERE role = _kind AND code = _reason_code AND active = true;
      _reason_punishes := COALESCE(_reason_punishes, true);
    END IF;

    IF _within_grace OR NOT _reason_punishes THEN
      _counted := false;
    ELSIF (_is_pass AND _apply_to_pass) OR (_is_drv AND _apply_to_drv) THEN
      _counted := true;
    ELSE
      _counted := false;
    END IF;
  END;

  -- Atualiza corrida
  UPDATE public.rides
     SET status = 'cancelled',
         cancelled_at = _now,
         cancelled_by = _uid,
         cancel_reason_code = _reason_code,
         cancel_reason_note = NULLIF(trim(COALESCE(_reason_note, '')), ''),
         admin_notes = COALESCE(admin_notes || E'\n', '') ||
                       format('[%s] %s: %s', to_char(_now, 'YYYY-MM-DD HH24:MI'),
                              CASE WHEN _is_pass THEN 'passageiro' ELSE 'motorista' END,
                              COALESCE(_reason, 'sem motivo')),
         updated_at = _now
   WHERE id = _ride_id;

  -- Aplica contagem / bloqueio progressivo
  IF _counted THEN
    IF _is_pass THEN
      UPDATE public.profiles
         SET daily_cancellations = CASE
               WHEN last_cancellation_reset = _today THEN daily_cancellations + 1
               ELSE 1
             END,
             last_cancellation_reset = _today
       WHERE user_id = _uid
       RETURNING daily_cancellations, cancellation_block_count
                 INTO _new_count, _block_count;
    ELSE
      UPDATE public.drivers
         SET daily_cancellations = CASE
               WHEN last_cancellation_reset = _today THEN COALESCE(daily_cancellations, 0) + 1
               ELSE 1
             END,
             last_cancellation_reset = _today
       WHERE user_id = _uid
       RETURNING daily_cancellations, cancellation_block_count
                 INTO _new_count, _block_count;
    END IF;

    IF _new_count >= _daily_limit THEN
      _new_block_idx := COALESCE(_block_count, 0) + 1;
      IF _new_block_idx <= jsonb_array_length(_block_seq) THEN
        _hours := (_block_seq->>(_new_block_idx - 1))::int;
      ELSE
        _hours := round(
          (_block_seq->>(jsonb_array_length(_block_seq) - 1))::numeric
          * power(_multiplier, _new_block_idx - jsonb_array_length(_block_seq))
        );
      END IF;
      _block_until := _now + (_hours || ' hours')::interval;

      IF _is_pass THEN
        UPDATE public.profiles
           SET cancellation_block_until = _block_until,
               cancellation_block_count = _new_block_idx,
               daily_cancellations = 0
         WHERE user_id = _uid;
      ELSE
        UPDATE public.drivers
           SET cancellation_block_until = _block_until,
               cancellation_block_count = _new_block_idx,
               daily_cancellations = 0,
               online_blocked = true,
               online_blocked_reason = format('Bloqueado por %sh por excesso de cancelamentos', _hours)
         WHERE user_id = _uid;
        UPDATE public.driver_locations SET is_online = false WHERE driver_id = _uid;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'cancelled', true,
    'counted_for_punishment', _counted,
    'within_grace', _within_grace,
    'block_until', _block_until,
    'block_hours', _hours
  );
END;
$function$;