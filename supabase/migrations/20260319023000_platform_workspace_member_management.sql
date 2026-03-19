CREATE OR REPLACE FUNCTION public.platform_list_workspace_members(p_workspace_id uuid)
RETURNS TABLE (
  membership_id uuid,
  workspace_id uuid,
  user_id uuid,
  role text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  profile_email text,
  profile_name text,
  profile_display_name text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.id AS membership_id,
    tm.tenant_id AS workspace_id,
    tm.user_id,
    COALESCE(tm.role, 'agent') AS role,
    tm.is_active,
    tm.created_at,
    tm.updated_at,
    pr.email AS profile_email,
    pr.name AS profile_name,
    pr.display_name AS profile_display_name,
    pr.avatar_url
  FROM public.tenant_members tm
  LEFT JOIN public.profiles pr
    ON pr.id = tm.user_id
  WHERE public.is_platform_admin(auth.uid())
    AND tm.tenant_id = p_workspace_id
  ORDER BY
    CASE COALESCE(tm.role, 'agent')
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    tm.created_at;
$$;

CREATE OR REPLACE FUNCTION public.platform_update_workspace_member_role(
  p_workspace_id uuid,
  p_membership_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_role text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_role NOT IN ('admin', 'agent') THEN
    RAISE EXCEPTION 'Role inválida';
  END IF;

  SELECT tm.user_id, COALESCE(tm.role, 'agent')
  INTO v_user_id, v_current_role
  FROM public.tenant_members tm
  WHERE tm.id = p_membership_id
    AND tm.tenant_id = p_workspace_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_current_role = 'owner' THEN
    RAISE EXCEPTION 'O owner deve ser gerenciado separadamente';
  END IF;

  UPDATE public.tenant_members
  SET role = p_role,
      updated_at = now()
  WHERE id = p_membership_id
    AND tenant_id = p_workspace_id;

  PERFORM public.sync_user_workspace_claims(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_remove_workspace_member(
  p_workspace_id uuid,
  p_membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_role text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT tm.user_id, COALESCE(tm.role, 'agent')
  INTO v_user_id, v_current_role
  FROM public.tenant_members tm
  WHERE tm.id = p_membership_id
    AND tm.tenant_id = p_workspace_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Membro não encontrado';
  END IF;

  IF v_current_role = 'owner' THEN
    RAISE EXCEPTION 'O owner não pode ser removido por esta tela';
  END IF;

  DELETE FROM public.tenant_members
  WHERE id = p_membership_id
    AND tenant_id = p_workspace_id;

  PERFORM public.sync_user_workspace_claims(v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.platform_list_workspace_members(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_update_workspace_member_role(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_remove_workspace_member(uuid, uuid) TO authenticated, service_role;
