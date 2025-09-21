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
    // If user has no specific permissions object, or is an admin, show all links
    if (!appUser?.permissions || appUser.role === 'admin') {
      return true;
    }
    // Otherwise, check if the specific permission is granted
    return appUser.permissions[link.id];
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
