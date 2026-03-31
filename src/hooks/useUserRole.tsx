import { useEffect, useMemo, useState } from 'react';
import { useAuth } from './useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';

type WorkspaceRole = 'owner' | 'admin' | 'agent';

export function useUserRole() {
  const { user, loading: authLoading, appMetadata, workspaceRole: primaryWorkspaceRole } = useAuth();
  const { activeTenant, loading: tenantLoading } = useTenant();
  const [dbRole, setDbRole] = useState<WorkspaceRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const workspaceRoles = appMetadata.workspace_roles ?? appMetadata.tenant_roles ?? {};
  const metadataRole = useMemo<WorkspaceRole>(() => {
    if (!user) return 'agent';
    if (activeTenant?.id && workspaceRoles[activeTenant.id]) {
      return workspaceRoles[activeTenant.id];
    }
    return primaryWorkspaceRole;
  }, [activeTenant?.id, primaryWorkspaceRole, user, workspaceRoles]);

  useEffect(() => {
    let cancelled = false;

    const loadRoleFromMembership = async () => {
      if (!user || !activeTenant?.id) {
        if (!cancelled) {
          setDbRole(null);
          setRoleLoading(false);
        }
        return;
      }

      setRoleLoading(true);
      const { data, error } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', activeTenant.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data?.role && ['owner', 'admin', 'agent'].includes(data.role)) {
          setDbRole(data.role as WorkspaceRole);
        } else {
          setDbRole(null);
        }
        setRoleLoading(false);
      }
    };

    if (!authLoading && !tenantLoading) {
      void loadRoleFromMembership();
    }

    return () => {
      cancelled = true;
    };
  }, [activeTenant?.id, authLoading, tenantLoading, user]);

  const role = useMemo<WorkspaceRole>(() => {
    if (!user) return 'agent';
    if (activeTenant?.id) {
      if (roleLoading) return 'agent';
      return dbRole ?? 'agent';
    }
    return metadataRole ?? 'agent';
  }, [activeTenant?.id, dbRole, metadataRole, roleLoading, user]);

  const roles = useMemo(() => {
    if (!user) return [] as WorkspaceRole[];

    const resolvedRoles: WorkspaceRole[] = ['agent'];
    if (role === 'admin' || role === 'owner') resolvedRoles.unshift('admin');
    if (role === 'owner') resolvedRoles.unshift('owner');
    return resolvedRoles;
  }, [role, user]);

  const loading = authLoading || tenantLoading || roleLoading;
  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'admin';
  const isAgent = roles.includes('agent');

  return { roles, role, isAdmin, isOwner, isAgent, loading };
}
