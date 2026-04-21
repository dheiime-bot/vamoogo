
-- 1. Tabela de controle de cobrança
CREATE TABLE IF NOT EXISTS public.negative_balance_alerts (
  driver_id uuid PRIMARY KEY,
  days_remaining integer NOT NULL DEFAULT 30,
  first_alert_at timestamptz NOT NULL DEFAULT now(),
  last_alert_at timestamptz,
  last_manual_alert_at timestamptz,
  last_balance numeric NOT NULL DEFAULT 0,
  blocked_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negative_balance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage negative balance alerts"
ON public.negative_balance_alerts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE POLICY "Drivers view own alert"
ON public.negative_balance_alerts
FOR SELECT
TO authenticated
USING (auth.uid() = driver_id);

-- 2. Função: processamento diário automático
CREATE OR REPLACE FUNCTION public.process_negative_balance_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _driver record;
  _alert record;
  _new_days integer;
  _processed integer := 0;
  _blocked integer := 0;
  _resolved integer := 0;
  _title text;
  _message text;
BEGIN
  -- Resetar / encerrar alertas de motoristas que regularizaram
  UPDATE public.negative_balance_alerts a
  SET resolved_at = now(),
      updated_at = now()
  FROM public.drivers d
  WHERE a.driver_id = d.user_id
    AND a.resolved_at IS NULL
    AND d.balance >= 0;
  GET DIAGNOSTICS _resolved = ROW_COUNT;

  -- Para cada motorista com saldo negativo
  FOR _driver IN
    SELECT user_id, balance
    FROM public.drivers
    WHERE balance < 0
  LOOP
    -- Pega ou cria o registro de alerta
    SELECT * INTO _alert
    FROM public.negative_balance_alerts
    WHERE driver_id = _driver.user_id;

    IF _alert.driver_id IS NULL THEN
      -- Primeira cobrança: começa em 30
      INSERT INTO public.negative_balance_alerts (driver_id, days_remaining, last_alert_at, last_balance)
      VALUES (_driver.user_id, 30, now(), _driver.balance);
      _new_days := 30;
    ELSIF _alert.resolved_at IS NOT NULL THEN
      -- Voltou a ficar negativo: reinicia
      UPDATE public.negative_balance_alerts
      SET days_remaining = 30,
          first_alert_at = now(),
          last_alert_at = now(),
          last_balance = _driver.balance,
          resolved_at = NULL,
          blocked_at = NULL,
          updated_at = now()
      WHERE driver_id = _driver.user_id;
      _new_days := 30;
    ELSE
      -- Decrementa
      _new_days := GREATEST(0, _alert.days_remaining - 1);
      UPDATE public.negative_balance_alerts
      SET days_remaining = _new_days,
          last_alert_at = now(),
          last_balance = _driver.balance,
          updated_at = now()
      WHERE driver_id = _driver.user_id;
    END IF;

    -- Mensagem
    IF _new_days = 0 THEN
      _title := '🚫 Conta bloqueada por inadimplência';
      _message := format(
        'Sua conta foi bloqueada e inativada. Saldo devedor: R$ %s. Regularize o pagamento para reativar.',
        to_char(abs(_driver.balance), 'FM999990.00')
      );

      -- Bloqueia e inativa a conta
      UPDATE public.drivers
      SET online_blocked = true,
          online_blocked_reason = format('Inadimplência: 30 dias sem regularização. Saldo: R$ %s', to_char(_driver.balance, 'FM999990.00')),
          status = 'blocked',
          updated_at = now()
      WHERE user_id = _driver.user_id;

      -- Tira de online
      UPDATE public.driver_locations
      SET is_online = false,
          updated_at = now()
      WHERE driver_id = _driver.user_id;

      UPDATE public.negative_balance_alerts
      SET blocked_at = now(),
          updated_at = now()
      WHERE driver_id = _driver.user_id;

      _blocked := _blocked + 1;
    ELSE
      _title := format('⚠️ Regularize sua conta — %s dia(s) restante(s)', _new_days);
      _message := format(
        'Sua carteira está negativa em R$ %s. Você tem %s dia(s) para regularizar antes do bloqueio definitivo da conta.',
        to_char(abs(_driver.balance), 'FM999990.00'),
        _new_days
      );
    END IF;

    -- Envia notificação
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      _driver.user_id,
      CASE WHEN _new_days = 0 THEN 'account_blocked' ELSE 'negative_balance_alert' END,
      _title,
      _message,
      '/driver/wallet',
      jsonb_build_object(
        'days_remaining', _new_days,
        'balance', _driver.balance,
        'auto', true
      )
    );

    _processed := _processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed', _processed,
    'blocked', _blocked,
    'resolved', _resolved,
    'ran_at', now()
  );
END;
$$;

-- 3. Função: cobrança manual avulsa pelo admin
CREATE OR REPLACE FUNCTION public.admin_send_negative_balance_alert(_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance numeric;
  _days integer;
  _title text;
  _message text;
BEGIN
  PERFORM public._require_admin();

  SELECT balance INTO _balance FROM public.drivers WHERE user_id = _driver_id;
  IF _balance IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  IF _balance >= 0 THEN
    RAISE EXCEPTION 'Motorista não possui saldo negativo';
  END IF;

  SELECT days_remaining INTO _days
  FROM public.negative_balance_alerts
  WHERE driver_id = _driver_id AND resolved_at IS NULL;

  IF _days IS NULL THEN
    -- Cria registro inicial
    INSERT INTO public.negative_balance_alerts (driver_id, days_remaining, last_alert_at, last_manual_alert_at, last_balance)
    VALUES (_driver_id, 30, now(), now(), _balance)
    ON CONFLICT (driver_id) DO UPDATE
    SET last_manual_alert_at = now(),
        last_balance = EXCLUDED.last_balance,
        updated_at = now();
    _days := 30;
  ELSE
    UPDATE public.negative_balance_alerts
    SET last_manual_alert_at = now(),
        last_balance = _balance,
        updated_at = now()
    WHERE driver_id = _driver_id;
  END IF;

  _title := format('⚠️ Cobrança: regularize sua conta — %s dia(s) restante(s)', _days);
  _message := format(
    'Sua carteira está negativa em R$ %s. Você tem %s dia(s) para regularizar antes do bloqueio definitivo da conta.',
    to_char(abs(_balance), 'FM999990.00'),
    _days
  );

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (
    _driver_id,
    'negative_balance_alert',
    _title,
    _message,
    '/driver/wallet',
    jsonb_build_object(
      'days_remaining', _days,
      'balance', _balance,
      'auto', false,
      'manual', true
    )
  );

  RETURN jsonb_build_object('days_remaining', _days, 'balance', _balance, 'sent_at', now());
END;
$$;

-- 4. Habilita extensões para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 5. Agenda cron job diário às 12:00 UTC (09:00 BRT)
SELECT cron.unschedule('process-negative-balance-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-negative-balance-alerts');

SELECT cron.schedule(
  'process-negative-balance-alerts',
  '0 12 * * *',
  $$ SELECT public.process_negative_balance_alerts(); $$
);
