-- 1) Adiciona coluna active em passenger_coupons
ALTER TABLE public.passenger_coupons
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS passenger_coupons_passenger_active_idx
  ON public.passenger_coupons (passenger_id, active);

-- 2) Atualiza a função de resgate para bloquear cupons inativos
CREATE OR REPLACE FUNCTION public.passenger_redeem_coupon(_coupon_id uuid, _ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _coupon record;
  _ride record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO _coupon FROM public.passenger_coupons WHERE id = _coupon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'coupon_not_found';
  END IF;

  IF _coupon.passenger_id <> _uid THEN
    RAISE EXCEPTION 'not_your_coupon';
  END IF;

  IF _coupon.active = false THEN
    RAISE EXCEPTION 'coupon_inactive';
  END IF;

  IF _coupon.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'coupon_already_used';
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < now() THEN
    RAISE EXCEPTION 'coupon_expired';
  END IF;

  SELECT * INTO _ride FROM public.rides WHERE id = _ride_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ride_not_found';
  END IF;
  IF _ride.passenger_id <> _uid THEN
    RAISE EXCEPTION 'not_your_ride';
  END IF;

  UPDATE public.passenger_coupons
     SET used_at = now(),
         used_ride_id = _ride_id
   WHERE id = _coupon_id;
END;
$$;