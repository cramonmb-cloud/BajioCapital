'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, FileText, Settings, type LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
    <TooltipProvider>
        <div className="flex items-center gap-2">
            {allowedLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                return (
                    <Tooltip key={link.href}>
                        <TooltipTrigger asChild>
                             <Button
                                asChild
                                variant={isActive ? 'secondary' : 'ghost'}
                                size="icon"
                                aria-label={link.label}
                            >
                                <Link href={link.href}>
                                    <link.icon className="h-5 w-5" />
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{link.label}</p>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    </TooltipProvider>
  );
}
