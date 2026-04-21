-- Tabela de solicitações de recarga via WhatsApp
CREATE TABLE public.wallet_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  telefone TEXT,
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Validação de status
ALTER TABLE public.wallet_topups
  ADD CONSTRAINT wallet_topups_status_check
  CHECK (status IN ('pendente', 'pago', 'creditado', 'cancelado'));

-- Validação de valor positivo
ALTER TABLE public.wallet_topups
  ADD CONSTRAINT wallet_topups_valor_check
  CHECK (valor > 0);

-- Índices
CREATE INDEX idx_wallet_topups_driver ON public.wallet_topups(driver_id);
CREATE INDEX idx_wallet_topups_status ON public.wallet_topups(status);
CREATE INDEX idx_wallet_topups_created ON public.wallet_topups(created_at DESC);

-- RLS
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers create own topups"
  ON public.wallet_topups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers view own topups"
  ON public.wallet_topups FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

CREATE POLICY "Admins manage all topups"
  ON public.wallet_topups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_wallet_topups_updated_at
  BEFORE UPDATE ON public.wallet_topups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração padrão (desativada)
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'whatsapp_topup',
  jsonb_build_object(
    'enabled', false,
    'whatsapp_number', '',
    'central_name', 'Central Vamoo',
    'message_template', E'Olá, gostaria de solicitar uma recarga para minha carteira de motorista.\n\nNome: {nome}\nCPF: {cpf}\nTelefone: {telefone}\nID do motorista: {id}\nValor da recarga: R$ {valor}',
    'quick_amounts', jsonb_build_array(20, 30, 50, 100),
    'allow_custom_amount', true
  ),
  'Configuração de recarga de carteira via WhatsApp'
)
ON CONFLICT (key) DO NOTHING;