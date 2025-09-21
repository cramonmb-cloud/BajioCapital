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


const allLinks: { href: string; id: keyof UserPermissions }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings' },
];


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
      router.push('/login');
      return;
    }
    
    if (!loading && appUser && pathname === '/dashboard') {
        // If user is not an admin and does not have dashboard access
        if (appUser.role !== 'admin' && !appUser.permissions?.dashboard) {
            // Find the first page the user *does* have access to
            const firstAllowedPage = allLinks.find(link => link.id !== 'dashboard' && appUser.permissions?.[link.id]);
            if (firstAllowedPage) {
                router.replace(firstAllowedPage.href);
            }
            // If they have no permissions at all, they'll just see a blank page under /dashboard, which is acceptable.
        }
    }

  }, [user, appUser, loading, router, pathname]);

  if (loading || !user) {
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
