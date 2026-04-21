DROP POLICY IF EXISTS "Admins can manage settings" ON public.platform_settings;

CREATE POLICY "Admins and master can manage settings"
ON public.platform_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid()));