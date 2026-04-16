-- Habilita extensão pg_trgm primeiro
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Tabela de cache de locais
CREATE TABLE public.places (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT,
  types TEXT[] DEFAULT '{}',
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'BR',
  rating NUMERIC,
  user_ratings_total INTEGER,
  raw JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_places_city ON public.places(city);
CREATE INDEX idx_places_category ON public.places(category);
CREATE INDEX idx_places_geo ON public.places(lat, lng);
CREATE INDEX idx_places_name_trgm ON public.places USING gin (name gin_trgm_ops);
CREATE INDEX idx_places_address_trgm ON public.places USING gin (address gin_trgm_ops);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view places"
ON public.places FOR SELECT
USING (true);

CREATE POLICY "Admins can manage places"
ON public.places FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_places_updated_at
BEFORE UPDATE ON public.places
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Controle de sync por cidade
CREATE TABLE public.city_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_key TEXT NOT NULL UNIQUE,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL,
  places_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.city_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sync log"
ON public.city_sync_log FOR SELECT USING (true);

CREATE POLICY "Admins can manage sync log"
ON public.city_sync_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Função de busca por texto + proximidade
CREATE OR REPLACE FUNCTION public.search_places(
  _query TEXT,
  _lat DOUBLE PRECISION DEFAULT NULL,
  _lng DOUBLE PRECISION DEFAULT NULL,
  _limit INTEGER DEFAULT 15,
  _max_km DOUBLE PRECISION DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  google_place_id TEXT,
  name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  category TEXT,
  distance_km DOUBLE PRECISION,
  similarity REAL
)
LANGUAGE sql STABLE SET search_path = public AS $$
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
    GREATEST(similarity(p.name, COALESCE(_query, '')), similarity(p.address, COALESCE(_query, ''))) AS similarity
  FROM public.places p
  WHERE
    (_query IS NULL OR _query = '' OR p.name ILIKE '%' || _query || '%' OR p.address ILIKE '%' || _query || '%' OR similarity(p.name, _query) > 0.2)
    AND (
      _lat IS NULL OR _lng IS NULL OR public.haversine_km(_lat, _lng, p.lat, p.lng) <= _max_km
    )
  ORDER BY
    similarity DESC,
    distance_km ASC NULLS LAST
  LIMIT _limit;
$$;