DROP POLICY IF EXISTS "Users can read own profile selfies" ON storage.objects;

CREATE POLICY "Users can read own profile selfies"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'selfies'
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        p.selfie_url = storage.objects.name
        OR p.selfie_signup_url = storage.objects.name
        OR p.selfie_url LIKE ('%' || storage.objects.name)
        OR p.selfie_signup_url LIKE ('%' || storage.objects.name)
      )
  )
);