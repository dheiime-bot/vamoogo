
-- Create enums
CREATE TYPE public.user_type AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');
CREATE TYPE public.ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.vehicle_category AS ENUM ('moto', 'car', 'premium');
CREATE TYPE public.recharge_method AS ENUM ('pix', 'card');
CREATE TYPE public.recharge_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE public.fraud_severity AS ENUM ('light', 'moderate', 'probable');
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'passenger');

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- User roles table FIRST (before has_role function)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Now create has_role function (table exists now)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  user_type user_type NOT NULL DEFAULT 'passenger',
  selfie_url TEXT,
  phone_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  cnh_number TEXT,
  cnh_ear BOOLEAN DEFAULT false,
  cnh_front_url TEXT,
  cnh_back_url TEXT,
  category vehicle_category NOT NULL DEFAULT 'car',
  vehicle_model TEXT,
  vehicle_color TEXT,
  vehicle_plate TEXT,
  status driver_status NOT NULL DEFAULT 'pending',
  balance DECIMAL(10,2) NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  total_rides INTEGER DEFAULT 0,
  daily_cancellations INTEGER DEFAULT 0,
  last_cancellation_reset DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own data" ON public.drivers
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Drivers can update own data" ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Drivers can insert own data" ON public.drivers
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all drivers" ON public.drivers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Rides table
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES auth.users(id),
  driver_id UUID REFERENCES auth.users(id),
  origin_address TEXT NOT NULL,
  origin_lat DECIMAL(10,7),
  origin_lng DECIMAL(10,7),
  destination_address TEXT NOT NULL,
  destination_lat DECIMAL(10,7),
  destination_lng DECIMAL(10,7),
  stops JSONB DEFAULT '[]',
  category vehicle_category NOT NULL DEFAULT 'car',
  passenger_count INTEGER NOT NULL DEFAULT 1,
  distance_km DECIMAL(8,2),
  duration_minutes INTEGER,
  price DECIMAL(10,2),
  platform_fee DECIMAL(10,2),
  driver_net DECIMAL(10,2),
  status ride_status NOT NULL DEFAULT 'requested',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Passengers can view own rides" ON public.rides
  FOR SELECT USING (auth.uid() = passenger_id);
CREATE POLICY "Drivers can view assigned rides" ON public.rides
  FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Passengers can create rides" ON public.rides
  FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Drivers can update assigned rides" ON public.rides
  FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Admins can manage all rides" ON public.rides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recharges table
CREATE TABLE public.recharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  bonus DECIMAL(10,2) DEFAULT 0,
  method recharge_method NOT NULL,
  status recharge_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own recharges" ON public.recharges
  FOR SELECT USING (auth.uid() = driver_id);
CREATE POLICY "Drivers can create recharges" ON public.recharges
  FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Admins can manage all recharges" ON public.recharges
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tariffs table
CREATE TABLE public.tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category vehicle_category NOT NULL,
  region TEXT NOT NULL DEFAULT 'default',
  base_fare DECIMAL(8,2) NOT NULL DEFAULT 5.00,
  per_km DECIMAL(8,2) NOT NULL DEFAULT 1.80,
  per_minute DECIMAL(8,2) NOT NULL DEFAULT 0.45,
  min_fare DECIMAL(8,2) NOT NULL DEFAULT 12.00,
  region_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
  passenger_extra DECIMAL(8,2) NOT NULL DEFAULT 2.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, region)
);
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tariffs" ON public.tariffs
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage tariffs" ON public.tariffs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_tariffs_updated_at BEFORE UPDATE ON public.tariffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Platform settings
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings" ON public.platform_settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.platform_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Fraud alerts
CREATE TABLE public.fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  ride_id UUID REFERENCES public.rides(id),
  severity fraud_severity NOT NULL,
  description TEXT NOT NULL,
  gps_data JSONB,
  route_similarity DECIMAL(5,2),
  time_match_minutes INTEGER,
  action_taken TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage fraud alerts" ON public.fraud_alerts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, cpf, email, user_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'cpf', ''),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'passenger')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'user_type')::app_role, 'passenger')
  );
  
  IF NEW.raw_user_meta_data->>'user_type' = 'driver' THEN
    INSERT INTO public.drivers (user_id, category)
    VALUES (
      NEW.id,
      COALESCE((NEW.raw_user_meta_data->>'category')::vehicle_category, 'car')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_drivers_status ON public.drivers(status);
CREATE INDEX idx_rides_passenger ON public.rides(passenger_id);
CREATE INDEX idx_rides_driver ON public.rides(driver_id);
CREATE INDEX idx_rides_status ON public.rides(status);
CREATE INDEX idx_rides_created ON public.rides(created_at DESC);
CREATE INDEX idx_recharges_driver ON public.recharges(driver_id);
CREATE INDEX idx_fraud_alerts_driver ON public.fraud_alerts(driver_id);
