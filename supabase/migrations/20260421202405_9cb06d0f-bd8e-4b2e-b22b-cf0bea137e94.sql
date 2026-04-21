ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.balance_adjustments REPLICA IDENTITY FULL;
ALTER TABLE public.wallet_topups REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='balance_adjustments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.balance_adjustments;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='wallet_topups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_topups;
  END IF;
END $$;