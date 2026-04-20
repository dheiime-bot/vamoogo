
-- 1) Inserir configuração padrão (idempotente)
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'cancellation_rules',
  jsonb_build_object(
    'grace_seconds', 120,
    'daily_limit', 3,
    'block_hours_sequence', jsonb_build_array(2, 5, 12, 24, 48),
    'after_sequence_multiplier', 2,
    'apply_to_passenger', true,
    'apply_to_driver', true
  ),
  'Regras de cancelamento (cortesia, limites e bloqueios progressivos) aplicadas a passageiros e motoristas.'
)
ON CONFLICT (key) DO NOTHING;

-- 2) Cortesia (segundos)
CREATE OR REPLACE FUNCTION public._cancel_grace_seconds()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _val INTEGER;
BEGIN
  SELECT COALESCE((value->>'grace_seconds')::int, 120)
    INTO _val FROM public.platform_settings WHERE key = 'cancellation_rules';
  RETURN COALESCE(_val, 120);
END $$;

-- 3) Calcula horas de bloqueio do passageiro a partir do nº de bloqueios já recebidos
CREATE OR REPLACE FUNCTION public._cancel_block_hours(_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seq JSONB;
  _mult NUMERIC;
  _len INT;
  _hours INT;
  _extra INT;
BEGIN
  SELECT COALESCE(value->'block_hours_sequence', '[2,5,12,24,48]'::jsonb),
         COALESCE((value->>'after_sequence_multiplier')::numeric, 2)
    INTO _seq, _mult
  FROM public.platform_settings WHERE key = 'cancellation_rules';

  IF _seq IS NULL THEN _seq := '[2,5,12,24,48]'::jsonb; END IF;
  IF _mult IS NULL OR _mult <= 0 THEN _mult := 2; END IF;

  _len := jsonb_array_length(_seq);
  IF _count <= 0 THEN _count := 1; END IF;

  IF _count <= _len THEN
    _hours := (_seq->>(_count-1))::int;
  ELSE
    _hours := (_seq->>(_len-1))::int;
    _extra := _count - _len;
    _hours := (_hours * (_mult ^ _extra))::int;
  END IF;

  RETURN GREATEST(_hours, 1);
END $$;

-- 4) Mesma fórmula para motorista (mantido como função separada para retrocompatibilidade)
CREATE OR REPLACE FUNCTION public._driver_cancel_block_hours(_count INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._cancel_block_hours(_count);
END $$;
