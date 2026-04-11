
-- Create withdrawal status enum
CREATE TYPE public.withdrawal_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

-- Create withdrawals table
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  pix_key TEXT NOT NULL,
  status withdrawal_status NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can create withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() = driver_id);

CREATE POLICY "Admins can manage all withdrawals" ON public.withdrawals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for rides
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
