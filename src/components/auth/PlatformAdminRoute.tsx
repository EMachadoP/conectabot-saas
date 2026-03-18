import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Loader2 } from 'lucide-react';

interface PlatformAdminRouteProps {
  children: ReactNode;
}

export function PlatformAdminRoute({ children }: PlatformAdminRouteProps) {
  const { isPlatformAdmin, loading } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/inbox" replace />;
  }

  return <>{children}</>;
}
