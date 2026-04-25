CREATE TABLE IF NOT EXISTS public.site_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  whatsapp text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  has_drivers boolean,
  driver_count integer,
  message text,
  source text NOT NULL DEFAULT 'site',
  status text NOT NULL DEFAULT 'new',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_leads_name_len CHECK (char_length(trim(name)) BETWEEN 2 AND 100),
  CONSTRAINT site_leads_whatsapp_format CHECK (whatsapp ~ '^\+?[0-9]{10,15}$'),
  CONSTRAINT site_leads_city_len CHECK (char_length(trim(city)) BETWEEN 2 AND 100),
  CONSTRAINT site_leads_state_len CHECK (char_length(trim(state)) BETWEEN 2 AND 50),
  CONSTRAINT site_leads_driver_count_range CHECK (driver_count IS NULL OR (driver_count >= 0 AND driver_count <= 100000)),
  CONSTRAINT site_leads_message_len CHECK (message IS NULL OR char_length(trim(message)) <= 1000),
  CONSTRAINT site_leads_status_allowed CHECK (status IN ('new', 'contacted', 'qualified', 'archived')),
  CONSTRAINT site_leads_source_len CHECK (char_length(trim(source)) BETWEEN 2 AND 50)
);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.normalize_site_lead()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := trim(NEW.name);
  NEW.whatsapp := regexp_replace(COALESCE(NEW.whatsapp, ''), '[^0-9+]', '', 'g');
  NEW.city := trim(NEW.city);
  NEW.state := trim(NEW.state);
  NEW.message := NULLIF(trim(COALESCE(NEW.message, '')), '');
  NEW.source := trim(COALESCE(NEW.source, 'site'));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_site_lead_before_write ON public.site_leads;
CREATE TRIGGER normalize_site_lead_before_write
BEFORE INSERT OR UPDATE ON public.site_leads
FOR EACH ROW
EXECUTE FUNCTION public.normalize_site_lead();

DROP POLICY IF EXISTS "Anyone can create site leads" ON public.site_leads;
CREATE POLICY "Anyone can create site leads"
ON public.site_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (source = 'site' AND status = 'new');

DROP POLICY IF EXISTS "Admins can manage site leads" ON public.site_leads;
CREATE POLICY "Admins can manage site leads"
ON public.site_leads
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_site_leads_created_at ON public.site_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_leads_status ON public.site_leads (status);