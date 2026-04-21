-- Atualiza a mensagem de bloqueio quando saldo está negativo ou abaixo do mínimo,
-- explicando que ele ficou negativo após o débito da taxa da última corrida.
CREATE OR REPLACE FUNCTION public.enforce_driver_can_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _d public.drivers%ROWTYPE;
  _busy int;
BEGIN
  IF NEW.driver_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.driver_id IS DISTINCT FROM OLD.driver_id) THEN

    SELECT * INTO _d FROM public.drivers WHERE user_id = NEW.driver_id;

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

    IF COALESCE(_d.balance, 0) < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para aceitar corridas — sua carteira está negativa (R$ %). Recarregue para regularizar.',
        to_char(_d.balance, 'FM999990.00')
        USING ERRCODE = '22023';
    ELSIF COALESCE(_d.balance, 0) < 5 THEN
      RAISE EXCEPTION 'Saldo insuficiente para aceitar corridas (mínimo R$ 5,00). Recarregue sua carteira.'
        USING ERRCODE = '22023';
    END IF;

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