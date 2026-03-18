CREATE OR REPLACE FUNCTION public.prevent_workspace_lockout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_remaining_managers integer;
  v_old_role text;
  v_new_role text;
  v_workspace_active boolean;
BEGIN
  v_workspace_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  v_old_role := COALESCE(OLD.role, 'agent');
  v_new_role := COALESCE(NEW.role, 'agent');

  SELECT COALESCE(t.is_active, true)
  INTO v_workspace_active
  FROM public.tenants t
  WHERE t.id = v_workspace_id;

  IF COALESCE(v_workspace_active, true) = false THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF v_old_role NOT IN ('owner', 'admin') THEN
      RETURN OLD;
    END IF;

    SELECT count(*)
    INTO v_remaining_managers
    FROM public.tenant_members tm
    WHERE tm.tenant_id = v_workspace_id
      AND tm.is_active = true
      AND COALESCE(tm.role, 'agent') IN ('owner', 'admin')
      AND tm.user_id <> OLD.user_id;

    IF v_remaining_managers = 0 THEN
      RAISE EXCEPTION 'Nao e permitido remover o ultimo owner/admin do workspace.';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF v_old_role IN ('owner', 'admin')
       AND (COALESCE(NEW.is_active, false) = false OR v_new_role NOT IN ('owner', 'admin')) THEN
      SELECT count(*)
      INTO v_remaining_managers
      FROM public.tenant_members tm
      WHERE tm.tenant_id = v_workspace_id
        AND tm.is_active = true
        AND COALESCE(tm.role, 'agent') IN ('owner', 'admin')
        AND tm.user_id <> OLD.user_id;

      IF v_remaining_managers = 0 THEN
        RAISE EXCEPTION 'Nao e permitido rebaixar ou desativar o ultimo owner/admin do workspace.';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
