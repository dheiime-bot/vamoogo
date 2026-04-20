
-- 1) FK cancelled_by: remover restrição rígida para auth.users.
-- Motivo: dispatch-ride usa UUID "system" (00000000-...) que não existe em auth.users
-- e quebra o auto-cancelamento. A coluna continua nullable; a integridade é validada na app.
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_cancelled_by_fkey;

-- 2) Storage: restringir acesso anônimo aos buckets sensíveis.
-- Mantemos upload anônimo APENAS na pasta signup/ (necessário no cadastro pré-auth).
-- Removemos leitura anônima e leitura pública de qualquer arquivo.

-- driver-documents
DROP POLICY IF EXISTS "Anon can read signup driver docs" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload signup driver docs" ON storage.objects;

CREATE POLICY "Signup uploads to driver-documents"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR (auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
  )
);

CREATE POLICY "Authenticated read driver-documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_master(auth.uid())
  )
);

-- selfies
DROP POLICY IF EXISTS "Anon can read signup selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload signup selfies" ON storage.objects;

CREATE POLICY "Signup uploads to selfies"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'selfies'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR (auth.uid() IS NOT NULL AND (auth.uid())::text = (storage.foldername(name))[1])
  )
);

CREATE POLICY "Authenticated read selfies"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR is_master(auth.uid())
  )
);

-- 3) Restringir SELECTs públicos (apenas autenticados podem ler)

-- coupons: apenas autenticados veem cupons ativos
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;
CREATE POLICY "Authenticated can view active coupons"
ON public.coupons FOR SELECT
TO authenticated
USING (active = true);

-- platform_settings: apenas autenticados
DROP POLICY IF EXISTS "Anyone can view settings" ON public.platform_settings;
CREATE POLICY "Authenticated can view settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- city_sync_log: apenas autenticados
DROP POLICY IF EXISTS "Anyone can view sync log" ON public.city_sync_log;
CREATE POLICY "Authenticated can view sync log"
ON public.city_sync_log FOR SELECT
TO authenticated
USING (true);

-- tariffs e places permanecem públicos (necessários para estimativa de preço e busca de endereços antes do login).
