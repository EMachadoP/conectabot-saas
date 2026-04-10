import { MessageSquare, BarChart3, Settings, Bot, MoreHorizontal, Calendar, Ticket, Users, Share2, Link2, CreditCard, ListTodo, Sun, Moon, Circle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { usePendingTaskCount } from '@/hooks/usePendingTaskCount';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { PRODUCT } from '@/config/product';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { path: '/inbox', label: 'Conversas', icon: MessageSquare },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/calendar', label: 'Agenda', icon: Calendar, featureFlag: 'enableCalendar' as const },
  { path: '/tasks', label: 'Tarefas', icon: ListTodo },
  { path: '/sac', label: 'SAC', icon: Ticket, featureFlag: 'enableProtocols' as const },
];

const adminItems = [
  { path: '/admin/ai', label: 'IA', icon: Bot },
  { path: '/admin/zapi', label: 'Z-API', icon: Share2 },
  { path: '/admin/integrations', label: 'Integrações', icon: Link2 },
  { path: '/settings/team', label: 'Equipe', icon: Users },
  { path: '/settings/billing', label: 'Plano', icon: CreditCard },
  { path: '/super-admin/clients', label: 'Clientes', icon: Users, platformOnly: true },
];

export function MobileBottomNav() {
  const location = useLocation();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { isPlatformAdmin } = usePlatformAdmin();
  const pendingTasks = usePendingTaskCount();
  const { theme, setTheme } = useTheme();

  const themeOptions: { value: 'light' | 'dark' | 'black'; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'black', label: 'Black', icon: Circle },
  ];

  const isActive = (path: string) => {
    if (path === '/inbox') {
      return location.pathname === '/inbox' || location.pathname.startsWith('/inbox/');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="bottom-nav">
      <div className="flex items-center justify-around h-14">
        {navItems
          .filter(item => !item.featureFlag || PRODUCT.flags[item.featureFlag])
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            const isTasksItem = item.path === '/tasks';
            const taskBadgeCount = isTasksItem ? pendingTasks.total : 0;
            const taskBadgeOverdue = isTasksItem && pendingTasks.overdue > 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn('bottom-nav-item flex-1 relative', active && 'active')}
              >
                <div className="relative inline-flex">
                  <Icon className="w-5 h-5" />
                  {taskBadgeCount > 0 && (
                    <span className={cn(
                      'absolute -top-1.5 -right-2 inline-flex items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white min-w-[16px] h-4',
                      taskBadgeOverdue ? 'bg-destructive' : 'bg-primary'
                    )}>
                      {taskBadgeCount > 99 ? '99+' : taskBadgeCount}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}

        {!roleLoading && isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'bottom-nav-item flex-1',
                  (isActive('/admin') || isActive('/admin/ai')) && 'active'
                )}
              >
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-xs mt-1">Menu</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 mb-2">
              {adminItems
                .filter((item) => !item.platformOnly || isPlatformAdmin)
                .map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={item.path} className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuItem asChild>
                <Link to="/status" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Status
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-1.5">Visualização</p>
                <div className="flex gap-1">
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-0.5 rounded p-1.5 text-xs transition-colors',
                        theme === value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {(roleLoading || !isAdmin) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'bottom-nav-item flex-1',
                  isActive('/status') && 'active'
                )}
              >
                <Settings className="w-5 h-5" />
                <span className="text-xs mt-1">Config</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 mb-2">
              <DropdownMenuItem asChild>
                <Link to="/status" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Status
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <p className="text-xs text-muted-foreground mb-1.5">Visualização</p>
                <div className="flex gap-1">
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        'flex-1 flex flex-col items-center gap-0.5 rounded p-1.5 text-xs transition-colors',
                        theme === value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </nav>
  );
}
