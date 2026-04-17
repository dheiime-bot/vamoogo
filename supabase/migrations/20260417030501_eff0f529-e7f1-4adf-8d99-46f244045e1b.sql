DROP POLICY IF EXISTS "System inserts login_logs" ON public.login_logs;
CREATE POLICY "Insert own login_logs" ON public.login_logs
FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid());