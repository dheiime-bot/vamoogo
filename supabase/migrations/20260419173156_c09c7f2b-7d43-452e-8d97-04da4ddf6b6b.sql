-- Garante schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- Remove e recria a extensão pg_trgm no schema correto
DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Recria a função search_places usando o schema extensions explicitamente
CREATE OR REPLACE FUNCTION public.search_places(
  _query text,
  _lat double precision DEFAULT NULL::double precision,
  _lng double precision DEFAULT NULL::double precision,
  _limit integer DEFAULT 15,
  _max_km double precision DEFAULT 30
)
RETURNS TABLE(
  id uuid,
  google_place_id text,
  name text,
  address text,
  lat double precision,
  lng double precision,
  category text,
  distance_km double precision,
  similarity real
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    p.id,
    p.google_place_id,
    p.name,
    p.address,
    p.lat,
    p.lng,
    p.category,
    CASE WHEN _lat IS NOT NULL AND _lng IS NOT NULL
      THEN public.haversine_km(_lat, _lng, p.lat, p.lng)
      ELSE NULL END AS distance_km,
    GREATEST(
      extensions.similarity(p.name, COALESCE(_query, '')),
      extensions.similarity(p.address, COALESCE(_query, ''))
    ) AS similarity
  FROM public.places p
  WHERE
    (_query IS NULL OR _query = ''
      OR p.name ILIKE '%' || _query || '%'
      OR p.address ILIKE '%' || _query || '%'
      OR extensions.similarity(p.name, _query) > 0.2)
    AND (
      _lat IS NULL OR _lng IS NULL
      OR public.haversine_km(_lat, _lng, p.lat, p.lng) <= _max_km
    )
  ORDER BY similarity DESC, distance_km ASC NULLS LAST
  LIMIT _limit;
$function$;