DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id
  INTO v_user_id
  FROM auth.users
  WHERE lower(email) = 'eldonmp2@gmail.com'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.user_roles
    WHERE user_id = v_user_id
      AND role = 'admin';
  END IF;
END
$$;
