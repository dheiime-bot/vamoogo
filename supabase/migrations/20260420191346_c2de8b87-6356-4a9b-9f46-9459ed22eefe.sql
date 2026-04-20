
CREATE OR REPLACE FUNCTION public.block_ride_for_blocked_passenger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _status public.passenger_status;
BEGIN
  SELECT status INTO _status FROM public.profiles WHERE user_id = NEW.passenger_id;
  IF _status = 'bloqueado'::public.passenger_status THEN
    RAISE EXCEPTION 'Sua conta está bloqueada. Entre em contato com o suporte.' USING ERRCODE = 'P0001';
  ELSIF _status = 'suspenso'::public.passenger_status THEN
    RAISE EXCEPTION 'Sua conta está suspensa. Entre em contato com o suporte.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_block_ride_for_blocked_passenger ON public.rides;
CREATE TRIGGER trg_block_ride_for_blocked_passenger
BEFORE INSERT ON public.rides
FOR EACH ROW EXECUTE FUNCTION public.block_ride_for_blocked_passenger();
