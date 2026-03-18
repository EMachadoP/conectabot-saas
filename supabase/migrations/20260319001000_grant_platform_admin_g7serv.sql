INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin'::public.app_role
FROM auth.users au
WHERE lower(au.email) = 'g7serv@g7serv.com.br'
ON CONFLICT (user_id, role) DO NOTHING;
