-- Permitir upload anônimo durante cadastro nos buckets selfies e driver-documents
-- Caminho deve começar com "signup/" para uploads pré-autenticação

-- SELFIES
DROP POLICY IF EXISTS "Anon can upload signup selfies" ON storage.objects;
CREATE POLICY "Anon can upload signup selfies"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'selfies'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Users can upload own selfies" ON storage.objects;

DROP POLICY IF EXISTS "Anon can read signup selfies" ON storage.objects;
CREATE POLICY "Anon can read signup selfies"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'selfies'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Users can view own selfies" ON storage.objects;

-- DRIVER DOCUMENTS
DROP POLICY IF EXISTS "Anon can upload signup driver docs" ON storage.objects;
CREATE POLICY "Anon can upload signup driver docs"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'driver-documents'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Drivers upload own documents" ON storage.objects;

DROP POLICY IF EXISTS "Anon can read signup driver docs" ON storage.objects;
CREATE POLICY "Anon can read signup driver docs"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'driver-documents'
  AND (
    (storage.foldername(name))[1] = 'signup'
    OR auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Drivers view own documents" ON storage.objects;