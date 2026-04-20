-- Substitui a função admin_delete_user por SOFT-DELETE.
-- Em vez de apagar o profile (o que quebra histórico de corridas, chats, etc.),
-- apenas marca a conta como bloqueada permanentemente.
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Apenas admin/master pode bloquear contas';
  END IF;

  -- SOFT-DELETE: apenas bloqueia o profile. NÃO deleta nada para preservar
  -- histórico de corridas, chats, avaliações e auditoria.
  UPDATE public.profiles
     SET status = 'bloqueado',
         blocked_reason = COALESCE(blocked_reason, 'Conta removida pelo admin'),
         blocked_at = COALESCE(blocked_at, now()),
         blocked_by = auth.uid(),
         updated_at = now()
   WHERE user_id = _user_id;

  -- Se for motorista, também marca como bloqueado e tira do online
  UPDATE public.drivers
     SET status = 'blocked',
         online_blocked = true,
         online_blocked_reason = COALESCE(online_blocked_reason, 'Conta removida pelo admin'),
         updated_at = now()
   WHERE user_id = _user_id;

  -- Tira de online imediatamente
  UPDATE public.driver_locations
     SET is_online = false,
         updated_at = now()
   WHERE driver_id = _user_id;
END;
$function$;