'use client';

import { Logo } from '@/components/logo';
import { MainNav } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { MobileNavBar } from '@/components/mobile-nav-bar';
import { Button } from '@/components/ui/button';
import { Bell, Menu, Search } from 'lucide-react';
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
  { href: '/dashboard/consultar-cliente', label: 'Consultar', id: 'consultarCliente' },
  { href: '/dashboard/loans', label: 'Préstamos', id: 'loans' },
  { href: '/dashboard/overdue-portfolio', label: 'Pendientes', id: 'overduePortfolio'},
  { href: '/dashboard/cartera-vencida', label: 'Vencida', id: 'carteraVencida'},
  { href: '/dashboard/wallet', label: 'Bitacora', id: 'wallet' },
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
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Loading /></div>;
  }
  
  const isDashboardPage = pathname === '/dashboard';
  const hasDashboardAccess = appUser.role === 'admin' || (appUser.permissions && appUser.permissions.dashboard);
  if (isDashboardPage && !hasDashboardAccess) {
      return <div className="flex h-screen w-full items-center justify-center"><Loading /></div>;
  }
  
  return (
    <div className="flex min-h-screen w-full flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
      <header className="sticky top-0 z-50 flex h-20 items-center gap-4 border-b border-border/40 bg-background/60 backdrop-blur-xl px-4 md:px-8 shadow-[0_1px_10px_-5px_rgba(0,0,0,0.05)]">
         <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 md:hidden hover:bg-muted/50 rounded-full h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="flex flex-col w-[280px] p-0 border-r border-border/40 shadow-2xl">
                <SheetHeader className="p-6 border-b border-border/10 text-left bg-muted/20">
                  <Logo logoUrl={logoUrl} appName={appName} className="mb-0" size="sm" />
                  <SheetTitle className="sr-only">{appName}</SheetTitle>
                  <SheetDescription className="sr-only">Menú de navegación principal</SheetDescription>
                </SheetHeader>
                <nav className="flex-1 overflow-y-auto py-4">
                  <MainNav isMobile={true} onLinkClick={() => setMobileMenuOpen(false)} />
                </nav>
              </SheetContent>
            </Sheet>

        {/* Logo centrado solo en móvil - Tamaño aumentado de sm a lg */}
        <div className="absolute left-1/2 -translate-x-1/2 md:hidden">
          <Link href="/dashboard" className="transition-transform active:scale-95">
            <Logo logoUrl={logoUrl} appName={appName} size="lg" />
          </Link>
        </div>

        <Link
            href="/dashboard"
            className="hidden items-center gap-2 md:flex mr-4 transition-transform active:scale-95"
          >
            <Logo logoUrl={logoUrl} appName={appName} size="sm" />
        </Link>
        
        <div className="flex-1 hidden md:flex justify-center">
          <MainNav />
        </div>
       
        <div className="flex items-center gap-1 ml-auto">
          <div className="hidden sm:flex mr-2">
             <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted/50 transition-colors" asChild>
                <Link href="/dashboard/consultar-cliente">
                    <Search className="h-4 w-4" />
                </Link>
             </Button>
             <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:bg-muted/50 transition-colors relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-primary rounded-full" />
                <span className="sr-only">Notificaciones</span>
             </Button>
          </div>
          <div className="h-6 w-[1px] bg-border/60 mx-2 hidden sm:block" />
          <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out pb-24 md:pb-8">
        {children}
      </main>
      <MobileNavBar />
    </div>
  );
}
