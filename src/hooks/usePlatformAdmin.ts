import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePlatformAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      if (!user) {
        if (!cancelled) {
          setIsPlatformAdmin(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setIsPlatformAdmin(Boolean(data) && !error);
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadRole();
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return {
    isPlatformAdmin,
    loading: authLoading || loading,
  };
}
