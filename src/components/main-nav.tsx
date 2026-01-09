'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, FileText, Settings, Activity, Search, type LucideIcon } from 'lucide-react';
import { Button } from './ui/button';

const allLinks: { href: string; label: string; id: keyof UserPermissions, icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients', icon: Users },
  { href: '/dashboard/consultar-cliente', label: 'Consultar', id: 'consultarCliente', icon: Search },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans', icon: Landmark },
  { href: '/dashboard/overdue-portfolio', label: 'Cartera Vencida', id: 'overduePortfolio', icon: FileWarning },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet', icon: Wallet },
  { href: '/dashboard/control', label: 'Control', id: 'control', icon: Activity },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans', icon: FileText },
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

  if (isMobile) {
    return (
        <>
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
                            isActive && 'bg-muted text-primary'
                        )}
                        onClick={onLinkClick}
                    >
                        <link.icon className="h-4 w-4" />
                        {link.label}
                    </Link>
                );
            })}
        </>
    );
  }

  return (
        <div className="flex items-center gap-2">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Button
                        key={link.href}
                        asChild
                        variant={isActive ? 'secondary' : 'ghost'}
                        className="h-auto flex flex-col items-center justify-center gap-1 p-2"
                        aria-label={link.label}
                    >
                        <Link href={link.href}>
                            <link.icon className="h-7 w-7" />
                            <span className="text-xs">{link.label}</span>
                        </Link>
                    </Button>
                );
            })}
        </div>
  );
}
