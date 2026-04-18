ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS driver_rating integer,
  ADD COLUMN IF NOT EXISTS driver_rating_comment text,
  ADD COLUMN IF NOT EXISTS rating_comment text;