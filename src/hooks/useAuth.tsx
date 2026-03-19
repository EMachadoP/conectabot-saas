import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getAppUrl } from '@/lib/app-url';

type WorkspaceRole = 'owner' | 'admin' | 'agent';

type AppMetadata = {
  workspace_id?: string | null;
  workspace_ids?: string[];
  workspace_role?: WorkspaceRole | null;
  workspace_roles?: Record<string, WorkspaceRole>;
  tenant_id?: string | null;
  tenant_ids?: string[];
  tenant_role?: WorkspaceRole | null;
  tenant_roles?: Record<string, WorkspaceRole>;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  appMetadata: AppMetadata;
  primaryWorkspaceId: string | null;
  workspaceRole: WorkspaceRole;
  isAdmin: boolean;
  isOwner: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, companyName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string, companyName: string) => {
    const redirectUrl = `${getAppUrl()}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          full_name: name,
          company_name: companyName,
          workspace_name: companyName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const appMetadata = (session?.user?.app_metadata ?? {}) as AppMetadata;
  const primaryWorkspaceId = appMetadata.workspace_id ?? appMetadata.tenant_id ?? null;
  const workspaceRole = appMetadata.workspace_role ?? appMetadata.tenant_role ?? 'agent';
  const isOwner = workspaceRole === 'owner';
  const isAdmin = isOwner || workspaceRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        appMetadata,
        primaryWorkspaceId,
        workspaceRole,
        isAdmin,
        isOwner,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
