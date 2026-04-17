-- Adiciona coluna opcional de override de taxa da plataforma por categoria.
-- Quando NULL, usa platform_settings.global_fee_percent.
ALTER TABLE public.tariffs
  ADD COLUMN IF NOT EXISTS fee_percent numeric;

COMMENT ON COLUMN public.tariffs.fee_percent IS
  'Override do percentual de comissão da plataforma para esta categoria (0-100). Quando NULL, aplica platform_settings.global_fee_percent.';

-- Garante que a configuração global exista (não sobrescreve se já existir)
INSERT INTO public.platform_settings (key, value, description)
VALUES ('global_fee_percent', '15'::jsonb, 'Taxa global da plataforma (%) — aplicada quando não há override por categoria')
ON CONFLICT (key) DO NOTHING;