-- ========= MOTORISTAS =========

CREATE OR REPLACE FUNCTION public.admin_update_driver_status(
  _user_id uuid,
  _new_status text,
  _message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _old text; _title text;
BEGIN
  PERFORM public._require_admin();
  IF _new_status NOT IN ('cadastro_enviado','em_analise','aprovado','reprovado','pendente_documentos','blocked','pending','approved','rejected') THEN
    RAISE EXCEPTION 'Status inválido: %', _new_status;
  END IF;

  SELECT status::text INTO _old FROM public.drivers WHERE user_id = _user_id;
  IF _old IS NULL THEN RAISE EXCEPTION 'Motorista não encontrado'; END IF;

  UPDATE public.drivers
     SET status = _new_status::driver_status,
         analysis_message = _message,
         analyzed_at = now(),
         analyzed_by = _uid
   WHERE user_id = _user_id;

  _title := CASE _new_status
    WHEN 'aprovado' THEN 'Cadastro aprovado! 🎉'
    WHEN 'reprovado' THEN 'Cadastro reprovado'
    WHEN 'pendente_documentos' THEN 'Documentos pendentes'
    WHEN 'blocked' THEN 'Conta bloqueada'
    WHEN 'em_analise' THEN 'Cadastro em análise'
    ELSE 'Status do cadastro atualizado'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, 'driver_status', _title, COALESCE(_message,''), '/driver/status');

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'driver', _user_id::text, 'update_status',
          jsonb_build_object('previous', _old, 'new', _new_status, 'message', _message));
END $$;

