'use client';

import { Logo } from '@/components/logo';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Bell, Menu } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Loading from './loading';
import type { UserPermissions } from '@/lib/types';
import { getAppConfig } from '@/lib/firestore-data';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';


const allLinks = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/overdue-portfolio', label: 'Pagos Pendientes', id: 'overduePortfolio'},
  { href: '/dashboard/cartera-vencida', label: 'Cartera Vencida', id: 'carteraVencida'},
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/control', label: 'Control', id: 'control' },
  { href: '/dashboard/plans', label: 'Planes', id: 'plans' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings' },
] as const;


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, loading } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [appName, setAppName] = useState<string>('CrediControl');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }
    
    if (appUser) {
        const isDashboardPage = pathname === '/dashboard';
        const hasDashboardAccess = appUser.role === 'admin' || (appUser.permissions && appUser.permissions.dashboard);

        if (isDashboardPage && !hasDashboardAccess) {
            const firstAllowedPage = allLinks.find(
                link => link.id !== 'dashboard' && appUser.permissions?.[link.id as keyof UserPermissions]
            );

            if (firstAllowedPage) {
                router.replace(firstAllowedPage.href);
            }
        }
    }
  }, [user, appUser, loading, router, pathname]);

   useEffect(() => {
    async function fetchConfig() {
      const config = await getAppConfig();
      if (config?.logoUrl) {
        setLogoUrl(config.logoUrl);
      }
      if (config?.appName) {
        setAppName(config.appName);
      }
    }
    fetchConfig();
  }, [pathname]); 
  
  if (loading || !user || !appUser) {
    return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  const isDashboardPage = pathname === '/dashboard';
  const hasDashboardAccess = appUser.role === 'admin' || (appUser.permissions && appUser.permissions.dashboard);
  if (isDashboardPage && !hasDashboardAccess) {
      return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-auto items-center gap-4 border-b bg-background px-4 md:px-6 py-2">
         <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col">
                <nav className="grid gap-2 text-lg font-medium">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 text-lg font-semibold mb-4"
                     onClick={() => setMobileMenuOpen(false)}
                  >
                    <Logo logoUrl={logoUrl} appName={appName} />
                    <span className="sr-only">{appName}</span>
                  </Link>
                  <MainNav isMobile={true} onLinkClick={() => setMobileMenuOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>

        <Link
            href="/dashboard"
            className="hidden items-center gap-2 text-lg font-semibold md:text-base mr-4 md:flex"
          >
            <Logo logoUrl={logoUrl} appName={appName} />
            <span className="sr-only">{appName}</span>
        </Link>
        <div className="flex-1 hidden md:block">
          <MainNav />
        </div>
       
        <div className="flex w-full items-center gap-4 md:ml-auto md:w-auto md:flex-initial justify-end">
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
