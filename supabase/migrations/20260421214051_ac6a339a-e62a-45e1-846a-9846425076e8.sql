-- Permite que participantes de uma corrida ativa criem notificações um para o outro
-- (necessário para alertar o motorista quando o passageiro altera o destino, e vice-versa)
CREATE POLICY "Ride participants can notify each other"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE (r.passenger_id = auth.uid() AND r.driver_id = notifications.user_id)
       OR (r.driver_id = auth.uid() AND r.passenger_id = notifications.user_id)
    AND r.status = ANY (ARRAY['accepted'::ride_status, 'in_progress'::ride_status])
  )
);