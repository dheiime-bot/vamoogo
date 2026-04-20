
-- 1) Cancela imediatamente todas as corridas presas em 'requested' (sem motorista)
UPDATE public.rides
SET status = 'cancelled',
    cancelled_at = NOW(),
    cancelled_by = '00000000-0000-0000-0000-000000000000'::uuid
WHERE status = 'requested';

-- Marca quaisquer ofertas pendentes como expiradas
UPDATE public.ride_offers
SET status = 'expired'
WHERE status = 'pending';

-- 2) Função que auto-cancela corridas 'requested' com mais de 30s sem motorista.
-- Roda como SECURITY DEFINER para ignorar RLS; usada pelo cron e como rede de segurança.
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
        cancelled_by = '00000000-0000-0000-0000-000000000000'::uuid
    WHERE status = 'requested'
      AND created_at < NOW() - INTERVAL '30 seconds'
    RETURNING id
  )
  SELECT COUNT(*) INTO _count FROM stale;

  -- expira ofertas órfãs dessas corridas
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

-- 3) Agendar via pg_cron a cada 30 segundos
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove jobs antigos (idempotente)
DO $$
DECLARE _jobid bigint;
BEGIN
  FOR _jobid IN SELECT jobid FROM cron.job WHERE jobname IN ('auto-cancel-stale-rides-30s', 'auto-cancel-stale-rides-60s')
  LOOP
    PERFORM cron.unschedule(_jobid);
  END LOOP;
END $$;

-- pg_cron suporta sub-minuto (formato '30 seconds')
SELECT cron.schedule(
  'auto-cancel-stale-rides-30s',
  '30 seconds',
  $$ SELECT public.auto_cancel_stale_rides(); $$
);
