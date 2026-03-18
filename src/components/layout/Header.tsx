import { useState } from 'react';
import { MessageSquare, BarChart3, Settings, LogOut, Bot, Contact, Link2, User, Share2, Calendar, Ticket, Users, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { useBillingOverview } from '@/hooks/useBillingOverview';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { PRODUCT } from '@/config/product';
import logo from '@/assets/logo.png';

const navItems = [
  { path: '/inbox', label: 'Conversas', icon: MessageSquare },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/calendar', label: 'Agenda', icon: Calendar, featureFlag: 'enableCalendar' as const },
  { path: '/sac', label: 'SAC', icon: Ticket, featureFlag: 'enableProtocols' as const },
  { path: '/admin/ai', label: 'IA', icon: Bot, adminOnly: true },
  { path: '/admin/zapi', label: 'Z-API', icon: Share2, adminOnly: true },
  { path: '/admin/integrations', label: 'Integrações', icon: Link2, adminOnly: true },
  { path: '/admin/contacts', label: 'Duplicados', icon: Contact, adminOnly: true },
  { path: '/settings/team', label: 'Equipe', icon: Users, adminOnly: true },
  { path: '/settings/billing', label: 'Plano', icon: CreditCard, adminOnly: true },
  { path: '/super-admin/clients', label: 'Clientes', icon: Users, adminOnly: true, platformOnly: true },
];

export function Header() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { profile, displayName, refetch } = useProfile();
  const { isAdmin } = useUserRole();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { data: billingOverview } = useBillingOverview();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const usageRatio = billingOverview?.maxUsageRatio ?? 0;
  const usageBadgeTone = usageRatio >= 1 ? 'destructive' : usageRatio >= 0.8 ? 'secondary' : 'outline';
  const usageLabel = usageRatio >= 1
    ? 'Limite'
    : usageRatio >= 0.8
      ? `Uso ${Math.round(usageRatio * 100)}%`
      : null;

  const visibleNavItems = navItems.filter(item => {
    if (item.platformOnly && !isPlatformAdmin) return false;
    // Filter by admin permission
    if (item.adminOnly && !isAdmin) return false;
    // Filter by feature flag
    if (item.featureFlag && !PRODUCT.flags[item.featureFlag]) return false;
    return true;
  });

  return (
    <>
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/inbox" className="flex items-center gap-2">
            <div className="w-10 h-10">
              <img src={logo} alt={PRODUCT.name} className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-foreground">{PRODUCT.name}</span>
          </Link>

          <nav className="flex items-center gap-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname.startsWith(item.path);

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive && "bg-muted text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && usageLabel && (
            <Link to="/settings/billing">
              <Badge variant={usageBadgeTone} className="cursor-pointer">
                {usageLabel}
              </Badge>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowProfileModal(true)}
          >
            <User className="w-4 h-4" />
            {displayName || profile?.email}
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <EditProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        profile={profile}
        onProfileUpdated={refetch}
      />
    </>
  );
}
