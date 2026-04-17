CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL, action TEXT NOT NULL, description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission_id)
);
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS public.staff_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','blocked','pending','suspended')),
  notes TEXT, created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, email TEXT, success BOOLEAN NOT NULL,
  ip_address TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master'::public.app_role)
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _perm_id UUID; _override BOOLEAN; _role_grant BOOLEAN;
BEGIN
  IF public.is_master(_user_id) THEN RETURN TRUE; END IF;
  SELECT id INTO _perm_id FROM public.permissions WHERE module = _module AND action = _action;
  IF _perm_id IS NULL THEN RETURN FALSE; END IF;
  SELECT granted INTO _override FROM public.user_permissions WHERE user_id = _user_id AND permission_id = _perm_id;
  IF _override IS NOT NULL THEN RETURN _override; END IF;
  SELECT EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = _user_id AND rp.permission_id = _perm_id) INTO _role_grant;
  RETURN COALESCE(_role_grant, FALSE);
END; $$;

DROP POLICY IF EXISTS "Authenticated can read permissions" ON public.permissions;
CREATE POLICY "Authenticated can read permissions" ON public.permissions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Master manages permissions" ON public.permissions;
CREATE POLICY "Master manages permissions" ON public.permissions FOR ALL USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated can read role_permissions" ON public.role_permissions FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Master manages role_permissions" ON public.role_permissions;
CREATE POLICY "Master manages role_permissions" ON public.role_permissions FOR ALL USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Users read own permissions" ON public.user_permissions;
CREATE POLICY "Users read own permissions" ON public.user_permissions FOR SELECT USING (auth.uid() = user_id OR public.is_master(auth.uid()));
DROP POLICY IF EXISTS "Master manages user_permissions" ON public.user_permissions;
CREATE POLICY "Master manages user_permissions" ON public.user_permissions FOR ALL USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Users read own staff record" ON public.staff_users;
CREATE POLICY "Users read own staff record" ON public.staff_users FOR SELECT USING (auth.uid() = user_id OR public.is_master(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS "Master manages staff_users" ON public.staff_users;
CREATE POLICY "Master manages staff_users" ON public.staff_users FOR ALL USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Master reads login_logs" ON public.login_logs;
CREATE POLICY "Master reads login_logs" ON public.login_logs FOR SELECT USING (public.is_master(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role));
DROP POLICY IF EXISTS "System inserts login_logs" ON public.login_logs;
CREATE POLICY "System inserts login_logs" ON public.login_logs FOR INSERT WITH CHECK (true);

DROP TRIGGER IF EXISTS staff_users_updated_at ON public.staff_users;
CREATE TRIGGER staff_users_updated_at BEFORE UPDATE ON public.staff_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'master'::public.app_role FROM public.profiles WHERE email = 'dheiime@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.permissions (module, action, description) VALUES
  ('dashboard','view','Ver dashboard'),
  ('users','view','Listar usuários'),('users','create','Criar usuários'),('users','edit','Editar usuários'),('users','delete','Excluir usuários'),('users','block','Bloquear usuários'),
  ('drivers','view','Listar motoristas'),('drivers','create','Criar motorista'),('drivers','edit','Editar motorista'),('drivers','delete','Excluir motorista'),('drivers','approve','Aprovar motorista'),('drivers','block','Bloquear motorista'),('drivers','export','Exportar motoristas'),
  ('passengers','view','Listar passageiros'),('passengers','edit','Editar passageiros'),('passengers','block','Bloquear passageiros'),('passengers','export','Exportar passageiros'),
  ('rides','view','Ver corridas'),('rides','edit','Editar corridas'),('rides','cancel','Cancelar corridas'),('rides','export','Exportar corridas'),
  ('finance','view','Ver financeiro'),('finance','approve','Aprovar saques'),('finance','export','Exportar financeiro'),
  ('reports','view','Ver relatórios'),('reports','export','Exportar relatórios'),
  ('support','view','Ver suporte'),('support','edit','Responder tickets'),
  ('chats','view','Ver chats'),
  ('coupons','view','Ver cupons'),('coupons','create','Criar cupons'),('coupons','edit','Editar cupons'),('coupons','delete','Excluir cupons'),
  ('campaigns','view','Ver campanhas'),('campaigns','create','Criar campanhas'),('campaigns','edit','Editar campanhas'),('campaigns','delete','Excluir campanhas'),
  ('tariffs','view','Ver tarifas'),('tariffs','edit','Editar tarifas'),
  ('fraud','view','Ver fraudes'),('fraud','edit','Tratar fraudes'),
  ('audit','view','Ver auditoria'),
  ('live','view','Ver mapa ao vivo'),
  ('settings','view','Ver configurações'),('settings','edit','Editar configurações'),
  ('staff','view','Ver funcionários internos'),('staff','create','Criar funcionário'),('staff','edit','Editar funcionário'),('staff','delete','Excluir funcionário'),('staff','manage_permissions','Gerenciar permissões')
ON CONFLICT (module, action) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'master'::public.app_role, id FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
WHERE NOT (module = 'staff') AND NOT (module = 'settings' AND action = 'edit')
ON CONFLICT (role, permission_id) DO NOTHING;