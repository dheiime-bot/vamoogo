ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY[
  'chat','ride_status','ride_arrived','ride_offer','low_balance','balance_adjustment',
  'admin','admin_message','system','driver_status','passenger_status',
  'support_message','support_response','rating_appeal','rating_appeal_result',
  'withdrawal','recharge','campaign','fraud_alert','incident',
  'vehicle_change_request','vehicle_change_approved','vehicle_change_rejected',
  'coupon','favorite_call','vehicle_transfer'
]::text[]));