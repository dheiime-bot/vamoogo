CREATE POLICY "Authenticated read whatsapp topup settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (key = 'whatsapp_topup');