-- Substitui as policies de SELECT/INSERT/UPDATE em chat_messages
-- para esconder o histórico de chat após a corrida terminar.

DROP POLICY IF EXISTS "Ride participants can view chat" ON public.chat_messages;
DROP POLICY IF EXISTS "Ride participants can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Participants can mark messages as read" ON public.chat_messages;

-- SELECT: passageiro/motorista só veem chat de corridas ATIVAS
CREATE POLICY "Ride participants can view active chat"
ON public.chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
      AND rides.status NOT IN ('completed', 'cancelled')
  )
);

-- INSERT: só permite enviar mensagens em corridas ATIVAS
CREATE POLICY "Ride participants can send messages on active rides"
ON public.chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
      AND rides.status NOT IN ('completed', 'cancelled')
  )
);

-- UPDATE (marcar como lida): só em corridas ATIVAS
CREATE POLICY "Participants can mark active messages as read"
ON public.chat_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.rides
    WHERE rides.id = chat_messages.ride_id
      AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
      AND rides.status NOT IN ('completed', 'cancelled')
  )
);