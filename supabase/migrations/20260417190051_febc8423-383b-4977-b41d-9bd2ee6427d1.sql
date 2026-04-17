-- 1) Status do passageiro e flag de suspeito
DO $$ BEGIN
  CREATE TYPE public.passenger_status AS ENUM ('ativo','bloqueado','suspenso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.passenger_status NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS is_suspect boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspect_reason text,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid;

-- 2) Garantir que apenas admin/master podem alterar perfis de outros
DO $$ BEGIN
  CREATE POLICY "Admins can update profiles"
    ON public.profiles FOR UPDATE
    USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'))
    WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Função para enviar mensagem direta do admin para usuário (via notifications)
CREATE OR REPLACE FUNCTION public.admin_send_message(
  _user_id uuid,
  _title text,
  _message text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (_user_id, 'admin_message', _title, _message)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- 4) Função para excluir conta (master apenas)
CREATE OR REPLACE FUNCTION public.admin_delete_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master') THEN
    RAISE EXCEPTION 'Apenas master pode excluir contas';
  END IF;
  -- Apaga vínculos não cascateados manualmente
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;
END;
$$;