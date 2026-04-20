DO $$
DECLARE
  t text;
  tables_to_remove text[] := ARRAY[
    'audit_logs',
    'staff_users',
    'fraud_alerts',
    'incidents',
    'campaigns',
    'coupons',
    'tariffs',
    'platform_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_remove LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;