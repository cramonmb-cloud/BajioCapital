'use client';

import { Logo } from '@/components/logo';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Loading from './loading';
import type { UserPermissions } from '@/lib/types';


const allLinks = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings' },
] as const;


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);
  
  // Si todavía está cargando, mostramos un loader general para evitar cualquier renderizado prematuro.
  if (loading || !user) {
    return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  // Una vez que sabemos que el usuario existe, pero antes de tener su perfil (`appUser`),
  // podemos mostrar el layout básico pero sin el contenido principal (hijos).
  if (!appUser) {
    return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  const isDashboardPage = pathname === '/dashboard';
  const hasDashboardAccess = appUser.role === 'admin' || (appUser.permissions && appUser.permissions.dashboard);

  // Si el usuario está en el dashboard pero no tiene acceso, lo redirigimos.
  if (isDashboardPage && !hasDashboardAccess) {
    // Busca la primera página a la que sí tiene acceso.
    const firstAllowedPage = allLinks.find(
      link => link.id !== 'dashboard' && appUser.permissions?.[link.id]
    );

    if (firstAllowedPage) {
      router.replace(firstAllowedPage.href);
    }
    // Mientras se redirige, mostramos el loader para evitar el parpadeo.
    return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <Logo />
            <span className="sr-only">CrediControl</span>
          </Link>
          <MainNav />
        </nav>
        {/* Mobile Menu can be added here if needed */}
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
            <div className="ml-auto flex-1 sm:flex-initial">
                {/* A search bar could go here */}
            </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-4">{children}</main>
    </div>
  );
}
