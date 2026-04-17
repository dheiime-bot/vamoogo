ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'chat'::text,
    'ride_status'::text,
    'ride_arrived'::text,
    'low_balance'::text,
    'balance_adjustment'::text,
    'admin'::text,
    'admin_message'::text,
    'system'::text
  ]));