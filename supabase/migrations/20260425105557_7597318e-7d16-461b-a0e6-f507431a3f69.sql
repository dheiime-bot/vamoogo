DROP POLICY IF EXISTS "Passengers can rate completed own rides" ON public.rides;
CREATE POLICY "Passengers can rate completed own rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = passenger_id
  AND status = 'completed'
)
WITH CHECK (
  auth.uid() = passenger_id
  AND status = 'completed'
);

DROP POLICY IF EXISTS "Drivers can rate completed assigned rides" ON public.rides;
CREATE POLICY "Drivers can rate completed assigned rides"
ON public.rides
FOR UPDATE
TO authenticated
USING (
  auth.uid() = driver_id
  AND status = 'completed'
)
WITH CHECK (
  auth.uid() = driver_id
  AND status = 'completed'
);

CREATE OR REPLACE FUNCTION public._guard_passenger_ride_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.driver_id IS NOT NULL AND auth.uid() = NEW.driver_id THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.passenger_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'passenger cannot change status'; END IF;
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN RAISE EXCEPTION 'passenger cannot change driver_id'; END IF;
    IF NEW.passenger_id IS DISTINCT FROM OLD.passenger_id THEN RAISE EXCEPTION 'passenger cannot change passenger_id'; END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'passenger cannot change payment_status'; END IF;
    IF NEW.driver_rating IS DISTINCT FROM OLD.driver_rating THEN RAISE EXCEPTION 'passenger cannot change driver_rating'; END IF;
    IF NEW.driver_rating_comment IS DISTINCT FROM OLD.driver_rating_comment THEN RAISE EXCEPTION 'passenger cannot change driver_rating_comment'; END IF;
    IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN RAISE EXCEPTION 'passenger cannot change cancelled_at'; END IF;
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'passenger cannot change completed_at'; END IF;
    IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN RAISE EXCEPTION 'passenger cannot change started_at'; END IF;
    IF NEW.arrived_at IS DISTINCT FROM OLD.arrived_at THEN RAISE EXCEPTION 'passenger cannot change arrived_at'; END IF;
    IF NEW.issue_flag IS DISTINCT FROM OLD.issue_flag THEN RAISE EXCEPTION 'passenger cannot change issue_flag'; END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN RAISE EXCEPTION 'passenger cannot change admin_notes'; END IF;

    IF OLD.status = 'completed' THEN
      IF NEW.origin_address IS DISTINCT FROM OLD.origin_address THEN RAISE EXCEPTION 'passenger cannot change origin_address'; END IF;
      IF NEW.origin_lat IS DISTINCT FROM OLD.origin_lat THEN RAISE EXCEPTION 'passenger cannot change origin_lat'; END IF;
      IF NEW.origin_lng IS DISTINCT FROM OLD.origin_lng THEN RAISE EXCEPTION 'passenger cannot change origin_lng'; END IF;
      IF NEW.destination_address IS DISTINCT FROM OLD.destination_address THEN RAISE EXCEPTION 'passenger cannot change destination_address'; END IF;
      IF NEW.destination_lat IS DISTINCT FROM OLD.destination_lat THEN RAISE EXCEPTION 'passenger cannot change destination_lat'; END IF;
      IF NEW.destination_lng IS DISTINCT FROM OLD.destination_lng THEN RAISE EXCEPTION 'passenger cannot change destination_lng'; END IF;
      IF NEW.stops IS DISTINCT FROM OLD.stops THEN RAISE EXCEPTION 'passenger cannot change stops'; END IF;
      IF NEW.distance_km IS DISTINCT FROM OLD.distance_km THEN RAISE EXCEPTION 'passenger cannot change distance_km'; END IF;
      IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN RAISE EXCEPTION 'passenger cannot change duration_minutes'; END IF;
      IF NEW.price IS DISTINCT FROM OLD.price THEN RAISE EXCEPTION 'passenger cannot change price'; END IF;
      IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN RAISE EXCEPTION 'passenger cannot change platform_fee'; END IF;
      IF NEW.driver_net IS DISTINCT FROM OLD.driver_net THEN RAISE EXCEPTION 'passenger cannot change driver_net'; END IF;
      IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN RAISE EXCEPTION 'passenger cannot change payment_method'; END IF;
    ELSE
      IF NEW.rating IS DISTINCT FROM OLD.rating THEN RAISE EXCEPTION 'passenger cannot change rating here'; END IF;
      IF NEW.rating_comment IS DISTINCT FROM OLD.rating_comment THEN RAISE EXCEPTION 'passenger cannot change rating_comment here'; END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._guard_driver_completed_rating_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role) OR is_master(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.driver_id AND OLD.status = 'completed' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'driver cannot change status after completed'; END IF;
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN RAISE EXCEPTION 'driver cannot change driver_id'; END IF;
    IF NEW.passenger_id IS DISTINCT FROM OLD.passenger_id THEN RAISE EXCEPTION 'driver cannot change passenger_id'; END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN RAISE EXCEPTION 'driver cannot change passenger rating of driver'; END IF;
    IF NEW.rating_comment IS DISTINCT FROM OLD.rating_comment THEN RAISE EXCEPTION 'driver cannot change passenger rating comment of driver'; END IF;
    IF NEW.origin_address IS DISTINCT FROM OLD.origin_address THEN RAISE EXCEPTION 'driver cannot change origin_address'; END IF;
    IF NEW.origin_lat IS DISTINCT FROM OLD.origin_lat THEN RAISE EXCEPTION 'driver cannot change origin_lat'; END IF;
    IF NEW.origin_lng IS DISTINCT FROM OLD.origin_lng THEN RAISE EXCEPTION 'driver cannot change origin_lng'; END IF;
    IF NEW.destination_address IS DISTINCT FROM OLD.destination_address THEN RAISE EXCEPTION 'driver cannot change destination_address'; END IF;
    IF NEW.destination_lat IS DISTINCT FROM OLD.destination_lat THEN RAISE EXCEPTION 'driver cannot change destination_lat'; END IF;
    IF NEW.destination_lng IS DISTINCT FROM OLD.destination_lng THEN RAISE EXCEPTION 'driver cannot change destination_lng'; END IF;
    IF NEW.stops IS DISTINCT FROM OLD.stops THEN RAISE EXCEPTION 'driver cannot change stops'; END IF;
    IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN RAISE EXCEPTION 'driver cannot change payment_method'; END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN RAISE EXCEPTION 'driver cannot change payment_status'; END IF;
    IF NEW.price IS DISTINCT FROM OLD.price THEN RAISE EXCEPTION 'driver cannot change price'; END IF;
    IF NEW.platform_fee IS DISTINCT FROM OLD.platform_fee THEN RAISE EXCEPTION 'driver cannot change platform_fee'; END IF;
    IF NEW.driver_net IS DISTINCT FROM OLD.driver_net THEN RAISE EXCEPTION 'driver cannot change driver_net'; END IF;
    IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN RAISE EXCEPTION 'driver cannot change cancelled_at'; END IF;
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN RAISE EXCEPTION 'driver cannot change completed_at'; END IF;
    IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN RAISE EXCEPTION 'driver cannot change started_at'; END IF;
    IF NEW.arrived_at IS DISTINCT FROM OLD.arrived_at THEN RAISE EXCEPTION 'driver cannot change arrived_at'; END IF;
    IF NEW.issue_flag IS DISTINCT FROM OLD.issue_flag THEN RAISE EXCEPTION 'driver cannot change issue_flag'; END IF;
    IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN RAISE EXCEPTION 'driver cannot change admin_notes'; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_driver_completed_rating_update ON public.rides;
CREATE TRIGGER guard_driver_completed_rating_update
BEFORE UPDATE ON public.rides
FOR EACH ROW
EXECUTE FUNCTION public._guard_driver_completed_rating_update();