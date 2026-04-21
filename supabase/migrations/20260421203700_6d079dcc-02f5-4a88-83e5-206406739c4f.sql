CREATE OR REPLACE FUNCTION public.driver_wallet_history(_limit integer DEFAULT 100)
RETURNS TABLE(id text, kind text, description text, amount numeric, occurred_at timestamp with time zone, status text, ride_code text, reference jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  -- Crédito líquido da corrida concluída
  SELECT
    ('ride_net:' || r.id::text)         AS id,
    'ride_credit'                        AS kind,
    'Crédito da corrida Vamoo • ' || COALESCE(r.ride_code, substr(r.id::text, 1, 6)) AS description,
    COALESCE(r.driver_net, 0)::numeric  AS amount,
    COALESCE(r.completed_at, r.created_at) AS occurred_at,
    'concluida'                         AS status,
    r.ride_code                         AS ride_code,
    jsonb_build_object(
      'gross', COALESCE(r.price, 0),
      'fee',   COALESCE(r.platform_fee, 0),
      'net',   COALESCE(r.driver_net, 0),
      'payment_method', r.payment_method
    )                                   AS reference
  FROM public.rides r
  WHERE r.driver_id = _uid
    AND r.status = 'completed'
    AND COALESCE(r.driver_net, 0) > 0

  UNION ALL

  -- Taxa Vamoo descontada da corrida (entrada negativa visível)
  SELECT
    ('ride_fee:' || r.id::text)         AS id,
    'ride_fee'                           AS kind,
    'Taxa da corrida Vamoo • ' || COALESCE(r.ride_code, substr(r.id::text, 1, 6)) AS description,
    (-COALESCE(r.platform_fee, 0))::numeric AS amount,
    COALESCE(r.completed_at, r.created_at) AS occurred_at,
    'taxa'                              AS status,
    r.ride_code                         AS ride_code,
    jsonb_build_object(
      'gross', COALESCE(r.price, 0),
      'fee',   COALESCE(r.platform_fee, 0),
      'net',   COALESCE(r.driver_net, 0)
    )                                   AS reference
  FROM public.rides r
  WHERE r.driver_id = _uid
    AND r.status = 'completed'
    AND COALESCE(r.platform_fee, 0) > 0

  UNION ALL

  -- Recargas via WhatsApp / manual (wallet_topups)
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
      'channel',   'whatsapp'
    )                                   AS reference
  FROM public.wallet_topups t
  WHERE t.driver_id = _uid

  UNION ALL

  -- Recargas via Pix / cartão (recharges)
  SELECT
    ('recharge:' || rc.id::text)        AS id,
    'recharge'                          AS kind,
    CASE
      WHEN rc.method = 'pix'  THEN 'Recarga via Pix'
      WHEN rc.method = 'card' THEN 'Recarga via cartão'
      ELSE 'Recarga automática'
    END
    || CASE WHEN rc.status = 'completed' THEN '' ELSE ' (' || rc.status::text || ')' END AS description,
    CASE WHEN rc.status = 'completed' THEN (COALESCE(rc.amount,0) + COALESCE(rc.bonus,0)) ELSE 0 END::numeric AS amount,
    rc.created_at                       AS occurred_at,
    rc.status::text                     AS status,
    NULL::text                          AS ride_code,
    jsonb_build_object(
      'requested', rc.amount,
      'bonus',     COALESCE(rc.bonus, 0),
      'method',    rc.method,
      'channel',   'auto'
    )                                   AS reference
  FROM public.recharges rc
  WHERE rc.driver_id = _uid

  UNION ALL

  -- Ajustes do administrador (add / remove / set / topup / bonus / manual)
  SELECT
    ('adj:' || a.id::text)              AS id,
    CASE WHEN a.type IN ('topup','bonus') THEN 'topup_admin' ELSE 'adjustment' END AS kind,
    CASE
      WHEN a.type = 'add'    THEN 'Ajuste do administrador (crédito)'
      WHEN a.type = 'remove' THEN 'Ajuste do administrador (débito)'
      WHEN a.type = 'set'    THEN 'Saldo definido pelo administrador'
      WHEN a.type = 'topup'  THEN 'Recarga aprovada pelo administrador'
      WHEN a.type = 'bonus'  THEN 'Bônus de recarga'
      WHEN a.type = 'manual' THEN 'Recarga manual via administrador'
      ELSE 'Ajuste do administrador'
    END                                 AS description,
    CASE
      WHEN a.type = 'remove' THEN -ABS(a.amount)
      WHEN a.type = 'set'    THEN (a.new_balance - a.previous_balance)
      ELSE ABS(a.amount)
    END::numeric                        AS amount,
    a.created_at                        AS occurred_at,
    a.type                              AS status,
    NULL::text                          AS ride_code,
    jsonb_build_object(
      'reason',   COALESCE(a.reason, ''),
      'previous', a.previous_balance,
      'new',      a.new_balance,
      'type',     a.type
    )                                   AS reference
  FROM public.balance_adjustments a
  WHERE a.driver_id = _uid

  ORDER BY occurred_at DESC NULLS LAST
  LIMIT GREATEST(10, LEAST(_limit, 1000));
END;
$function$;