import { useState } from 'react';
import { MessageSquare, BarChart3, LogOut, Bot, Contact, Link2, User, Share2, Calendar, Ticket, Users, CreditCard, Building2, ChevronsUpDown, ListTodo, Sun, Moon, Circle } from 'lucide-react';
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
import { useTenant } from '@/contexts/TenantContext';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { usePendingTaskCount } from '@/hooks/usePendingTaskCount';
import { useTheme } from '@/contexts/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import logo from '@/assets/logo.png';

const navItems = [
  { path: '/inbox', label: 'Conversas', icon: MessageSquare },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/calendar', label: 'Agenda', icon: Calendar, featureFlag: 'enableCalendar' as const },
  { path: '/tasks', label: 'Tarefas', icon: ListTodo },
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
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { isPlatformAdmin } = usePlatformAdmin();
  const { data: billingOverview } = useBillingOverview();
  const { activeTenant, tenants, switchTenant } = useTenant();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [switchingTenantId, setSwitchingTenantId] = useState<string | null>(null);
  const pendingTasks = usePendingTaskCount();
  const { theme, setTheme } = useTheme();

  const usageRatio = billingOverview?.maxUsageRatio ?? 0;
  const usageBadgeTone = usageRatio >= 1 ? 'destructive' : usageRatio >= 0.8 ? 'secondary' : 'outline';
  const usageLabel = usageRatio >= 1
    ? 'Limite'
    : usageRatio >= 0.8
      ? `Uso ${Math.round(usageRatio * 100)}%`
      : null;

  const visibleNavItems = navItems.filter(item => {
    if (item.platformOnly && !isPlatformAdmin) return false;
    if (item.adminOnly && (roleLoading || !isAdmin)) return false;
    if (item.featureFlag && !PRODUCT.flags[item.featureFlag]) return false;
    return true;
  });

  const handleTenantChange = async (tenantId: string) => {
    if (!tenantId || tenantId === activeTenant?.id) return;
    setSwitchingTenantId(tenantId);
    await switchTenant(tenantId);
    setSwitchingTenantId(null);
  };

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

              const isTasksItem = item.path === '/tasks';
              const taskBadgeCount = isTasksItem ? pendingTasks.total : 0;
              const taskBadgeOverdue = isTasksItem && pendingTasks.overdue > 0;

              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-2 relative',
                      isActive && 'bg-muted text-foreground'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                    {taskBadgeCount > 0 && (
                      <span className={cn(
                        'ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none text-white',
                        taskBadgeOverdue ? 'bg-destructive' : 'bg-primary'
                      )}>
                        {taskBadgeCount > 99 ? '99+' : taskBadgeCount}
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}

          </nav>
        </div>

        <div className="flex items-center gap-3">
          {activeTenant && tenants.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="max-w-[240px] gap-2">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeTenant.name}</span>
                  <ChevronsUpDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Workspace ativo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={activeTenant.id} onValueChange={handleTenantChange}>
                  {tenants.map((tenant) => (
                    <DropdownMenuRadioItem
                      key={tenant.id}
                      value={tenant.id}
                      disabled={switchingTenantId !== null}
                      className="flex items-center gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{tenant.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{tenant.slug}</p>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!roleLoading && isAdmin && usageLabel && (
            <Link to="/settings/billing">
              <Badge variant={usageBadgeTone} className="cursor-pointer">
                {usageLabel}
              </Badge>
            </Link>
          )}
          <div className="flex items-center rounded-md border border-border p-0.5 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', theme === 'light' && 'bg-muted text-foreground')}
              onClick={() => setTheme('light')}
              title="Tema claro"
            >
              <Sun className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', theme === 'dark' && 'bg-muted text-foreground')}
              onClick={() => setTheme('dark')}
              title="Tema escuro"
            >
              <Moon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-7 w-7', theme === 'black' && 'bg-muted text-foreground')}
              onClick={() => setTheme('black')}
              title="Tema black"
            >
              <Circle className="w-3.5 h-3.5 fill-current" />
            </Button>
          </div>

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

      <CreateTaskModal
        open={showQuickTaskModal}
        onOpenChange={setShowQuickTaskModal}
      />
    </>
  );
}
