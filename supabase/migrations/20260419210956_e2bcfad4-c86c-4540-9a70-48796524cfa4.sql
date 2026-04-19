-- 1) Novos campos no cadastro do motorista
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cancellation_block_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_block_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.drivers.cancellation_block_until IS 'Bloqueio operacional temporário por cancelamentos. Motorista não pode ficar online até esta data.';
COMMENT ON COLUMN public.drivers.cancellation_block_count IS 'Quantas vezes este motorista já foi punido por cancelar 3+ corridas em um dia. Usado para escala progressiva (2h, 5h, 12h, 24h, 48h, depois dobra).';

-- 2) Função que calcula a duração do próximo bloqueio (em horas) baseada no histórico
CREATE OR REPLACE FUNCTION public._driver_cancel_block_hours(_count INT)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- _count é o número de bloqueios JÁ aplicados (incluindo o atual que está sendo aplicado agora)
  -- 1ª punição = 2h, 2ª = 5h, 3ª = 12h, 4ª = 24h, 5ª = 48h, depois dobra
  RETURN CASE _count
    WHEN 1 THEN 2
    WHEN 2 THEN 5
    WHEN 3 THEN 12
    WHEN 4 THEN 24
    WHEN 5 THEN 48
    ELSE 48 * (2 ^ (_count - 5))::INT
  END;
END;
$$;

-- 3) Trigger AFTER UPDATE em rides: detecta cancelamento por motorista e aplica punição se acumular 3
CREATE OR REPLACE FUNCTION public.enforce_driver_cancellation_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _driver_id UUID;
  _today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  _last_reset DATE;
  _daily INT;
  _block_count INT;
  _hours INT;
  _until TIMESTAMPTZ;
BEGIN
  -- Só interessa quando vira 'cancelled' a partir de 'accepted' ou 'in_progress' E quem cancelou foi o motorista
  IF NEW.status <> 'cancelled' OR OLD.status NOT IN ('accepted','in_progress') THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NULL OR NEW.cancelled_by IS DISTINCT FROM NEW.driver_id THEN
    RETURN NEW;
  END IF;

  _driver_id := NEW.driver_id;

  -- Reset diário (meia-noite horário local)
  SELECT last_cancellation_reset, COALESCE(daily_cancellations,0), COALESCE(cancellation_block_count,0)
    INTO _last_reset, _daily, _block_count
  FROM public.drivers WHERE user_id = _driver_id FOR UPDATE;

  IF _last_reset IS NULL OR _last_reset < _today THEN
    _daily := 0;
    UPDATE public.drivers
       SET daily_cancellations = 0,
           last_cancellation_reset = _today
     WHERE user_id = _driver_id;
  END IF;

  -- Incrementa contador do dia
  _daily := _daily + 1;

  UPDATE public.drivers
     SET daily_cancellations = _daily
   WHERE user_id = _driver_id;

  -- A cada múltiplo de 3, aplica bloqueio progressivo
  IF _daily % 3 = 0 THEN
    _block_count := _block_count + 1;
    _hours := public._driver_cancel_block_hours(_block_count);
    _until := now() + (_hours || ' hours')::interval;

    UPDATE public.drivers
       SET cancellation_block_count = _block_count,
           cancellation_block_until = _until
     WHERE user_id = _driver_id;

    -- Derruba offline imediatamente
    UPDATE public.driver_locations
       SET is_online = false
     WHERE driver_id = _driver_id;

    -- Notifica
    INSERT INTO public.notifications (user_id, type, title, message, link, data)
    VALUES (
      _driver_id,
      'cancellation_block',
      'Bloqueio temporário por cancelamentos ⚠️',
      'Você cancelou ' || _daily || ' corridas hoje após aceitar. Está bloqueado de ficar online por ' || _hours || 'h (até ' || to_char(_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI') || '). Cancelamentos prejudicam passageiros.',
      '/driver/status',
      jsonb_build_object('hours', _hours, 'until', _until, 'daily', _daily, 'block_number', _block_count)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_driver_cancellation_limit ON public.rides;
CREATE TRIGGER trg_enforce_driver_cancellation_limit
AFTER UPDATE OF status ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_cancellation_limit();

-- 4) Atualiza a trava de "ficar online" para também checar bloqueio temporário
CREATE OR REPLACE FUNCTION public.enforce_driver_can_be_online()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _d record; _remaining_min INT;
BEGIN
  -- Só checa quando está tentando ficar online
  IF NEW.is_online IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT status::text AS status, online_blocked, online_blocked_reason,
         cancellation_block_until
    INTO _d
  FROM public.drivers WHERE user_id = NEW.driver_id;

  IF _d IS NULL THEN
    RAISE EXCEPTION 'Cadastro de motorista não encontrado' USING ERRCODE = '42501';
  END IF;

  IF _d.status NOT IN ('approved','aprovado') THEN
    RAISE EXCEPTION 'Seu cadastro ainda não foi aprovado. Aguarde a análise para ficar online.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(_d.online_blocked, false) = true THEN
    RAISE EXCEPTION 'Você está impedido pelo admin de ficar online. Motivo: %',
      COALESCE(_d.online_blocked_reason, 'não informado') USING ERRCODE = '42501';
  END IF;

  -- Bloqueio temporário por cancelamentos
  IF _d.cancellation_block_until IS NOT NULL AND _d.cancellation_block_until > now() THEN
    _remaining_min := CEIL(EXTRACT(EPOCH FROM (_d.cancellation_block_until - now())) / 60)::INT;
    RAISE EXCEPTION 'Você está bloqueado por excesso de cancelamentos. Volta em % minutos (até %).',
      _remaining_min,
      to_char(_d.cancellation_block_until AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 5) Garante que o trigger de online ainda esteja amarrado
DROP TRIGGER IF EXISTS trg_enforce_driver_can_be_online ON public.driver_locations;
CREATE TRIGGER trg_enforce_driver_can_be_online
BEFORE INSERT OR UPDATE OF is_online ON public.driver_locations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_can_be_online();