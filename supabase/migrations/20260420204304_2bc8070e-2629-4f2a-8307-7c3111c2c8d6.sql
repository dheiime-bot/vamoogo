
-- =============================================================
-- 1) Tabela de motivos de cancelamento
-- =============================================================
CREATE TABLE IF NOT EXISTS public.cancellation_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('passenger', 'driver')),
  code text NOT NULL,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  counts_as_punishment boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, code)
);

CREATE INDEX IF NOT EXISTS idx_cancellation_reasons_role_active
  ON public.cancellation_reasons (role, active, sort_order);

ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read active reasons"
  ON public.cancellation_reasons
  FOR SELECT
  TO authenticated
  USING (active = true);

CREATE POLICY "Admins read all reasons"
  ON public.cancellation_reasons
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE POLICY "Admins manage reasons"
  ON public.cancellation_reasons
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public._touch_cancellation_reasons()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_cancellation_reasons ON public.cancellation_reasons;
CREATE TRIGGER trg_touch_cancellation_reasons
  BEFORE UPDATE ON public.cancellation_reasons
  FOR EACH ROW
  EXECUTE FUNCTION public._touch_cancellation_reasons();

-- =============================================================
-- 2) Seeds (motivos padrão)
-- =============================================================
INSERT INTO public.cancellation_reasons (role, code, label, sort_order, counts_as_punishment) VALUES
  -- Passageiro
  ('passenger', 'long_wait',         'Motorista está demorando', 10, true),
  ('passenger', 'changed_mind',      'Mudei de ideia',           20, true),
  ('passenger', 'wrong_address',     'Errei o endereço',         30, true),
  ('passenger', 'driver_no_show',    'Motorista não veio',       40, false),
  ('passenger', 'driver_problem',    'Problema com o motorista', 50, false),
  ('passenger', 'other',             'Outro motivo',             99, true),
  -- Motorista
  ('driver',    'passenger_no_show', 'Passageiro não apareceu',          10, false),
  ('driver',    'wrong_pickup',      'Endereço de embarque inacessível', 20, false),
  ('driver',    'vehicle_problem',   'Problema mecânico no veículo',     30, false),
  ('driver',    'passenger_aggressive','Passageiro agressivo / inseguro',40, false),
  ('driver',    'passenger_request', 'Passageiro pediu para cancelar',   50, true),
  ('driver',    'other',             'Outro motivo',                     99, true)
ON CONFLICT (role, code) DO NOTHING;

-- =============================================================
-- 3) Novos campos em rides
-- =============================================================
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancel_reason_code text,
  ADD COLUMN IF NOT EXISTS cancel_reason_note text;

-- =============================================================
-- 4) Atualizar função cancel_ride para receber código + nota
-- =============================================================
CREATE OR REPLACE FUNCTION public.cancel_ride(
  _ride_id uuid,
  _reason text,
  _reason_code text DEFAULT NULL,
  _reason_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Janela de cortesia (a partir do aceite do motorista)
  _ref := COALESCE(_r.arrived_at, _r.started_at, _r.updated_at);
  IF _r.status = 'requested' THEN
    _within_grace := true;
  ELSE
    _within_grace := EXTRACT(EPOCH FROM (_now - _ref)) <= _grace;
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
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ride(uuid, text, text, text) TO authenticated;

-- =============================================================
-- 5) RPCs de admin para gerir motivos
-- =============================================================
CREATE OR REPLACE FUNCTION public.admin_upsert_cancellation_reason(
  _id uuid,
  _role text,
  _code text,
  _label text,
  _description text,
  _sort_order int,
  _active boolean,
  _counts_as_punishment boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id uuid;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid())) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  IF _role NOT IN ('passenger', 'driver') THEN
    RAISE EXCEPTION 'Role inválida';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.cancellation_reasons
      (role, code, label, description, sort_order, active, counts_as_punishment)
    VALUES (_role, _code, _label, NULLIF(trim(_description), ''),
            COALESCE(_sort_order, 0), COALESCE(_active, true), COALESCE(_counts_as_punishment, true))
    RETURNING id INTO _new_id;
  ELSE
    UPDATE public.cancellation_reasons
       SET role = _role,
           code = _code,
           label = _label,
           description = NULLIF(trim(_description), ''),
           sort_order = COALESCE(_sort_order, 0),
           active = COALESCE(_active, true),
           counts_as_punishment = COALESCE(_counts_as_punishment, true)
     WHERE id = _id
     RETURNING id INTO _new_id;
  END IF;
  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_cancellation_reason(uuid, text, text, text, text, int, boolean, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_cancellation_reason(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid())) THEN
    RAISE EXCEPTION 'Apenas administradores';
  END IF;
  DELETE FROM public.cancellation_reasons WHERE id = _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_cancellation_reason(uuid) TO authenticated;
