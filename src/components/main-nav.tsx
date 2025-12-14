'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, FileText, Settings, type LucideIcon } from 'lucide-react';
import { Button } from './ui/button';

const allLinks: { href: string; label: string; id: keyof UserPermissions, icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients', icon: Users },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans', icon: Landmark },
  { href: '/dashboard/overdue-portfolio', label: 'Cartera Vencida', id: 'overduePortfolio', icon: FileWarning },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet', icon: Wallet },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans', icon: FileText },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings', icon: Settings },
];

export function MainNav() {
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

  return (
    <>
      {allowedLinks.map((link) => {
        const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
        return (
            <Button
                key={link.href}
                asChild
                variant={isActive ? 'secondary' : 'ghost'}
                className="justify-start"
            >
                <Link
                href={link.href}
                >
                <link.icon className="mr-2 h-4 w-4" />
                {link.label}
                </Link>
            </Button>
        );
      })}
    </>
  );
}
