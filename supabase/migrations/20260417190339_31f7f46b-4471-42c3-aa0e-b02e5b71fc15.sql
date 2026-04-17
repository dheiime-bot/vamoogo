-- Coluna para bloqueio operacional leve (motorista mantém conta mas não pode ficar online)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS online_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_blocked_reason text;

-- Permitir que admin/master atualize o status do driver via ações rápidas (já há policy "Admins can manage all drivers", mas garantimos master)
-- Já existem policies adequadas; nada a adicionar.