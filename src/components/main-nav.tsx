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
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet', icon: Wallet },
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
    return appUser.permissions && appUser.permissions[link.id];
  });

  const getIconClass = (id: string, baseClass: string, isActive: boolean) => {
    return cn(
        baseClass,
        !isActive && 'text-muted-foreground/70',
        id === 'overduePortfolio' && (isActive ? 'text-orange-500' : 'group-hover:text-orange-500'),
        id === 'carteraVencida' && (isActive ? 'text-red-600' : 'group-hover:text-red-600'),
        id === 'control' && (isActive ? 'text-blue-600' : 'group-hover:text-blue-600'),
        isActive && id !== 'overduePortfolio' && id !== 'carteraVencida' && id !== 'control' && 'text-primary'
    );
  };

  if (isMobile) {
    return (
        <div className="flex flex-col gap-1">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            'group flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition-all duration-200',
                            isActive 
                                ? 'bg-primary/10 text-primary' 
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                        onClick={onLinkClick}
                    >
                        <link.icon className={getIconClass(link.id, "h-5 w-5 transition-colors", isActive)} />
                        {link.label}
                    </Link>
                );
            })}
        </div>
    );
  }

  return (
        <div className="flex items-center gap-1">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            'group flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200',
                            isActive 
                                ? 'bg-primary/10 text-primary' 
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        <link.icon className={getIconClass(link.id, "h-4 w-4 transition-colors", isActive)} />
                        <span>{link.label}</span>
                    </Link>
                );
            })}
        </div>
  );
}
