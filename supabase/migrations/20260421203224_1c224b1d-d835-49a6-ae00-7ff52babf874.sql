ALTER TABLE public.balance_adjustments DROP CONSTRAINT IF EXISTS balance_adjustments_type_check;
ALTER TABLE public.balance_adjustments ADD CONSTRAINT balance_adjustments_type_check
  CHECK (type = ANY (ARRAY['add'::text, 'remove'::text, 'set'::text, 'topup'::text, 'bonus'::text, 'manual'::text]));