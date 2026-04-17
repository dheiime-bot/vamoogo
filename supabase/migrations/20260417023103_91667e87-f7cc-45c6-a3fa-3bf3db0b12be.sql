CREATE OR REPLACE FUNCTION public.check_signup_dupes(_cpf text, _phone text)
RETURNS TABLE(cpf_taken boolean, phone_taken boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.profiles WHERE cpf = _cpf) AS cpf_taken,
    EXISTS(SELECT 1 FROM public.profiles WHERE phone = _phone) AS phone_taken;
$$;

GRANT EXECUTE ON FUNCTION public.check_signup_dupes(text, text) TO anon, authenticated;