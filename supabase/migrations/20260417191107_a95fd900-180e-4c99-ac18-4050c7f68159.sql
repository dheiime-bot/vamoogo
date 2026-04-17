-- Tabela de auditoria de ajustes de saldo
CREATE TABLE IF NOT EXISTS public.balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('add','remove','set')),
  amount numeric NOT NULL,
  previous_balance numeric NOT NULL,
  new_balance numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_adjustments_driver ON public.balance_adjustments(driver_id, created_at DESC);

ALTER TABLE public.balance_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage balance adjustments"
  ON public.balance_adjustments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()));

CREATE POLICY "Drivers view own balance adjustments"
  ON public.balance_adjustments FOR SELECT
  USING (auth.uid() = driver_id);

-- RPC para ajustar saldo
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
  IF _amount IS NULL OR _amount < 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT balance INTO _prev FROM public.drivers WHERE user_id = _driver_id FOR UPDATE;
  IF _prev IS NULL THEN
    RAISE EXCEPTION 'Motorista não encontrado';
  END IF;

  IF _type = 'add' THEN
    _new := _prev + _amount;
  ELSIF _type = 'remove' THEN
    _new := GREATEST(0, _prev - _amount);
  ELSE
    _new := _amount;
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