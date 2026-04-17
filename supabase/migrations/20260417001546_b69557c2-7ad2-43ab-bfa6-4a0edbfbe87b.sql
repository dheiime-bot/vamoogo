-- =========================================================
-- 1. Tabela notifications
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('chat','ride_status','low_balance','admin','system')),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 2. RLS
-- =========================================================
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications as read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- (Sem policy de INSERT para "authenticated"; gatilhos rodam como SECURITY DEFINER)

-- =========================================================
-- 3. Realtime
-- =========================================================
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- =========================================================
-- 4. Trigger: nova mensagem de chat -> notifica o outro lado
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ride_record RECORD;
  recipient_id UUID;
  sender_name TEXT;
  link_to TEXT;
BEGIN
  SELECT passenger_id, driver_id INTO ride_record FROM public.rides WHERE id = NEW.ride_id;
  IF ride_record.passenger_id = NEW.sender_id THEN
    recipient_id := ride_record.driver_id;
    link_to := '/driver/chats';
  ELSE
    recipient_id := ride_record.passenger_id;
    link_to := '/passenger/chats';
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Alguém') INTO sender_name
  FROM public.profiles WHERE user_id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (
    recipient_id,
    'chat',
    sender_name || ' enviou uma mensagem',
    LEFT(NEW.message, 120),
    link_to,
    jsonb_build_object('ride_id', NEW.ride_id, 'sender_id', NEW.sender_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_chat_message
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();

-- =========================================================
-- 5. Trigger: status da corrida muda
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_ride_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  passenger_title TEXT;
  passenger_msg TEXT;
  driver_title TEXT;
  driver_msg TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'accepted' THEN
      passenger_title := 'Motorista a caminho 🚗';
      passenger_msg := 'Um motorista aceitou sua corrida.';
      driver_title := 'Corrida aceita';
      driver_msg := 'Você aceitou uma nova corrida.';
    WHEN 'in_progress' THEN
      passenger_title := 'Corrida iniciada';
      passenger_msg := 'Boa viagem!';
      driver_title := 'Corrida iniciada';
      driver_msg := 'Em direção ao destino.';
    WHEN 'completed' THEN
      passenger_title := 'Corrida finalizada ✅';
      passenger_msg := 'Esperamos que tenha sido uma boa viagem.';
      driver_title := 'Corrida finalizada';
      driver_msg := 'Ganhos creditados na sua carteira.';
    WHEN 'cancelled' THEN
      passenger_title := 'Corrida cancelada';
      passenger_msg := 'Sua corrida foi cancelada.';
      driver_title := 'Corrida cancelada';
      driver_msg := 'A corrida foi cancelada.';
    ELSE
      RETURN NEW;
  END CASE;

  IF NEW.passenger_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (NEW.passenger_id, 'ride_status', passenger_title, passenger_msg, '/passenger', jsonb_build_object('ride_id', NEW.id, 'status', NEW.status));
  END IF;

  IF NEW.driver_id IS NOT NULL AND NEW.status IN ('in_progress','completed','cancelled') THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (NEW.driver_id, 'ride_status', driver_title, driver_msg, '/driver', jsonb_build_object('ride_id', NEW.id, 'status', NEW.status));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ride_status
AFTER UPDATE OF status ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.notify_ride_status();

-- =========================================================
-- 6. Trigger: saldo baixo do motorista
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_low_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só notifica quando cruza o limite de cima para baixo
  IF NEW.balance < 5 AND (OLD.balance IS NULL OR OLD.balance >= 5) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      NEW.user_id,
      'low_balance',
      'Saldo baixo na carteira ⚠️',
      'Seu saldo está abaixo de R$ 5,00. Recarregue para continuar recebendo corridas.',
      '/driver/wallet',
      jsonb_build_object('balance', NEW.balance)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_low_balance
AFTER UPDATE OF balance ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.notify_low_balance();