ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS pix_key_type text CHECK (pix_key_type IN ('cpf','email','phone','random'));
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pix_paid_at timestamptz;