CREATE OR REPLACE FUNCTION public.admin_block_driver_online(
  _user_id uuid,
  _block boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();

  UPDATE public.drivers
     SET online_blocked = _block,
         online_blocked_reason = CASE WHEN _block THEN _reason ELSE NULL END
   WHERE user_id = _user_id;

  IF _block THEN
    UPDATE public.driver_locations SET is_online = false WHERE driver_id = _user_id;
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (_user_id, 'driver_status', 'Você foi impedido de ficar online',
            COALESCE(_reason, 'Entre em contato com o suporte.'), '/driver/status');
  ELSE
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (_user_id, 'driver_status', 'Bloqueio operacional removido',
            'Você já pode ficar online novamente.', '/driver/status');
  END IF;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'driver', _user_id::text,
          CASE WHEN _block THEN 'online_block' ELSE 'online_unblock' END,
          jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_driver_data(
  _user_id uuid,
  _full_name text,
  _email text,
  _phone text,
  _vehicle_brand text,
  _vehicle_model text,
  _vehicle_color text,
  _vehicle_plate text,
  _category text,
  _pix_key text,
  _pix_key_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();

  UPDATE public.profiles
     SET full_name = _full_name, email = _email, phone = _phone
   WHERE user_id = _user_id;

  UPDATE public.drivers
     SET vehicle_brand = _vehicle_brand,
         vehicle_model = _vehicle_model,
         vehicle_color = _vehicle_color,
         vehicle_plate = _vehicle_plate,
         category = _category::vehicle_category,
         pix_key = _pix_key,
         pix_key_type = _pix_key_type
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'driver', _user_id::text, 'update_data',
          jsonb_build_object(
            'full_name', _full_name, 'email', _email, 'phone', _phone,
            'vehicle', _vehicle_brand || ' ' || _vehicle_model || ' ' || _vehicle_color || ' ' || _vehicle_plate,
            'category', _category, 'pix_key_type', _pix_key_type));
END $$;

-- ========= PASSAGEIROS =========

CREATE OR REPLACE FUNCTION public.admin_update_passenger_status(
  _user_id uuid,
  _new_status text,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _old text; _title text;
BEGIN
  PERFORM public._require_admin();
  IF _new_status NOT IN ('ativo','bloqueado','suspenso') THEN
    RAISE EXCEPTION 'Status inválido: %', _new_status;
  END IF;

  SELECT status::text INTO _old FROM public.profiles WHERE user_id = _user_id;
  IF _old IS NULL THEN RAISE EXCEPTION 'Passageiro não encontrado'; END IF;

  UPDATE public.profiles
     SET status = _new_status::passenger_status,
         blocked_reason = CASE WHEN _new_status = 'ativo' THEN NULL ELSE _reason END,
         blocked_at = CASE WHEN _new_status = 'ativo' THEN NULL ELSE now() END,
         blocked_by = CASE WHEN _new_status = 'ativo' THEN NULL ELSE _uid END
   WHERE user_id = _user_id;

  _title := CASE _new_status
    WHEN 'bloqueado' THEN 'Conta bloqueada'
    WHEN 'suspenso' THEN 'Conta suspensa temporariamente'
    ELSE 'Conta reativada'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, 'passenger_status', _title, COALESCE(_reason,''), '/passenger');

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'passenger', _user_id::text, 'update_status',
          jsonb_build_object('previous', _old, 'new', _new_status, 'reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_passenger_suspect(
  _user_id uuid,
  _suspect boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();

  UPDATE public.profiles
     SET is_suspect = _suspect,
         suspect_reason = CASE WHEN _suspect THEN _reason ELSE NULL END
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'passenger', _user_id::text,
          CASE WHEN _suspect THEN 'mark_suspect' ELSE 'unmark_suspect' END,
          jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_passenger_data(
  _user_id uuid,
  _full_name text,
  _email text,
  _phone text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();

  UPDATE public.profiles
     SET full_name = _full_name, email = _email, phone = _phone
   WHERE user_id = _user_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'passenger', _user_id::text, 'update_data',
          jsonb_build_object('full_name', _full_name, 'email', _email, 'phone', _phone));
END $$;

-- ========= SUPORTE =========

CREATE OR REPLACE FUNCTION public.admin_respond_ticket(
  _ticket_id uuid,
  _response text,
  _close boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _user_id uuid; _subject text; _new_status text;
BEGIN
  PERFORM public._require_admin();
  IF _response IS NULL OR length(trim(_response)) < 2 THEN
    RAISE EXCEPTION 'Resposta vazia';
  END IF;

  SELECT user_id, subject INTO _user_id, _subject
  FROM public.support_tickets WHERE id = _ticket_id;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Ticket não encontrado'; END IF;

  _new_status := CASE WHEN _close THEN 'closed' ELSE 'answered' END;

  UPDATE public.support_tickets
     SET admin_response = _response,
         status = _new_status,
         updated_at = now()
   WHERE id = _ticket_id;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (_user_id, 'support_response', 'Suporte respondeu seu ticket',
          'Assunto: ' || _subject || E'\n\n' || _response, '/passenger');

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'support_ticket', _ticket_id::text, 'respond_ticket',
          jsonb_build_object('status', _new_status, 'response', _response));
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_ticket_priority(
  _ticket_id uuid,
  _priority text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid(); _old text;
BEGIN
  PERFORM public._require_admin();
  IF _priority NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Prioridade inválida: %', _priority;
  END IF;

  SELECT priority INTO _old FROM public.support_tickets WHERE id = _ticket_id;
  UPDATE public.support_tickets SET priority = _priority, updated_at = now() WHERE id = _ticket_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'support_ticket', _ticket_id::text, 'update_priority',
          jsonb_build_object('previous', _old, 'new', _priority));
END $$;

CREATE OR REPLACE FUNCTION public.admin_close_ticket(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  PERFORM public._require_admin();

  UPDATE public.support_tickets SET status = 'closed', updated_at = now() WHERE id = _ticket_id;

  INSERT INTO public.audit_logs (admin_id, entity_type, entity_id, action, details)
  VALUES (_uid, 'support_ticket', _ticket_id::text, 'close_ticket', '{}'::jsonb);
END $$;