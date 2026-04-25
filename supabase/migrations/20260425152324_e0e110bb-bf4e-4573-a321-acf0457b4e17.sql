CREATE OR REPLACE FUNCTION public.notify_admins_route_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  SELECT
    ur.user_id,
    'admin',
    'Rota alterada em corrida',
    concat(
      coalesce(r.ride_code, substring(NEW.ride_id::text from 1 for 8)),
      ': ',
      coalesce(split_part(NEW.previous_destination_address, ' - ', 1), 'Destino anterior'),
      ' → ',
      coalesce(split_part(NEW.new_destination_address, ' - ', 1), 'Novo destino'),
      CASE
        WHEN NEW.previous_price IS NOT NULL AND NEW.new_price IS NOT NULL THEN
          concat(' • ', CASE WHEN NEW.new_price - NEW.previous_price >= 0 THEN '+' ELSE '' END, 'R$ ', to_char(NEW.new_price - NEW.previous_price, 'FM999999990.00'))
        ELSE ''
      END
    ),
    '/admin/rides',
    jsonb_build_object(
      'event', 'route_changed',
      'audience', 'admin',
      'ride_id', NEW.ride_id,
      'ride_code', r.ride_code,
      'route_change_id', NEW.id,
      'previous_destination', NEW.previous_destination_address,
      'new_destination', NEW.new_destination_address,
      'previous_price', NEW.previous_price,
      'new_price', NEW.new_price,
      'delta_price', CASE WHEN NEW.previous_price IS NOT NULL AND NEW.new_price IS NOT NULL THEN NEW.new_price - NEW.previous_price ELSE NULL END,
      'previous_km', NEW.previous_distance_km,
      'new_km', NEW.new_distance_km,
      'changed_by', NEW.changed_by,
      'changed_by_role', NEW.changed_by_role
    )
  FROM public.user_roles ur
  LEFT JOIN public.rides r ON r.id = NEW.ride_id
  WHERE ur.role IN ('admin'::public.app_role, 'master'::public.app_role);

  RETURN NEW;
END;
$$;