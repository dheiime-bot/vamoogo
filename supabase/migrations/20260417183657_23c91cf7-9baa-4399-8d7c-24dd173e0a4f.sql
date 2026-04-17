
-- Drivers: master também pode gerenciar
CREATE POLICY "Master can manage all drivers"
ON public.drivers FOR ALL
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- Profiles: master também pode ver todos
CREATE POLICY "Master can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_master(auth.uid()));

-- Driver locations: master pode ver
CREATE POLICY "Master can view all locations"
ON public.driver_locations FOR SELECT
USING (public.is_master(auth.uid()));
