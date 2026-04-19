
-- 1) Adiciona rating no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating numeric NOT NULL DEFAULT 5.0;

-- 2) Garante default 5.0 no drivers.rating (existente é 0)
ALTER TABLE public.drivers
  ALTER COLUMN rating SET DEFAULT 5.0;

-- Atualiza drivers existentes que ainda estão com 0 e sem corridas avaliadas
UPDATE public.drivers d
SET rating = 5.0
WHERE (rating IS NULL OR rating = 0)
  AND NOT EXISTS (
    SELECT 1 FROM public.rides r WHERE r.driver_id = d.user_id AND r.rating IS NOT NULL
  );

-- 3) Tabela de recursos
CREATE TABLE IF NOT EXISTS public.rating_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL,
  passenger_id uuid NOT NULL,
  original_rating integer NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected'
  admin_response text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ride_id)
);

ALTER TABLE public.rating_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers view own appeals" ON public.rating_appeals;
CREATE POLICY "Drivers view own appeals"
  ON public.rating_appeals FOR SELECT
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admins manage appeals" ON public.rating_appeals;
CREATE POLICY "Admins manage appeals"
  ON public.rating_appeals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_rating_appeals_status ON public.rating_appeals(status);
CREATE INDEX IF NOT EXISTS idx_rating_appeals_driver ON public.rating_appeals(driver_id);

DROP TRIGGER IF EXISTS trg_rating_appeals_updated ON public.rating_appeals;
CREATE TRIGGER trg_rating_appeals_updated
  BEFORE UPDATE ON public.rating_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Funções de recálculo (piso 4.0, default 5.0 se não há avaliações)
