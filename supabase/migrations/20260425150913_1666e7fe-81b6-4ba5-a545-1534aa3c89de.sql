ALTER TABLE public.tariffs
ADD COLUMN IF NOT EXISTS wait_free_minutes numeric NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS wait_per_minute numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS additional_km_rate numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tariffs.wait_free_minutes IS 'Free waiting time in minutes before wait charges apply.';
COMMENT ON COLUMN public.tariffs.wait_per_minute IS 'Amount charged per waiting minute after free waiting time.';
COMMENT ON COLUMN public.tariffs.additional_km_rate IS 'Amount charged per additional kilometer, used for route changes or extra distance.';