-- 1. Adiciona novos campos em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS selfie_signup_url text;

-- 2. Garantir unicidade (limpa duplicatas vazias antes)
-- CPF
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cpf_unique'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_cpf_unique UNIQUE (cpf);
  END IF;
END $$;

-- Email (apenas quando não nulo)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

-- Telefone (apenas quando não nulo)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone) WHERE phone IS NOT NULL;

-- 3. Bucket privado para selfies
INSERT INTO storage.buckets (id, name, public)
VALUES ('selfies', 'selfies', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Policies do bucket selfies
DROP POLICY IF EXISTS "Users can upload own selfies" ON storage.objects;
CREATE POLICY "Users can upload own selfies"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view own selfies" ON storage.objects;
CREATE POLICY "Users can view own selfies"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'selfies'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Users can update own selfies" ON storage.objects;
CREATE POLICY "Users can update own selfies"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'selfies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Atualizar trigger handle_new_user para incluir birth_date e selfie_signup_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, email, phone, birth_date, selfie_signup_url, selfie_url, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'cpf', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NULLIF(NEW.raw_user_meta_data->>'birth_date','')::date,
    NEW.raw_user_meta_data->>'selfie_signup_url',
    NEW.raw_user_meta_data->>'selfie_signup_url',
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'passenger')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::app_role, 'passenger')
  );

  IF NEW.raw_user_meta_data->>'user_type' = 'driver' THEN
    INSERT INTO public.drivers (user_id, category)
    VALUES (
      NEW.id,
      COALESCE((NEW.raw_user_meta_data->>'category')::vehicle_category, 'economico')
    );
  END IF;

  RETURN NEW;
END;
$function$;
