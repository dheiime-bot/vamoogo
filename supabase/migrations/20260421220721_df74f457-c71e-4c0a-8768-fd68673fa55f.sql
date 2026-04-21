-- ============================================================================
-- Saldo da carteira do motorista pode ficar NEGATIVO quando a taxa da corrida
-- for maior que o saldo disponível.
-- 
-- Mudanças:
-- 1. Tabela `ride_fee_debits` para garantir débito idempotente da taxa por corrida.
-- 2. Trigger que debita a `platform_fee` do `drivers.balance` quando a corrida vira 'completed'.
-- 3. Remove o clamp em 0 da função `admin_adjust_balance` (permite saldo negativo).
-- 4. Backfill: debita todas as taxas das corridas já completadas que ainda não foram cobradas.
-- ============================================================================

-- 1) Tabela auxiliar para garantir que cada corrida só debite a taxa UMA vez
CREATE TABLE IF NOT EXISTS public.ride_fee_debits (
  ride_id uuid PRIMARY KEY REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  fee_amount numeric NOT NULL,
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  debited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ride_fee_debits_driver ON public.ride_fee_debits(driver_id, debited_at DESC);

ALTER TABLE public.ride_fee_debits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fee debits"
  ON public.ride_fee_debits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()));

CREATE POLICY "Drivers view own fee debits"
  ON public.ride_fee_debits FOR SELECT
  USING (auth.uid() = driver_id);

-- 2) Função que debita a taxa do saldo do motorista (permite negativo)
CREATE OR REPLACE FUNCTION public.debit_ride_fee(_ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ride record;
  _prev numeric;
  _new numeric;
BEGIN
  SELECT id, driver_id, status, platform_fee
    INTO _ride
    FROM public.rides
   WHERE id = _ride_id
   FOR UPDATE;

  IF NOT FOUND OR _ride.driver_id IS NULL OR _ride.status <> 'completed' THEN
    RETURN;
  END IF;

  IF COALESCE(_ride.platform_fee, 0) <= 0 THEN
    RETURN;
  END IF;

  -- Idempotência: se já debitou esta corrida, não cobra de novo
  IF EXISTS (SELECT 1 FROM public.ride_fee_debits WHERE ride_id = _ride.id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(balance, 0) INTO _prev
    FROM public.drivers
   WHERE user_id = _ride.driver_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- IMPORTANTE: NÃO usa GREATEST — saldo pode ficar negativo
  _new := _prev - _ride.platform_fee;

  UPDATE public.drivers
     SET balance = _new, updated_at = now()
   WHERE user_id = _ride.driver_id;

  INSERT INTO public.ride_fee_debits (ride_id, driver_id, fee_amount, previous_balance, new_balance)
  VALUES (_ride.id, _ride.driver_id, _ride.platform_fee, _prev, _new);
END;
$$;

REVOKE ALL ON FUNCTION public.debit_ride_fee(uuid) FROM PUBLIC;

-- 3) Trigger no UPDATE de rides: ao virar completed, debita taxa
CREATE OR REPLACE FUNCTION public.trg_debit_ride_fee_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.driver_id IS NOT NULL
     AND COALESCE(NEW.platform_fee, 0) > 0
  THEN
    PERFORM public.debit_ride_fee(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_debit_ride_fee_on_complete ON public.rides;
CREATE TRIGGER trg_debit_ride_fee_on_complete
AFTER UPDATE OF status ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.trg_debit_ride_fee_on_complete();

-- 4) Remove o clamp (GREATEST 0) em admin_adjust_balance — permite negativo
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  _driver_id uuid,
  _type text,
  _amount numeric,
  _reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _prev numeric;
  _new numeric;
  _adj_id uuid;
  _notif_title text;
  _notif_msg text;
BEGIN
  IF _admin IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT (public.has_role(_admin, 'admin'::app_role) OR public.is_master(_admin)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _type NOT IN ('add','remove','set') THEN
    RAISE EXCEPTION 'Tipo inválido. Use add, remove ou set';
  END IF;
  IF _amount IS NULL THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT balance INTO _prev FROM public.drivers WHERE user_id = _driver_id FOR UPDATE;
  IF _prev IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  IF _type = 'add' THEN
    _new := _prev + _amount;
  ELSIF _type = 'remove' THEN
    _new := _prev - _amount;  -- permite negativo
  ELSE
    _new := _amount;          -- 'set' aceita qualquer valor
  END IF;

  UPDATE public.drivers SET balance = _new, updated_at = now() WHERE user_id = _driver_id;

  INSERT INTO public.balance_adjustments (driver_id, admin_id, type, amount, previous_balance, new_balance, reason)
  VALUES (_driver_id, _admin, _type, _amount, _prev, _new, _reason)
  RETURNING id INTO _adj_id;

  IF _type = 'add' THEN
    _notif_title := 'Saldo creditado 💰';
    _notif_msg := 'Foram adicionados R$ ' || to_char(_amount, 'FM999G990D00') || ' ao seu saldo. Novo saldo: R$ ' || to_char(_new, 'FM999G990D00') || COALESCE('. Motivo: ' || _reason, '');
  ELSIF _type = 'remove' THEN
    _notif_title := 'Saldo ajustado';
    _notif_msg := 'Foram retirados R$ ' || to_char(_amount, 'FM999G990D00') || ' do seu saldo. Novo saldo: R$ ' || to_char(_new, 'FM999G990D00') || COALESCE('. Motivo: ' || _reason, '');
  ELSE
    _notif_title := 'Saldo ajustado';
    _notif_msg := 'Seu saldo foi ajustado para R$ ' || to_char(_new, 'FM999G990D00') || COALESCE('. Motivo: ' || _reason, '');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (_driver_id, 'balance_adjustment', _notif_title, _notif_msg, '/driver/wallet',
          jsonb_build_object('adjustment_id', _adj_id, 'previous', _prev, 'new', _new, 'amount', _amount, 'kind', _type));

  RETURN jsonb_build_object('id', _adj_id, 'previous_balance', _prev, 'new_balance', _new);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, text, numeric, text) TO authenticated;

-- 5) Backfill: debita as taxas de TODAS as corridas completadas que ainda não foram cobradas.
-- Considera apenas corridas concluídas APÓS o último reset/set de saldo do admin
-- (para não debitar taxas de corridas que já estavam contabilizadas antes).
DO $$
DECLARE
  _r record;
BEGIN
  FOR _r IN
    SELECT r.id
      FROM public.rides r
      LEFT JOIN public.ride_fee_debits d ON d.ride_id = r.id
     WHERE r.status = 'completed'
       AND r.driver_id IS NOT NULL
       AND COALESCE(r.platform_fee, 0) > 0
       AND d.ride_id IS NULL
       AND r.completed_at >= COALESCE(
         (SELECT MAX(created_at) FROM public.balance_adjustments ba
           WHERE ba.driver_id = r.driver_id AND ba.type = 'set'),
         '1900-01-01'::timestamptz
       )
     ORDER BY r.completed_at ASC
  LOOP
    PERFORM public.debit_ride_fee(_r.id);
  END LOOP;
END $$;