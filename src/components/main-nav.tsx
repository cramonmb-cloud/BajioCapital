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
    // If user is admin, show all links, always. This is the main check.
    if (appUser?.role === 'admin') {
      return true;
    }
    
    // For non-admin users, check their permissions object.
    if (appUser?.permissions) {
      return !!appUser.permissions[link.id];
    }
    
    // Fallback for any other case (e.g., user not fully loaded, no permissions set)
    // Only dashboard is shown by default.
    return link.id === 'dashboard';
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
