-- Sequence para códigos VAMOO começando em 1000
CREATE SEQUENCE IF NOT EXISTS public.ride_code_seq START 1000 INCREMENT 1;

-- Coluna ride_code única
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS ride_code text;

-- Função que gera o código no formato VAMOO{numero}
CREATE OR REPLACE FUNCTION public.set_ride_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ride_code IS NULL OR NEW.ride_code = '' THEN
    NEW.ride_code := 'VAMOO' || nextval('public.ride_code_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger antes do insert
DROP TRIGGER IF EXISTS trg_set_ride_code ON public.rides;
CREATE TRIGGER trg_set_ride_code
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.set_ride_code();

-- Backfill em corridas antigas sem código
UPDATE public.rides
SET ride_code = 'VAMOO' || nextval('public.ride_code_seq')::text
WHERE ride_code IS NULL;

-- Garantir unicidade e não nulidade
ALTER TABLE public.rides
  ALTER COLUMN ride_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rides_ride_code_unique_idx
  ON public.rides (ride_code);