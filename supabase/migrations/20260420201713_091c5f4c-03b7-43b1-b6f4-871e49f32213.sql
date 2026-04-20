CREATE OR REPLACE FUNCTION public.driver_set_active_vehicle(_vehicle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _v RECORD;
  _is_online boolean;
  _has_active_ride boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Busca o veículo escolhido e valida ownership + status
  SELECT * INTO _v
  FROM public.driver_vehicles
  WHERE id = _vehicle_id AND driver_id = _uid;

  IF _v IS NULL THEN
    RAISE EXCEPTION 'Veículo não encontrado';
  END IF;
  IF _v.status <> 'approved' THEN
    RAISE EXCEPTION 'Este veículo ainda não foi aprovado';
  END IF;

  -- Não permite troca se estiver online
  SELECT COALESCE(is_online, false) INTO _is_online
  FROM public.driver_locations WHERE driver_id = _uid;
  IF _is_online THEN
    RAISE EXCEPTION 'Fique offline para trocar de veículo';
  END IF;

  -- Não permite troca durante corrida ativa
  SELECT EXISTS(
    SELECT 1 FROM public.rides
    WHERE driver_id = _uid
      AND status IN ('accepted','in_progress')
  ) INTO _has_active_ride;
  IF _has_active_ride THEN
    RAISE EXCEPTION 'Você tem uma corrida em andamento. Finalize antes de trocar de veículo';
  END IF;

  -- Marca apenas este como ativo
  UPDATE public.driver_vehicles SET is_active = false WHERE driver_id = _uid AND is_active = true;
  UPDATE public.driver_vehicles SET is_active = true, updated_at = now() WHERE id = _vehicle_id;

  -- Sincroniza dados em drivers para compatibilidade com o restante do sistema
  UPDATE public.drivers SET
    category = _v.category,
    vehicle_brand = _v.vehicle_brand,
    vehicle_model = _v.vehicle_model,
    vehicle_color = _v.vehicle_color,
    vehicle_year = _v.vehicle_year,
    vehicle_plate = _v.vehicle_plate,
    vehicle_photo_front_url = _v.vehicle_photo_front_url,
    vehicle_photo_back_url = _v.vehicle_photo_back_url,
    vehicle_photo_left_url = _v.vehicle_photo_left_url,
    vehicle_photo_right_url = _v.vehicle_photo_right_url,
    crlv_url = _v.crlv_url,
    updated_at = now()
  WHERE user_id = _uid;

  -- Atualiza categoria na localização (caso já exista um registro)
  UPDATE public.driver_locations SET category = _v.category WHERE driver_id = _uid;
END;
$$;