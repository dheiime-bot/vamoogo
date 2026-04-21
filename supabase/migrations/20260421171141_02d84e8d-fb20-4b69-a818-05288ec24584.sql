CREATE OR REPLACE FUNCTION public.auto_cancel_stale_rides()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  WITH stale AS (
    UPDATE public.rides
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancelled_by = '00000000-0000-0000-0000-000000000000'::uuid,
        cancel_reason_code = COALESCE(cancel_reason_code, 'no_drivers_available'),
        cancel_reason_note = COALESCE(cancel_reason_note, 'Nenhum motorista disponível aceitou a corrida no tempo limite (3 min).')
    WHERE status = 'requested'
      AND created_at < NOW() - INTERVAL '3 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM stale;

  UPDATE public.ride_offers o
  SET status = 'expired'
  WHERE o.status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = o.ride_id AND r.status = 'cancelled'
    );

  RETURN _count;
END;
$$;