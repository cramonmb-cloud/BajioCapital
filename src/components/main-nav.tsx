'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Landmark,
  FileText,
  Wallet,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
  },
  {
    href: '/dashboard/clients',
    label: 'Clientes',
  },
  {
    href: '/dashboard/loans',
    label: 'Préstamos',
  },
  {
    href: '/dashboard/wallet',
    label: 'Cartera',
  },
  {
    href: '/dashboard/plans',
    label: 'Planes',
  },
  {
    href: '/dashboard/settings',
    label: 'Ajustes',
  }
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <>
      {links.map((link) => (
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