CREATE OR REPLACE FUNCTION public.recalc_driver_rating(_driver_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _avg numeric; _count integer; _final numeric;
BEGIN
  SELECT AVG(rating)::numeric, COUNT(*)
    INTO _avg, _count
  FROM public.rides
  WHERE driver_id = _driver_id AND rating IS NOT NULL;

  IF _count = 0 OR _avg IS NULL THEN
    _final := 5.0;
  ELSE
    _final := GREATEST(4.0, ROUND(_avg::numeric, 2));
  END IF;

  UPDATE public.drivers SET rating = _final, updated_at = now() WHERE user_id = _driver_id;
  RETURN _final;
END $$;

CREATE OR REPLACE FUNCTION public.recalc_passenger_rating(_passenger_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _avg numeric; _count integer; _final numeric;
BEGIN
  SELECT AVG(driver_rating)::numeric, COUNT(*)
    INTO _avg, _count
  FROM public.rides
  WHERE passenger_id = _passenger_id AND driver_rating IS NOT NULL;

  IF _count = 0 OR _avg IS NULL THEN
    _final := 5.0;
  ELSE
    _final := GREATEST(4.0, ROUND(_avg::numeric, 2));
  END IF;

  UPDATE public.profiles SET rating = _final, updated_at = now() WHERE user_id = _passenger_id;
  RETURN _final;
END $$;

-- 5) Trigger no rides para recalcular automaticamente
CREATE OR REPLACE FUNCTION public.trg_ride_rating_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Avaliação do passageiro -> recalcula nota do motorista
  IF (NEW.rating IS DISTINCT FROM OLD.rating) AND NEW.driver_id IS NOT NULL THEN
    PERFORM public.recalc_driver_rating(NEW.driver_id);
  END IF;

  -- Avaliação do motorista -> recalcula nota do passageiro
  IF (NEW.driver_rating IS DISTINCT FROM OLD.driver_rating) AND NEW.passenger_id IS NOT NULL THEN
    PERFORM public.recalc_passenger_rating(NEW.passenger_id);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ride_rating_recalc ON public.rides;
CREATE TRIGGER trg_ride_rating_recalc
  AFTER UPDATE OF rating, driver_rating ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.trg_ride_rating_changed();

-- 6) Função para motorista abrir recurso
CREATE OR REPLACE FUNCTION public.appeal_rating(_ride_id uuid, _reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _r record; _appeal_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 10 THEN
    RAISE EXCEPTION 'Justifique o recurso (mínimo 10 caracteres)';
  END IF;

  SELECT * INTO _r FROM public.rides WHERE id = _ride_id;
  IF _r IS NULL THEN RAISE EXCEPTION 'Corrida não encontrada'; END IF;
  IF _r.driver_id IS NULL OR _r.driver_id <> _uid THEN
    RAISE EXCEPTION 'Apenas o motorista da corrida pode contestar';
  END IF;
  IF _r.rating IS NULL THEN
    RAISE EXCEPTION 'Esta corrida ainda não foi avaliada';
  END IF;
  IF _r.rating > 2 THEN
    RAISE EXCEPTION 'Apenas avaliações de 1 ou 2 estrelas podem ser contestadas';
  END IF;
  IF _r.completed_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Prazo de 7 dias para contestar já expirou';
  END IF;

  INSERT INTO public.rating_appeals (ride_id, driver_id, passenger_id, original_rating, reason)
  VALUES (_ride_id, _uid, _r.passenger_id, _r.rating, _reason)
  RETURNING id INTO _appeal_id;

  -- Notifica admins
  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  SELECT ur.user_id, 'rating_appeal', 'Novo recurso de avaliação',
         'Motorista contestou avaliação ' || _r.rating || '★ na corrida ' || _r.ride_code,
         '/admin/rides',
         jsonb_build_object('appeal_id', _appeal_id, 'ride_id', _ride_id)
  FROM public.user_roles ur
  WHERE ur.role IN ('admin'::app_role, 'master'::app_role);

  RETURN _appeal_id;
END $$;

-- 7) Função admin para resolver recurso
CREATE OR REPLACE FUNCTION public.admin_resolve_appeal(_appeal_id uuid, _accept boolean, _response text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _a record;
BEGIN
  PERFORM public._require_admin();

  SELECT * INTO _a FROM public.rating_appeals WHERE id = _appeal_id FOR UPDATE;
  IF _a IS NULL THEN RAISE EXCEPTION 'Recurso não encontrado'; END IF;
  IF _a.status <> 'pending' THEN RAISE EXCEPTION 'Recurso já foi resolvido'; END IF;

  UPDATE public.rating_appeals
     SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END,
         admin_response = _response,
         resolved_by = _uid,
         resolved_at = now()
   WHERE id = _appeal_id;

  IF _accept THEN
    -- Substitui a avaliação por 5★ (trigger recalcula a média)
    UPDATE public.rides
       SET rating = 5,
           rating_comment = COALESCE(rating_comment, '') ||
                            CASE WHEN rating_comment IS NULL OR rating_comment = '' THEN '' ELSE E'\n' END ||
                            '[RECURSO ACEITO ' || to_char(now(),'DD/MM HH24:MI') || '] Avaliação ajustada para 5★'
     WHERE id = _a.ride_id;
  END IF;

  -- Notifica motorista
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_a.driver_id, 'rating_appeal_result',
          CASE WHEN _accept THEN 'Recurso aceito ✅' ELSE 'Recurso rejeitado' END,
          CASE WHEN _accept
               THEN 'Sua avaliação foi ajustada para 5★. Sua nota foi recalculada.'
               ELSE COALESCE(_response, 'O administrador analisou e manteve a avaliação original.')
          END,
          '/driver/profile');

  -- Audit
  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'rating_appeal', _appeal_id::text,
          CASE WHEN _accept THEN 'accept_appeal' ELSE 'reject_appeal' END,
          jsonb_build_object('ride_id', _a.ride_id, 'original_rating', _a.original_rating, 'response', _response));
END $$;

-- 8) Recalcula notas existentes (uma vez)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT driver_id FROM public.rides WHERE driver_id IS NOT NULL AND rating IS NOT NULL LOOP
    PERFORM public.recalc_driver_rating(r.driver_id);
  END LOOP;
  FOR r IN SELECT DISTINCT passenger_id FROM public.rides WHERE driver_rating IS NOT NULL LOOP
    PERFORM public.recalc_passenger_rating(r.passenger_id);
  END LOOP;
END $$;
