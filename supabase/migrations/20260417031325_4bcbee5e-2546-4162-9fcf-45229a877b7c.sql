ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;

-- Trigger de notificação: avisa o passageiro quando o motorista marca chegada
CREATE OR REPLACE FUNCTION public.notify_driver_arrived()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.arrived_at IS NOT NULL AND OLD.arrived_at IS NULL AND NEW.passenger_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      NEW.passenger_id,
      'ride_arrived',
      'Seu motorista chegou! 📍',
      'O motorista está te aguardando no local de embarque.',
      '/passenger',
      jsonb_build_object('ride_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_driver_arrived ON public.rides;
CREATE TRIGGER trg_notify_driver_arrived
AFTER UPDATE OF arrived_at ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.notify_driver_arrived();