-- Add payment method to rides
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'pix', 'debit', 'credit');
  END IF;
END$$;

ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS payment_method public.payment_method DEFAULT 'cash';

-- Create chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat policies: only ride participants can read/write
CREATE POLICY "Ride participants can view chat"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = chat_messages.ride_id
        AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Ride participants can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = chat_messages.ride_id
        AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

CREATE POLICY "Participants can mark messages as read"
  ON public.chat_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rides
      WHERE rides.id = chat_messages.ride_id
        AND (rides.passenger_id = auth.uid() OR rides.driver_id = auth.uid())
    )
  );

-- Admins full access
CREATE POLICY "Admins manage chat"
  ON public.chat_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_ride_id ON public.chat_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);