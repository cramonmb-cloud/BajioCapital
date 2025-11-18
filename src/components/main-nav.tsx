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
  { href: '/dashboard/overdue-portfolio', label: 'Cartera Vencida', id: 'overduePortfolio' },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings' },
];

export function MainNav() {
  const pathname = usePathname();
  const { appUser } = useAuth();

  // Si no tenemos la información del usuario, no mostramos nada para evitar errores.
  if (!appUser) {
    return null;
  }

  const allowedLinks = allLinks.filter(link => {
    // Caso 1: El usuario es administrador. Mostrar todos los enlaces.
    if (appUser.role === 'admin') {
      return true;
    }

    // Caso 2: El usuario no es administrador. Verificar sus permisos.
    // Verificar si el usuario tiene el objeto de permisos y si el permiso específico está en true.
    return appUser.permissions && appUser.permissions[link.id];
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
