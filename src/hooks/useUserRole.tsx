import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useTenant } from '@/contexts/TenantContext';

type WorkspaceRole = 'owner' | 'admin' | 'agent';

export function useUserRole() {
  const { user, loading: authLoading, appMetadata, workspaceRole: primaryWorkspaceRole } = useAuth();
  const { activeTenant, loading: tenantLoading } = useTenant();

  const workspaceRoles = appMetadata.workspace_roles ?? appMetadata.tenant_roles ?? {};
  const role = useMemo<WorkspaceRole>(() => {
    if (!user) return 'agent';
    if (activeTenant?.id && workspaceRoles[activeTenant.id]) {
      return workspaceRoles[activeTenant.id];
    }
    return primaryWorkspaceRole;
  }, [activeTenant?.id, primaryWorkspaceRole, user, workspaceRoles]);

  const roles = useMemo(() => {
    if (!user) return [] as WorkspaceRole[];

    const resolvedRoles: WorkspaceRole[] = ['agent'];
    if (role === 'admin' || role === 'owner') resolvedRoles.unshift('admin');
    if (role === 'owner') resolvedRoles.unshift('owner');
    return resolvedRoles;
  }, [role, user]);

  const loading = authLoading || tenantLoading;
  const isOwner = role === 'owner';
  const isAdmin = isOwner || role === 'admin';
  const isAgent = roles.includes('agent');

  return { roles, role, isAdmin, isOwner, isAgent, loading };
}
