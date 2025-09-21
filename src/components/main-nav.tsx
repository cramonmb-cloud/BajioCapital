'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';

const allLinks: { href: string; label: string; id: keyof UserPermissions }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings' },
];

export function MainNav() {
  const pathname = usePathname();
  const { appUser } = useAuth();

  const allowedLinks = allLinks.filter(link => {
    // If user is admin, show all links
    if (appUser?.role === 'admin') {
      return true;
    }
    // If user is not admin, check their permissions object
    if (appUser?.permissions) {
      return appUser.permissions[link.id];
    }
    // If no permissions object, only show dashboard if it's the only link they should see
    if (link.id === 'dashboard') {
        return true;
    }
    
    return false;
  });

  return (
    <>
      {allowedLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "transition-colors hover:text-foreground",
            pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
              ? "text-foreground"
              : "text-muted-foreground"
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
