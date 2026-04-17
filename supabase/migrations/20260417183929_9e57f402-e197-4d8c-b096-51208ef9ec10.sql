
-- Garante REPLICA IDENTITY FULL para receber payloads completos
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.rides REPLICA IDENTITY FULL;
ALTER TABLE public.driver_locations REPLICA IDENTITY FULL;
ALTER TABLE public.coupons REPLICA IDENTITY FULL;
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.fraud_alerts REPLICA IDENTITY FULL;
ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.recharges REPLICA IDENTITY FULL;
ALTER TABLE public.tariffs REPLICA IDENTITY FULL;
ALTER TABLE public.staff_users REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER TABLE public.platform_settings REPLICA IDENTITY FULL;

-- Adiciona à publicação supabase_realtime (ignora se já existir)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'drivers','profiles','rides','driver_locations','coupons','campaigns',
    'support_tickets','fraud_alerts','incidents','withdrawals','recharges',
    'tariffs','staff_users','audit_logs','notifications','chat_messages',
    'user_roles','platform_settings'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;
