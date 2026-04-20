-- Recria a policy ALL para incluir WITH CHECK (sem ele, UPDATE/INSERT são bloqueados em silêncio)
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;

CREATE POLICY "Admins can manage coupons"
ON public.coupons
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()));