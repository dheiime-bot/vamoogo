-- 1) PRIVILEGE ESCALATION em public.user_roles
DROP POLICY IF EXISTS "Only admins manage roles - insert" ON public.user_roles;
CREATE POLICY "Only admins manage roles - insert"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Only admins manage roles - update" ON public.user_roles;
CREATE POLICY "Only admins manage roles - update"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Only admins manage roles - delete" ON public.user_roles;
CREATE POLICY "Only admins manage roles - delete"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  );

-- 2) Mensagens de suporte
DROP POLICY IF EXISTS "Users insert messages on own tickets" ON public.support_messages;
CREATE POLICY "Users insert messages on own tickets"
  ON public.support_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND t.user_id = auth.uid()
    )
  );

-- 3) platform_settings
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.platform_settings;

DROP POLICY IF EXISTS "Admins read all settings" ON public.platform_settings;
CREATE POLICY "Admins read all settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_master(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated read public settings" ON public.platform_settings;
CREATE POLICY "Authenticated read public settings"
  ON public.platform_settings
  FOR SELECT
  TO authenticated
  USING (
    key IN (
      'cancellation_rules',
      'tariffs_public',
      'platform_fee_percent'
    )
  );

-- 4) Realtime: exige autenticação
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'realtime' AND c.relname = 'messages'
  ) THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can publish realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can use realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "Authenticated can publish realtime" ON realtime.messages FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;