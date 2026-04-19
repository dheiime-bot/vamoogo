
-- =========================================================
-- TRAVAS OBRIGATÓRIAS - camada de banco (defesa em profundidade)
-- =========================================================

-- 1) PASSAGEIRO: ao criar corrida
CREATE OR REPLACE FUNCTION public.enforce_passenger_can_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile record;
  _open_count int;
BEGIN
  SELECT phone, status, full_name
    INTO _profile
  FROM public.profiles
  WHERE user_id = NEW.passenger_id;

  IF _profile IS NULL THEN
    RAISE EXCEPTION 'Perfil de passageiro não encontrado' USING ERRCODE = '42501';
  END IF;

  -- Telefone preenchido (obrigatório)
  IF _profile.phone IS NULL OR length(trim(_profile.phone)) < 8 THEN
    RAISE EXCEPTION 'Cadastre seu telefone no perfil para solicitar corridas'
      USING ERRCODE = '22023';
  END IF;

  -- Status da conta (suspeito = só alerta, não bloqueia)
  IF _profile.status = 'bloqueado' THEN
    RAISE EXCEPTION 'Sua conta está bloqueada. Entre em contato com o suporte.'
      USING ERRCODE = '42501';
  END IF;
  IF _profile.status = 'suspenso' THEN
    RAISE EXCEPTION 'Sua conta está suspensa temporariamente. Entre em contato com o suporte.'
      USING ERRCODE = '42501';
  END IF;

  -- Anti-spam: máximo 1 corrida em aberto por vez
  SELECT COUNT(*) INTO _open_count
  FROM public.rides
  WHERE passenger_id = NEW.passenger_id
    AND status IN ('requested','accepted','in_progress');

  IF _open_count > 0 THEN
    RAISE EXCEPTION 'Você já tem uma corrida em andamento. Finalize ou cancele antes de pedir outra.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_passenger_can_request ON public.rides;
CREATE TRIGGER trg_enforce_passenger_can_request
BEFORE INSERT ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_passenger_can_request();


-- 2) MOTORISTA: ao ficar online (driver_locations)
CREATE OR REPLACE FUNCTION public.enforce_driver_can_be_online()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _d record;
BEGIN
  -- Só checa quando está tentando ficar online
  IF NEW.is_online IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT status::text AS status, online_blocked, online_blocked_reason
    INTO _d
  FROM public.drivers
  WHERE user_id = NEW.driver_id;

  IF _d IS NULL THEN
    RAISE EXCEPTION 'Cadastro de motorista não encontrado'
      USING ERRCODE = '42501';
  END IF;

  IF _d.status NOT IN ('approved','aprovado') THEN
    RAISE EXCEPTION 'Seu cadastro ainda não foi aprovado. Aguarde a análise do admin.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(_d.online_blocked, false) THEN
    RAISE EXCEPTION 'Você foi impedido de ficar online pelo admin. %',
      COALESCE('Motivo: ' || _d.online_blocked_reason, 'Entre em contato com o suporte.')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_driver_can_be_online ON public.driver_locations;
CREATE TRIGGER trg_enforce_driver_can_be_online
BEFORE INSERT OR UPDATE OF is_online ON public.driver_locations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_can_be_online();


-- 3) MOTORISTA: ao aceitar corrida (atribuir driver_id ou mover para 'accepted')
CREATE OR REPLACE FUNCTION public.enforce_driver_can_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d record;
  _busy int;
BEGIN
  -- Dispara apenas quando o motorista está sendo atribuído pela primeira vez
  -- ou quando o status passa para 'accepted' com driver_id
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se não houve mudança de driver nem de status para accepted, ignora
  IF (OLD.driver_id IS NOT DISTINCT FROM NEW.driver_id)
     AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  -- Só checa quando ele realmente está aceitando (driver novo OU virando accepted)
  IF (OLD.driver_id IS DISTINCT FROM NEW.driver_id)
     OR (OLD.status <> 'accepted' AND NEW.status = 'accepted') THEN

    SELECT status::text AS status, online_blocked, online_blocked_reason, balance
      INTO _d
    FROM public.drivers
    WHERE user_id = NEW.driver_id;

    IF _d IS NULL THEN
      RAISE EXCEPTION 'Cadastro de motorista não encontrado'
        USING ERRCODE = '42501';
    END IF;

    IF _d.status NOT IN ('approved','aprovado') THEN
      RAISE EXCEPTION 'Cadastro não aprovado — não é possível aceitar corridas'
        USING ERRCODE = '42501';
    END IF;

    IF COALESCE(_d.online_blocked, false) THEN
      RAISE EXCEPTION 'Você está impedido pelo admin de aceitar corridas. %',
        COALESCE('Motivo: ' || _d.online_blocked_reason, '')
        USING ERRCODE = '42501';
    END IF;

    IF COALESCE(_d.balance, 0) < 5 THEN
      RAISE EXCEPTION 'Saldo insuficiente para aceitar corridas (mínimo R$ 5,00). Recarregue sua carteira.'
        USING ERRCODE = '22023';
    END IF;

    -- Não pode estar em outra corrida ativa
    SELECT COUNT(*) INTO _busy
    FROM public.rides
    WHERE driver_id = NEW.driver_id
      AND id <> NEW.id
      AND status IN ('accepted','in_progress');

    IF _busy > 0 THEN
      RAISE EXCEPTION 'Você já está em outra corrida ativa'
        USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_driver_can_accept ON public.rides;
CREATE TRIGGER trg_enforce_driver_can_accept
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_can_accept();


-- 4) CORRIDAS: impedir finalizar sem iniciar
CREATE OR REPLACE FUNCTION public.enforce_ride_status_transitions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Não pode marcar 'completed' sem ter iniciado
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    IF NEW.started_at IS NULL THEN
      RAISE EXCEPTION 'Não é possível finalizar uma corrida que não foi iniciada'
        USING ERRCODE = '22023';
    END IF;
    -- Define completed_at automaticamente se não veio
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  -- Não pode voltar de completed/cancelled
  IF OLD.status IN ('completed','cancelled') AND NEW.status <> OLD.status THEN
    -- Admin pode (via admin_cancel_ride etc., que usa SECURITY DEFINER e contexto admin)
    IF NOT (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid())) THEN
      RAISE EXCEPTION 'Corrida já finalizada — não pode mudar de status'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Setar started_at automaticamente quando vai para in_progress
  IF NEW.status = 'in_progress' AND OLD.status <> 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_ride_status_transitions ON public.rides;
CREATE TRIGGER trg_enforce_ride_status_transitions
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_ride_status_transitions();
