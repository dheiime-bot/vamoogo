-- 1) Trigger: quando ride.status passa para 'completed', forçar payment_status = 'paid'
CREATE OR REPLACE FUNCTION public._auto_mark_ride_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'::ride_status
     AND (OLD.status IS DISTINCT FROM NEW.status OR NEW.payment_status IS DISTINCT FROM 'paid')
     AND COALESCE(NEW.payment_status, 'pending') <> 'paid' THEN
    NEW.payment_status := 'paid';
    IF NEW.payment_resolved_at IS NULL THEN
      NEW.payment_resolved_at := now();
    END IF;
    -- PIX: marcar pix_paid_at se ainda não estiver
    IF NEW.payment_method = 'pix'::payment_method AND NEW.pix_paid_at IS NULL THEN
      NEW.pix_paid_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_mark_ride_paid ON public.rides;
CREATE TRIGGER trg_auto_mark_ride_paid
BEFORE INSERT OR UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public._auto_mark_ride_paid();

-- 2) Backfill: todas as corridas já concluídas viram 'paid'
UPDATE public.rides
   SET payment_status = 'paid',
       payment_resolved_at = COALESCE(payment_resolved_at, completed_at, now()),
       pix_paid_at = CASE
         WHEN payment_method = 'pix'::payment_method AND pix_paid_at IS NULL
         THEN COALESCE(completed_at, now())
         ELSE pix_paid_at
       END
 WHERE status = 'completed'::ride_status
   AND COALESCE(payment_status, 'pending') <> 'paid';