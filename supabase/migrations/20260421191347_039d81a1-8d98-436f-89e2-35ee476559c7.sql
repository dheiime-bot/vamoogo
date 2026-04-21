
-- Permite ao passageiro atualizar a própria corrida ativa (necessário para mudança de rota
-- durante a corrida). Sem essa policy, o UPDATE do passageiro era silenciosamente bloqueado
-- pela RLS e o motorista nunca recebia o evento realtime de alteração de destino.
CREATE POLICY "Passengers can update own active rides"
ON public.rides
FOR UPDATE
TO public
USING (
  auth.uid() = passenger_id
  AND status IN ('requested','accepted','in_progress')
)
WITH CHECK (
  auth.uid() = passenger_id
  AND status IN ('requested','accepted','in_progress')
);

-- Trigger de proteção: impede passageiro de alterar campos sensíveis (status, driver_id,
-- pagamento, ratings, flags administrativas). O passageiro só pode mexer no destino/rota.
CREATE OR REPLACE FUNCTION public._guard_passenger_ride_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins e o próprio motorista atribuído passam direto
  IF has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.driver_id IS NOT NULL AND auth.uid() = NEW.driver_id THEN
    RETURN NEW;
  END IF;
  -- Se for o passageiro, restringe os campos editáveis
  IF auth.uid() = OLD.passenger_id THEN
    IF NEW.status        IS DISTINCT FROM OLD.status        THEN RAISE EXCEPTION 'passenger cannot change status'; END IF;
    IF NEW.driver_id     IS DISTINCT FROM OLD.driver_id     THEN RAISE EXCEPTION 'passenger cannot change driver_id'; END IF;
    IF NEW.passenger_id  IS DISTINCT FROM OLD.passenger_id  THEN RAISE EXCEPTION 'passenger cannot change passenger_id'; END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'passenger cannot change payment_status'; END IF;
    IF NEW.rating        IS DISTINCT FROM OLD.rating        THEN RAISE EXCEPTION 'passenger cannot change rating here'; END IF;
    IF NEW.driver_rating IS DISTINCT FROM OLD.driver_rating THEN RAISE EXCEPTION 'passenger cannot change driver_rating here'; END IF;
    IF NEW.cancelled_at  IS DISTINCT FROM OLD.cancelled_at  THEN RAISE EXCEPTION 'passenger cannot change cancelled_at'; END IF;
    IF NEW.completed_at  IS DISTINCT FROM OLD.completed_at  THEN RAISE EXCEPTION 'passenger cannot change completed_at'; END IF;
    IF NEW.started_at    IS DISTINCT FROM OLD.started_at    THEN RAISE EXCEPTION 'passenger cannot change started_at'; END IF;
    IF NEW.arrived_at    IS DISTINCT FROM OLD.arrived_at    THEN RAISE EXCEPTION 'passenger cannot change arrived_at'; END IF;
    IF NEW.issue_flag    IS DISTINCT FROM OLD.issue_flag    THEN RAISE EXCEPTION 'passenger cannot change issue_flag'; END IF;
    IF NEW.admin_notes   IS DISTINCT FROM OLD.admin_notes   THEN RAISE EXCEPTION 'passenger cannot change admin_notes'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_passenger_ride_update ON public.rides;
CREATE TRIGGER guard_passenger_ride_update
BEFORE UPDATE ON public.rides
FOR EACH ROW EXECUTE FUNCTION public._guard_passenger_ride_update();
