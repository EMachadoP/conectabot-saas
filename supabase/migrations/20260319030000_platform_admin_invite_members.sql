CREATE OR REPLACE FUNCTION public.platform_can_manage_workspace(p_workspace_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_platform_admin(p_user_id)
    OR public.can_manage_workspace_members(p_workspace_id, p_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.platform_can_manage_workspace(uuid, uuid) TO authenticated, service_role;
