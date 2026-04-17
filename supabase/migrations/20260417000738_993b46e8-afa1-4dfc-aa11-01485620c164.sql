-- 0. PRÉ-LIMPEZA: deduplica tarifas que iriam colidir (car + premium → economico na mesma região)
-- Para cada região onde existem múltiplas tarifas não-moto, mantém apenas uma (a mais cara, melhor para o motorista).
WITH ranked AS (
  SELECT id, region,
         ROW_NUMBER() OVER (
           PARTITION BY region
           ORDER BY base_fare DESC, per_km DESC, id
         ) AS rn
  FROM public.tariffs
  WHERE category::text IN ('car', 'premium')
)
DELETE FROM public.tariffs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 1. Cria o novo enum
CREATE TYPE public.vehicle_category_new AS ENUM ('moto', 'economico', 'conforto');

-- 2. Remove defaults
ALTER TABLE public.drivers ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.driver_locations ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.rides ALTER COLUMN category DROP DEFAULT;

-- 3. Converte colunas
ALTER TABLE public.drivers
  ALTER COLUMN category TYPE public.vehicle_category_new
  USING (CASE category::text WHEN 'moto' THEN 'moto' ELSE 'economico' END)::public.vehicle_category_new;

ALTER TABLE public.driver_locations
  ALTER COLUMN category TYPE public.vehicle_category_new
  USING (CASE category::text WHEN 'moto' THEN 'moto' ELSE 'economico' END)::public.vehicle_category_new;

ALTER TABLE public.rides
  ALTER COLUMN category TYPE public.vehicle_category_new
  USING (CASE category::text WHEN 'moto' THEN 'moto' ELSE 'economico' END)::public.vehicle_category_new;

ALTER TABLE public.tariffs
  ALTER COLUMN category TYPE public.vehicle_category_new
  USING (CASE category::text WHEN 'moto' THEN 'moto' ELSE 'economico' END)::public.vehicle_category_new;

-- 4. Atualiza assinatura da função
DROP FUNCTION IF EXISTS public.find_nearest_drivers(double precision, double precision, public.vehicle_category, integer, double precision);

-- 5. Substitui o enum
DROP TYPE public.vehicle_category;
ALTER TYPE public.vehicle_category_new RENAME TO vehicle_category;

-- 6. Recria defaults
ALTER TABLE public.drivers          ALTER COLUMN category SET DEFAULT 'economico'::public.vehicle_category;
ALTER TABLE public.driver_locations ALTER COLUMN category SET DEFAULT 'economico'::public.vehicle_category;
ALTER TABLE public.rides            ALTER COLUMN category SET DEFAULT 'economico'::public.vehicle_category;

-- 7. Recria find_nearest_drivers
CREATE OR REPLACE FUNCTION public.find_nearest_drivers(
  _lat double precision,
  _lng double precision,
  _category public.vehicle_category,
  _limit integer DEFAULT 5,
  _max_km double precision DEFAULT 20
)
RETURNS TABLE(driver_id uuid, distance_km double precision, lat double precision, lng double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT dl.driver_id,
         public.haversine_km(_lat, _lng, dl.lat, dl.lng) AS distance_km,
         dl.lat, dl.lng
  FROM public.driver_locations dl
  JOIN public.drivers d ON d.user_id = dl.driver_id
  WHERE dl.is_online = true
    AND dl.category = _category
    AND d.status = 'approved'
    AND d.balance >= 5
    AND NOT EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.driver_id = dl.driver_id AND r.status IN ('accepted','in_progress')
    )
    AND public.haversine_km(_lat, _lng, dl.lat, dl.lng) <= _max_km
  ORDER BY distance_km ASC
  LIMIT _limit;
$function$;

-- 8. Garante tarifas padrão para todas as novas categorias na região "default"
INSERT INTO public.tariffs (category, region, base_fare, per_km, per_minute, min_fare, region_multiplier, passenger_extra)
VALUES
  ('moto'::public.vehicle_category,      'default', 4.00, 1.20, 0.30,  7.00, 1.0, 1.00),
  ('economico'::public.vehicle_category, 'default', 5.00, 1.80, 0.45, 12.00, 1.0, 2.00),
  ('conforto'::public.vehicle_category,  'default', 7.00, 2.50, 0.60, 18.00, 1.0, 3.00)
ON CONFLICT (category, region) DO NOTHING;