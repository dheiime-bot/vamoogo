-- Garantir que passenger_coupons emita eventos de realtime completos
ALTER TABLE public.passenger_coupons REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'passenger_coupons'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_coupons';
  END IF;
END $$;