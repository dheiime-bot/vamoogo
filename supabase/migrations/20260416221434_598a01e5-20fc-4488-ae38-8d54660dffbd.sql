ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'gps',
  ADD COLUMN IF NOT EXISTS for_other_person boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS other_person_name text,
  ADD COLUMN IF NOT EXISTS other_person_phone text;