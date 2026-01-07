import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    settings: Record<string, any>;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface TenantContextType {
    activeTenant: Tenant | null;
    tenants: Tenant[];
    switchTenant: (tenantId: string) => Promise<void>;
    loading: boolean;
    refreshTenants: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const ACTIVE_TENANT_KEY = 'activeTenantId';

export function TenantProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchTenants = async () => {
        if (!user) {
            setTenants([]);
            setActiveTenant(null);
            setLoading(false);
            return;
        }

        try {
            // Get user's tenants through tenant_members
            const { data: memberData, error: memberError } = await supabase
                .from('tenant_members')
                .select('tenant_id, tenants(*)')
                .eq('user_id', user.id)
                .eq('is_active', true);

            if (memberError) throw memberError;

            const userTenants = memberData
                ?.map(m => m.tenants)
                .filter(Boolean) as Tenant[];

            setTenants(userTenants || []);

            // Set active tenant
            if (userTenants && userTenants.length > 0) {
                const savedTenantId = localStorage.getItem(ACTIVE_TENANT_KEY);
                const savedTenant = userTenants.find(t => t.id === savedTenantId);

                // Use saved tenant if valid, otherwise use first tenant
                const tenantToActivate = savedTenant || userTenants[0];
                setActiveTenant(tenantToActivate);
                localStorage.setItem(ACTIVE_TENANT_KEY, tenantToActivate.id);
            }
        } catch (error) {
            console.error('Error fetching tenants:', error);
        } finally {
            setLoading(false);
        }
    };

    const switchTenant = async (tenantId: string) => {
        const tenant = tenants.find(t => t.id === tenantId);
        if (tenant) {
            setActiveTenant(tenant);
            localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);

            // Reload the page to refresh all data with new tenant context
            window.location.reload();
        }
    };

    const refreshTenants = async () => {
        setLoading(true);
        await fetchTenants();
    };

    useEffect(() => {
        fetchTenants();
    }, [user]);

    const value: TenantContextType = {
        activeTenant,
        tenants,
        switchTenant,
        loading,
        refreshTenants,
    };

    return (
        <TenantContext.Provider value={value}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}
