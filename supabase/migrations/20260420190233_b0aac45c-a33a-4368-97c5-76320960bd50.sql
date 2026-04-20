
-- ============================================
-- 1) CUPONS PESSOAIS (enviados pelo admin)
-- ============================================
CREATE TABLE IF NOT EXISTS public.passenger_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
  discount_value numeric NOT NULL DEFAULT 0,
  min_fare numeric DEFAULT 0,
  expires_at timestamptz,
  used_at timestamptz,
  used_ride_id uuid,
  sent_by uuid,
  source text NOT NULL DEFAULT 'admin', -- 'admin' | 'system'
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcoupons_passenger ON public.passenger_coupons(passenger_id, used_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcoupons_unique_code ON public.passenger_coupons(passenger_id, code) WHERE used_at IS NULL;

ALTER TABLE public.passenger_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers view own coupons"
  ON public.passenger_coupons FOR SELECT TO authenticated
  USING (auth.uid() = passenger_id);

CREATE POLICY "Admins manage all passenger coupons"
  ON public.passenger_coupons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

-- ============================================
-- 2) MOTORISTAS FAVORITOS
-- ============================================
CREATE TABLE IF NOT EXISTS public.favorite_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (passenger_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_favdrv_passenger ON public.favorite_drivers(passenger_id);
CREATE INDEX IF NOT EXISTS idx_favdrv_driver ON public.favorite_drivers(driver_id);

ALTER TABLE public.favorite_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers manage own favorites"
  ON public.favorite_drivers FOR ALL TO authenticated
  USING (auth.uid() = passenger_id)
  WITH CHECK (auth.uid() = passenger_id);

CREATE POLICY "Drivers see who favorited them"
  ON public.favorite_drivers FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins view all favorites"
  ON public.favorite_drivers FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

-- ============================================
-- 3) FUNÇÕES RPC
-- ============================================

-- Admin envia cupom (1 ou vários passageiros). Notifica cada um.
CREATE OR REPLACE FUNCTION public.admin_send_coupon(
  _passenger_ids uuid[],
  _code text,
  _discount_type text,
  _discount_value numeric,
  _min_fare numeric DEFAULT 0,
  _expires_at timestamptz DEFAULT NULL,
  _message text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _pid uuid; _count int := 0; _msg text;
BEGIN
  PERFORM public._require_admin();

  IF _code IS NULL OR length(trim(_code)) < 2 THEN
    RAISE EXCEPTION 'Código do cupom inválido';
  END IF;
  IF _discount_type NOT IN ('percentage','fixed') THEN
    RAISE EXCEPTION 'Tipo de desconto inválido';
  END IF;
  IF _discount_value IS NULL OR _discount_value <= 0 THEN
    RAISE EXCEPTION 'Valor do desconto deve ser maior que zero';
  END IF;
  IF _passenger_ids IS NULL OR array_length(_passenger_ids,1) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um passageiro';
  END IF;

  _msg := CASE
    WHEN _discount_type = 'percentage'
      THEN 'Você ganhou ' || to_char(_discount_value,'FM990D00') || '% de desconto! Use o código ' || upper(_code) || ' na próxima corrida.'
    ELSE 'Você ganhou R$ ' || to_char(_discount_value,'FM990D00') || ' de desconto! Use o código ' || upper(_code) || ' na próxima corrida.'
  END;

  FOREACH _pid IN ARRAY _passenger_ids LOOP
    BEGIN
      INSERT INTO public.passenger_coupons (passenger_id, code, discount_type, discount_value, min_fare, expires_at, sent_by, source, message)
      VALUES (_pid, upper(trim(_code)), _discount_type, _discount_value, COALESCE(_min_fare,0), _expires_at, _uid, 'admin', _message);

      INSERT INTO public.notifications (user_id, type, title, message, link, data)
      VALUES (_pid, 'coupon', '🎁 Você recebeu um cupom!', COALESCE(_message, _msg), '/passenger/coupons',
              jsonb_build_object('code', upper(trim(_code)), 'discount_type', _discount_type, 'discount_value', _discount_value));
      _count := _count + 1;
    EXCEPTION WHEN unique_violation THEN
      -- já tem este código ativo para este passageiro; ignora silenciosamente
      NULL;
    END;
  END LOOP;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'coupon', upper(trim(_code)), 'send_coupon',
          jsonb_build_object('passengers', _count, 'discount_type', _discount_type, 'discount_value', _discount_value, 'min_fare', _min_fare, 'expires_at', _expires_at));

  RETURN _count;
END $$;

-- Marca cupom como usado em uma corrida específica
CREATE OR REPLACE FUNCTION public.passenger_redeem_coupon(_coupon_id uuid, _ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _c record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO _c FROM public.passenger_coupons WHERE id = _coupon_id AND passenger_id = _uid FOR UPDATE;
  IF _c IS NULL THEN RAISE EXCEPTION 'Cupom não encontrado'; END IF;
  IF _c.used_at IS NOT NULL THEN RAISE EXCEPTION 'Cupom já utilizado'; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RAISE EXCEPTION 'Cupom expirado'; END IF;

  UPDATE public.passenger_coupons
     SET used_at = now(), used_ride_id = _ride_id
   WHERE id = _coupon_id;
END $$;

-- Toggle favoritar/desfavoritar motorista
CREATE OR REPLACE FUNCTION public.passenger_toggle_favorite_driver(_driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _exists boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _driver_id IS NULL OR _driver_id = _uid THEN RAISE EXCEPTION 'Motorista inválido'; END IF;

  SELECT EXISTS(SELECT 1 FROM public.favorite_drivers WHERE passenger_id = _uid AND driver_id = _driver_id) INTO _exists;

  IF _exists THEN
    DELETE FROM public.favorite_drivers WHERE passenger_id = _uid AND driver_id = _driver_id;
    RETURN false;
  ELSE
    INSERT INTO public.favorite_drivers (passenger_id, driver_id) VALUES (_uid, _driver_id);
    RETURN true;
  END IF;
END $$;
