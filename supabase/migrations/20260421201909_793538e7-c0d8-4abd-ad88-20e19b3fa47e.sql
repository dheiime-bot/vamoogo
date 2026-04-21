-- Busca de motoristas para a tela de recarga manual (apenas admin/master)
CREATE OR REPLACE FUNCTION public.admin_search_drivers(_term text, _limit integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  cpf text,
  phone text,
  email text,
  balance numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    p.user_id,
    p.full_name,
    p.cpf,
    p.phone,
    p.email,
    COALESCE(d.balance, 0)::numeric AS balance,
    COALESCE(d.status::text, 'pending') AS status
  FROM public.profiles p
  LEFT JOIN public.drivers d ON d.user_id = p.user_id
  WHERE p.user_type = 'driver'
    AND (
      p.full_name ILIKE _like
      OR (_digits_like IS NOT NULL AND (
        p.cpf ILIKE _digits_like
        OR p.phone ILIKE _digits_like
      ))
    )
  ORDER BY p.full_name ASC
  LIMIT GREATEST(1, LEAST(_limit, 25));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_drivers(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_drivers(text, integer) TO authenticated;

-- Histórico unificado da carteira do motorista
CREATE OR REPLACE FUNCTION public.driver_wallet_history(_limit integer DEFAULT 100)
RETURNS TABLE (
  id text,
  kind text,
  description text,
  amount numeric,
  occurred_at timestamptz,
  status text,
  ride_code text,
  reference jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  -- Corridas concluídas (líquido recebido + taxa)
  SELECT
    ('ride:' || r.id::text)            AS id,
    'ride'                              AS kind,
    'Corrida ' || COALESCE(r.ride_code, substr(r.id::text, 1, 6)) AS description,
    COALESCE(r.driver_net, 0)::numeric  AS amount,
    COALESCE(r.completed_at, r.created_at) AS occurred_at,
    'concluida'                         AS status,
    r.ride_code                         AS ride_code,
    jsonb_build_object(
      'gross', COALESCE(r.price, 0),
      'fee', COALESCE(r.platform_fee, 0),
      'net', COALESCE(r.driver_net, 0)
    )                                   AS reference
  FROM public.rides r
  WHERE r.driver_id = _uid
    AND r.status = 'completed'

  UNION ALL

  -- Recargas via WhatsApp (pendente/pago/creditado/cancelado)
  SELECT
    ('topup:' || t.id::text)            AS id,
    'topup'                             AS kind,
    CASE
      WHEN t.status = 'creditado' THEN 'Recarga creditada'
      WHEN t.status = 'pago'      THEN 'Recarga paga (aguardando crédito)'
      WHEN t.status = 'pendente'  THEN 'Recarga solicitada'
      WHEN t.status = 'cancelado' THEN 'Recarga cancelada'
      ELSE 'Recarga'
    END                                 AS description,
    CASE WHEN t.status = 'creditado' THEN t.valor ELSE 0 END::numeric AS amount,
    t.created_at                        AS occurred_at,
    t.status                            AS status,
    NULL::text                          AS ride_code,
    jsonb_build_object(
      'requested', t.valor,
      'channel', 'whatsapp'
    )                                   AS reference
  FROM public.wallet_topups t
  WHERE t.driver_id = _uid

  UNION ALL

  -- Ajustes manuais feitos pelo administrador (créditos e débitos)
  SELECT
    ('adj:' || a.id::text)              AS id,
    'adjustment'                        AS kind,
    CASE
      WHEN a.type = 'credit' THEN 'Crédito do administrador'
      WHEN a.type = 'debit'  THEN 'Débito do administrador'
      ELSE 'Ajuste do administrador'
    END                                 AS description,
    CASE WHEN a.type = 'debit' THEN -a.amount ELSE a.amount END::numeric AS amount,
    a.created_at                        AS occurred_at,
    a.type                              AS status,
    NULL::text                          AS ride_code,
    jsonb_build_object(
      'reason', COALESCE(a.reason, ''),
      'previous', a.previous_balance,
      'new', a.new_balance
    )                                   AS reference
  FROM public.balance_adjustments a
  WHERE a.driver_id = _uid

  ORDER BY occurred_at DESC NULLS LAST
  LIMIT GREATEST(10, LEAST(_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.driver_wallet_history(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_wallet_history(integer) TO authenticated;