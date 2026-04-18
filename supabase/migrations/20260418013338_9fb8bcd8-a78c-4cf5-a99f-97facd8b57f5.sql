-- =========================================================
-- ADMIN RIDE ACTIONS — colunas + RPCs com auditoria
-- =========================================================

-- 1) Colunas extras na tabela rides
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS issue_flag text,            -- 'complaint' | 'fraud' | 'price_dispute' | etc.
  ADD COLUMN IF NOT EXISTS issue_reason text,
  ADD COLUMN IF NOT EXISTS issue_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_flagged_by uuid,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending', -- pending | paid | resolved
  ADD COLUMN IF NOT EXISTS payment_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS price_adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_adjusted_by uuid,
  ADD COLUMN IF NOT EXISTS original_price numeric;

-- 2) Função auxiliar: garante que chamador é admin/master
CREATE OR REPLACE FUNCTION public._require_admin()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (has_role(_uid, 'admin'::app_role) OR is_master(_uid)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
END $$;

-- 3) Cancelar corrida (com motivo) — só se não estiver finalizada
CREATE OR REPLACE FUNCTION public.admin_cancel_ride(_ride_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r record;
BEGIN
  PERFORM public._require_admin();
  SELECT * INTO _r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Corrida não encontrada'; END IF;
  IF _r.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Corrida já finalizada — não é possível cancelar';
  END IF;

  UPDATE public.rides
     SET status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = _uid,
         admin_notes  = COALESCE(admin_notes,'') ||
                        CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                        '[ADMIN CANCEL ' || to_char(now(),'DD/MM HH24:MI') || '] ' || COALESCE(_reason,'(sem motivo)')
   WHERE id = _ride_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'ride', _ride_id::text, 'cancel_ride',
          jsonb_build_object('reason', _reason, 'previous_status', _r.status));
END $$;

-- 4) Marcar problema (flag + motivo + observação opcional)
CREATE OR REPLACE FUNCTION public.admin_mark_ride_issue(
  _ride_id uuid, _flag text, _reason text, _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF _flag NOT IN ('complaint','fraud','price_dispute','other') THEN
    RAISE EXCEPTION 'Tipo de problema inválido';
  END IF;

  UPDATE public.rides
     SET issue_flag = _flag,
         issue_reason = _reason,
         issue_flagged_at = now(),
         issue_flagged_by = _uid,
         admin_notes = CASE
           WHEN _note IS NULL OR _note = '' THEN admin_notes
           ELSE COALESCE(admin_notes,'') ||
                CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                '[FLAG ' || _flag || ' ' || to_char(now(),'DD/MM HH24:MI') || '] ' || _note
         END
   WHERE id = _ride_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'ride', _ride_id::text, 'mark_issue',
          jsonb_build_object('flag', _flag, 'reason', _reason, 'note', _note));
END $$;

-- 5) Ajustar valor da corrida (motivo obrigatório, guarda valor anterior)
CREATE OR REPLACE FUNCTION public.admin_adjust_ride_price(
  _ride_id uuid, _new_price numeric, _reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r record; _old numeric; _new_fee numeric; _new_net numeric; _fee_pct numeric;
BEGIN
  PERFORM public._require_admin();
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 3 caracteres)';
  END IF;
  IF _new_price IS NULL OR _new_price < 0 OR _new_price > 5000 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT * INTO _r FROM public.rides WHERE id = _ride_id FOR UPDATE;
  IF _r IS NULL THEN RAISE EXCEPTION 'Corrida não encontrada'; END IF;
  _old := _r.price;

  -- Recalcula fee/net mantendo a mesma proporção atual da corrida (se existir).
  IF _r.price IS NOT NULL AND _r.price > 0 AND _r.platform_fee IS NOT NULL THEN
    _fee_pct := _r.platform_fee / _r.price;
  ELSE
    _fee_pct := 0.20; -- fallback
  END IF;
  _new_fee := round((_new_price * _fee_pct)::numeric, 2);
  _new_net := round((_new_price - _new_fee)::numeric, 2);

  UPDATE public.rides
     SET original_price = COALESCE(original_price, _old),
         price = _new_price,
         platform_fee = _new_fee,
         driver_net = _new_net,
         price_adjusted_at = now(),
         price_adjusted_by = _uid,
         admin_notes = COALESCE(admin_notes,'') ||
                       CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                       '[PRICE ' || to_char(now(),'DD/MM HH24:MI') || '] R$ ' ||
                       to_char(COALESCE(_old,0),'FM999G990D00') || ' → R$ ' ||
                       to_char(_new_price,'FM999G990D00') || ' — ' || _reason
   WHERE id = _ride_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'ride', _ride_id::text, 'adjust_price',
          jsonb_build_object('previous', _old, 'new', _new_price, 'reason', _reason,
                             'platform_fee', _new_fee, 'driver_net', _new_net));

  RETURN jsonb_build_object('previous_price', _old, 'new_price', _new_price,
                            'platform_fee', _new_fee, 'driver_net', _new_net);
END $$;

-- 6) Marcar pagamento como resolvido
CREATE OR REPLACE FUNCTION public.admin_resolve_ride_payment(
  _ride_id uuid, _new_status text, _note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF _new_status NOT IN ('pending','paid','resolved') THEN
    RAISE EXCEPTION 'Status de pagamento inválido';
  END IF;

  UPDATE public.rides
     SET payment_status = _new_status,
         payment_resolved_at = now(),
         payment_resolved_by = _uid,
         admin_notes = CASE
           WHEN _note IS NULL OR _note = '' THEN admin_notes
           ELSE COALESCE(admin_notes,'') ||
                CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                '[PAY ' || _new_status || ' ' || to_char(now(),'DD/MM HH24:MI') || '] ' || _note
         END
   WHERE id = _ride_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'ride', _ride_id::text, 'resolve_payment',
          jsonb_build_object('payment_status', _new_status, 'note', _note));
END $$;

-- 7) Adicionar observação interna avulsa
CREATE OR REPLACE FUNCTION public.admin_add_ride_note(_ride_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();
  IF _note IS NULL OR length(trim(_note)) = 0 THEN
    RAISE EXCEPTION 'Observação vazia';
  END IF;

  UPDATE public.rides
     SET admin_notes = COALESCE(admin_notes,'') ||
                       CASE WHEN admin_notes IS NULL OR admin_notes = '' THEN '' ELSE E'\n' END ||
                       '[NOTE ' || to_char(now(),'DD/MM HH24:MI') || '] ' || _note
   WHERE id = _ride_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'ride', _ride_id::text, 'add_note', jsonb_build_object('note', _note));
END $$;