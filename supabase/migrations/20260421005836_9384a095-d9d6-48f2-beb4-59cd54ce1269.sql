DROP POLICY IF EXISTS "Ride participants can view active chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can mark active messages as read" ON public.chat_messages;

CREATE POLICY "Ride participants can view ride chat history"
ON public.chat_messages
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
  )
);

CREATE POLICY "Ride participants can mark ride messages as read"
ON public.chat_messages
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.admin_clear_cancellation_block(_user_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _admin UUID := auth.uid();
BEGIN
  IF NOT (has_role(_admin,'admin'::app_role) OR is_master(_admin)) THEN
    RAISE EXCEPTION 'Apenas admin' USING ERRCODE='42501';
  END IF;

  IF _kind = 'driver' THEN
    UPDATE public.drivers
       SET daily_cancellations = 0,
           cancellation_block_count = 0,
           cancellation_block_until = NULL,
           online_blocked = false,
           online_blocked_reason = NULL
     WHERE user_id = _user_id;

    UPDATE public.driver_locations
       SET is_online = false
     WHERE driver_id = _user_id;
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
          CASE WHEN _kind = 'driver'
            THEN 'Seu bloqueio por cancelamentos foi removido pela equipe. Você já pode voltar a ficar online normalmente.'
            ELSE 'Seu bloqueio por cancelamentos foi removido pela equipe. Você já pode usar a plataforma normalmente.'
          END,
          CASE WHEN _kind = 'driver' THEN '/driver' ELSE '/passenger' END);
END $function$;