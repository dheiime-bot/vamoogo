CREATE OR REPLACE FUNCTION public.admin_search_drivers(_term text, _limit integer DEFAULT 10)
RETURNS TABLE(user_id uuid, full_name text, cpf text, phone text, email text, balance numeric, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _digits text;
  _like text;
  _digits_like text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_master(auth.uid())) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  _term := COALESCE(trim(_term), '');
  IF length(_term) < 2 THEN
    RETURN;
  END IF;

  _like := '%' || _term || '%';
  _digits := regexp_replace(_term, '\D', '', 'g');
  _digits_like := CASE WHEN _digits = '' THEN NULL ELSE '%' || _digits || '%' END;

  RETURN QUERY
  SELECT
    d.user_id,
    COALESCE(NULLIF(trim(p.full_name), ''), 'Motorista sem nome')::text AS full_name,
    p.cpf,
    p.phone,
    p.email,
    COALESCE(d.balance, 0)::numeric AS balance,
    COALESCE(d.status::text, 'pending') AS status
  FROM public.drivers d
  LEFT JOIN public.profiles p ON p.user_id = d.user_id
  WHERE
    p.user_id IS NULL
    OR (
      p.full_name ILIKE _like
      OR p.email ILIKE _like
      OR d.vehicle_plate ILIKE _like
      OR (_digits_like IS NOT NULL AND (
        regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g') LIKE _digits_like
        OR regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE _digits_like
      ))
    )
  ORDER BY COALESCE(NULLIF(trim(p.full_name), ''), d.user_id::text) ASC
  LIMIT GREATEST(1, LEAST(_limit, 25));
END;
$function$;