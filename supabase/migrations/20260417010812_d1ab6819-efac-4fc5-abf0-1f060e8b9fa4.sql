-- 1. Novos valores de enum
ALTER TYPE driver_status ADD VALUE IF NOT EXISTS 'cadastro_enviado';
ALTER TYPE driver_status ADD VALUE IF NOT EXISTS 'em_analise';
ALTER TYPE driver_status ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE driver_status ADD VALUE IF NOT EXISTS 'reprovado';
ALTER TYPE driver_status ADD VALUE IF NOT EXISTS 'pendente_documentos';

-- 2. Novos campos em drivers
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_brand text,
  ADD COLUMN IF NOT EXISTS vehicle_year integer,
  ADD COLUMN IF NOT EXISTS crlv_url text,
  ADD COLUMN IF NOT EXISTS selfie_with_document_url text,
  ADD COLUMN IF NOT EXISTS pix_holder_name text,
  ADD COLUMN IF NOT EXISTS analysis_message text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analyzed_by uuid;

-- 3. Unicidade de placa
CREATE UNIQUE INDEX IF NOT EXISTS drivers_vehicle_plate_unique_idx
  ON public.drivers (upper(vehicle_plate)) WHERE vehicle_plate IS NOT NULL;

-- 4. Bucket privado para documentos do motorista
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Policies do bucket
DROP POLICY IF EXISTS "Drivers upload own documents" ON storage.objects;
CREATE POLICY "Drivers upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Drivers view own documents" ON storage.objects;
CREATE POLICY "Drivers view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Drivers update own documents" ON storage.objects;
CREATE POLICY "Drivers update own documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
