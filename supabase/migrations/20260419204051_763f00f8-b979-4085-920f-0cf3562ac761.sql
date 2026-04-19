
-- 1. Campos em support_tickets
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ride_id uuid REFERENCES public.rides(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'central',
  ADD COLUMN IF NOT EXISTS last_read_by_user_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_support_tickets_ride_id ON public.support_tickets(ride_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON public.support_tickets(user_id, status);

-- 2. Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  message text NOT NULL,
  is_read_by_user boolean NOT NULL DEFAULT false,
  is_read_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ticket messages" ON public.support_messages;
CREATE POLICY "Users view own ticket messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Admins manage messages" ON public.support_messages;
CREATE POLICY "Admins manage messages"
  ON public.support_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()));

-- 3. Realtime — adiciona apenas a nova
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 4. Usuário adiciona mensagem ao próprio ticket
CREATE OR REPLACE FUNCTION public.user_add_ticket_message(_ticket_id uuid, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ticket record;
  _msg_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _message IS NULL OR length(trim(_message)) = 0 THEN
    RAISE EXCEPTION 'Mensagem vazia';
  END IF;

  SELECT * INTO _ticket FROM public.support_tickets WHERE id = _ticket_id;
  IF _ticket IS NULL THEN RAISE EXCEPTION 'Ticket não encontrado'; END IF;
  IF _ticket.user_id <> _uid THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _ticket.status = 'closed' THEN
    RAISE EXCEPTION 'Ticket está fechado. Abra um novo chamado.';
  END IF;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, message, is_read_by_admin, is_read_by_user)
  VALUES (_ticket_id, _uid, 'user', trim(_message), false, true)
  RETURNING id INTO _msg_id;

  UPDATE public.support_tickets
     SET status = CASE WHEN status = 'answered' THEN 'open' ELSE status END,
         last_message_at = now(),
         last_read_by_user_at = now(),
         updated_at = now()
   WHERE id = _ticket_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  SELECT ur.user_id, 'support_message', 'Nova mensagem em ticket',
         LEFT(_message, 120), '/admin/support',
         jsonb_build_object('ticket_id', _ticket_id)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'master'::app_role);

  RETURN _msg_id;
END $$;

-- 5. Admin adiciona mensagem
CREATE OR REPLACE FUNCTION public.admin_add_ticket_message(_ticket_id uuid, _message text, _close boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ticket record;
  _msg_id uuid;
  _new_status text;
  _link text;
BEGIN
  PERFORM public._require_admin();
  IF _message IS NULL OR length(trim(_message)) < 1 THEN
    RAISE EXCEPTION 'Mensagem vazia';
  END IF;

  SELECT * INTO _ticket FROM public.support_tickets WHERE id = _ticket_id;
  IF _ticket IS NULL THEN RAISE EXCEPTION 'Ticket não encontrado'; END IF;

  INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, message, is_read_by_admin, is_read_by_user)
  VALUES (_ticket_id, _uid, 'admin', trim(_message), true, false)
  RETURNING id INTO _msg_id;

  _new_status := CASE WHEN _close THEN 'closed' ELSE 'answered' END;
  _link := '/passenger/chats'; -- usuário acessa pelo Chat com a Central

  UPDATE public.support_tickets
     SET status = _new_status,
         admin_response = trim(_message),
         last_message_at = now(),
         updated_at = now()
   WHERE id = _ticket_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (_ticket.user_id, 'support_response',
          CASE WHEN _close THEN 'Suporte encerrou seu ticket' ELSE 'Suporte respondeu seu ticket' END,
          LEFT(_message, 120), _link,
          jsonb_build_object('ticket_id', _ticket_id));

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'support_ticket', _ticket_id::text, 'add_message',
          jsonb_build_object('status', _new_status, 'message', _message));

  RETURN _msg_id;
END $$;

-- 6. Marcar como lido
CREATE OR REPLACE FUNCTION public.user_mark_ticket_read(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  UPDATE public.support_tickets
     SET last_read_by_user_at = now()
   WHERE id = _ticket_id AND user_id = _uid;

  UPDATE public.support_messages
     SET is_read_by_user = true
   WHERE ticket_id = _ticket_id
     AND sender_role = 'admin'
     AND is_read_by_user = false
     AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = _uid);
END $$;

-- 7. Backfill: cria mensagens para tickets antigos
INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, message, is_read_by_user, is_read_by_admin, created_at)
SELECT t.id, t.user_id, 'user', t.message, true, true, t.created_at
FROM public.support_tickets t
WHERE NOT EXISTS (SELECT 1 FROM public.support_messages m WHERE m.ticket_id = t.id);

INSERT INTO public.support_messages (ticket_id, sender_id, sender_role, message, is_read_by_user, is_read_by_admin, created_at)
SELECT t.id, t.user_id, 'admin', t.admin_response, true, true, t.updated_at
FROM public.support_tickets t
WHERE t.admin_response IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.support_messages m
    WHERE m.ticket_id = t.id AND m.sender_role = 'admin'
  );
