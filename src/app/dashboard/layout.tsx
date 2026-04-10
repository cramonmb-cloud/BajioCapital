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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';


const allLinks = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/overdue-portfolio', label: 'Pendientes', id: 'overduePortfolio'},
  { href: '/dashboard/cartera-vencida', label: 'Vencida', id: 'carteraVencida'},
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet' },
  { href: '/dashboard/control', label: 'Control', id: 'control' },
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
    <div className="flex min-h-screen w-full flex-col bg-background/50">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 md:px-6">
         <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-[300px] p-0">
                <SheetHeader className="p-6 border-b text-left">
                  <Logo logoUrl={logoUrl} appName={appName} className="mb-0" />
                  <SheetTitle className="sr-only">{appName}</SheetTitle>
                  <SheetDescription className="sr-only">Menú de navegación principal</SheetDescription>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto p-4">
                  <MainNav isMobile={true} onLinkClick={() => setMobileMenuOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>

        <Link
            href="/dashboard"
            className="hidden items-center gap-2 text-lg font-bold md:flex mr-6"
          >
            <Logo logoUrl={logoUrl} appName={appName} size="sm" />
        </Link>
        <div className="flex-1 hidden md:block">
          <MainNav />
        </div>
       
        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Toggle notifications</span>
          </Button>
          <div className="h-8 w-[1px] bg-border mx-1" />
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 max-w-[1600px] mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
