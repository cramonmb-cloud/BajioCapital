'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, Settings, Activity, Search, History, type LucideIcon } from 'lucide-react';

const allLinks: { href: string; label: string; id: keyof UserPermissions, icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients', icon: Users },
  { href: '/dashboard/consultar-cliente', label: 'Consultar', id: 'consultarCliente', icon: Search },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans', icon: Landmark },
  { href: '/dashboard/overdue-portfolio', label: 'Pendientes', id: 'overduePortfolio', icon: FileWarning },
  { href: '/dashboard/cartera-vencida', label: 'Vencida', id: 'carteraVencida', icon: History },
  { href: '/dashboard/wallet', label: 'Bitacora', id: 'wallet', icon: Wallet },
  { href: '/dashboard/control', label: 'Control', id: 'control', icon: Activity },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings', icon: Settings },
];

interface MainNavProps {
    isMobile?: boolean;
    onLinkClick?: () => void;
}

export function MainNav({ isMobile = false, onLinkClick }: MainNavProps) {
  const pathname = usePathname();
  const { appUser } = useAuth();

  if (!appUser) {
    return null;
  }

  const allowedLinks = allLinks.filter(link => {
    if (appUser.role === 'admin') {
      return true;
    }
    
    if (link.id === 'settings') {
        const p = appUser.permissions;
        return p.settings || p.manageUsers || p.manageZones || p.manageMigration || p.managePlans || p.manageSystem || p.manageMaintenance;
    }

    return appUser.permissions && appUser.permissions[link.id as keyof UserPermissions];
  });

  const getIconClass = (id: string, isActive: boolean) => {
    return cn(
        "h-5 w-5 transition-all duration-300 transform",
        isActive ? "scale-110" : "group-hover:scale-110 opacity-70 group-hover:opacity-100",
        id === 'overduePortfolio' && (isActive ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'group-hover:text-orange-500'),
        id === 'carteraVencida' && (isActive ? 'text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'group-hover:text-red-600'),
        id === 'control' && (isActive ? 'text-blue-600 drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'group-hover:text-blue-600'),
        isActive && id !== 'overduePortfolio' && id !== 'carteraVencida' && id !== 'control' && 'text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.4)]'
    );
  };

  if (isMobile) {
    return (
        <div className="flex flex-col gap-1.5 px-2">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-95',
                            isActive 
                                ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                        onClick={onLinkClick}
                    >
                        <link.icon className={getIconClass(link.id, isActive)} />
                        {link.label}
                    </Link>
                );
            })}
        </div>
    );
  }

  return (
        <div className="flex items-center bg-muted/40 p-1.5 rounded-full border border-border/50 backdrop-blur-sm shadow-inner h-14">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            'group flex items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-300 relative overflow-hidden h-full',
                            isActive 
                                ? 'bg-background text-foreground shadow-md ring-1 ring-border/50 translate-y-[-1px]' 
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        )}
                    >
                        <link.icon className={getIconClass(link.id, isActive)} />
                        <span className={cn(
                            "transition-all duration-300",
                            isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                        )}>
                            {link.label}
                        </span>
                        {isActive && (
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                    </Link>
                );
            })}
        </div>
  );
}
