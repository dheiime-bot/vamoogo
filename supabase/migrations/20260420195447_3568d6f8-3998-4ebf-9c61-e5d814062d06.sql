
-- Liberar bloqueio manual
CREATE OR REPLACE FUNCTION public.admin_clear_cancellation_block(_user_id UUID, _kind TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _admin UUID := auth.uid();
BEGIN
  IF NOT (has_role(_admin,'admin'::app_role) OR is_master(_admin)) THEN
    RAISE EXCEPTION 'Apenas admin' USING ERRCODE='42501';
  END IF;

  IF _kind = 'driver' THEN
    UPDATE public.drivers
       SET daily_cancellations = 0,
           cancellation_block_count = 0,
           cancellation_block_until = NULL
     WHERE user_id = _user_id;
  ELSIF _kind = 'passenger' THEN
    UPDATE public.profiles
       SET daily_cancellations = 0,
           cancellation_block_count = 0,
           cancellation_block_until = NULL
     WHERE user_id = _user_id;
  ELSE
    RAISE EXCEPTION 'Tipo inválido (use driver|passenger)';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (_admin, 'clear_cancellation_block', _kind, _user_id::text, jsonb_build_object('cleared_at', now()));

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, 'cancellation_unblocked',
          'Bloqueio liberado ✅',
          'Seu bloqueio por cancelamentos foi removido pela equipe. Você já pode usar a plataforma normalmente.',
          CASE WHEN _kind = 'driver' THEN '/driver' ELSE '/passenger' END);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_clear_cancellation_block(UUID, TEXT) TO authenticated;

-- Aplicar bloqueio manual
CREATE OR REPLACE FUNCTION public.admin_apply_cancellation_block(
  _user_id UUID, _kind TEXT, _hours INT, _reason TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin UUID := auth.uid();
  _until TIMESTAMPTZ;
BEGIN
  IF NOT (has_role(_admin,'admin'::app_role) OR is_master(_admin)) THEN
    RAISE EXCEPTION 'Apenas admin' USING ERRCODE='42501';
  END IF;
  IF _hours IS NULL OR _hours <= 0 OR _hours > 720 THEN
    RAISE EXCEPTION 'Horas inválidas (1..720)';
  END IF;

  _until := now() + (_hours || ' hours')::interval;

  IF _kind = 'driver' THEN
    UPDATE public.drivers
       SET cancellation_block_count = COALESCE(cancellation_block_count,0) + 1,
           cancellation_block_until = _until
     WHERE user_id = _user_id;
    UPDATE public.driver_locations SET is_online = false WHERE driver_id = _user_id;
  ELSIF _kind = 'passenger' THEN
    UPDATE public.profiles
       SET cancellation_block_count = COALESCE(cancellation_block_count,0) + 1,
           cancellation_block_until = _until
     WHERE user_id = _user_id;
  ELSE
    RAISE EXCEPTION 'Tipo inválido (use driver|passenger)';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, details)
  VALUES (_admin, 'apply_cancellation_block', _kind, _user_id::text,
          jsonb_build_object('hours', _hours, 'until', _until, 'reason', _reason));

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (_user_id, 'cancellation_block',
          'Bloqueio aplicado ⚠️',
          'Você foi bloqueado por ' || _hours || 'h por excesso de cancelamentos. Motivo: ' || COALESCE(_reason,'-') ||
          '. Liberação: ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || '.',
          CASE WHEN _kind = 'driver' THEN '/driver/status' ELSE '/passenger' END,
          jsonb_build_object('hours', _hours, 'until', _until, 'reason', _reason, 'manual', true));

  RETURN _until;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_apply_cancellation_block(UUID, TEXT, INT, TEXT) TO authenticated;
