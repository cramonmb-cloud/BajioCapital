'use client';

import { Logo } from '@/components/logo';
import { MainNav, allLinks } from '@/components/main-nav';
import { UserNav } from '@/components/user-nav';
import { MobileNavBar } from '@/components/mobile-nav-bar';
import { Button } from '@/components/ui/button';
import { Bell, Menu, Search } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Loading from './loading';
import type { UserPermissions } from '@/lib/types';
import { getAppConfig } from '@/lib/firestore-data';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, appUser, loading } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFormat, setLogoFormat] = useState<'square' | 'horizontal'>('square');
  const [logoHeightHeader, setLogoHeightHeader] = useState<number | undefined>(undefined);
  const [logoWidthHeader, setLogoWidthHeader] = useState<number | undefined>(undefined);
  const [appName, setAppName] = useState<string>('CrediControl');
  const [menuConfig, setMenuConfig] = useState<Record<string, 'operacion' | 'administracion'> | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'operacion' | 'administracion'>('operacion');
  const [operacionColor, setOperacionColor] = useState<string>('#3b82f6');
  const [administracionColor, setAdministracionColor] = useState<string>('#8b5cf6');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const mergedMenuConfig = useMemo(() => {
    const defaultMenuConfig: Record<string, 'operacion' | 'administracion'> = {
      dashboard: 'operacion',
      clients: 'operacion',
      consultarCliente: 'operacion',
      loans: 'operacion',
      overduePortfolio: 'operacion',
      carteraVencida: 'operacion',
      wallet: 'administracion',
      control: 'administracion',
      settings: 'administracion',
    };
    return { ...defaultMenuConfig, ...menuConfig };
  }, [menuConfig]);

  // Sync activeTab with current pathname
  useEffect(() => {
    const matchingLink = allLinks.find(link => 
      pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
    );
    if (matchingLink) {
      const category = mergedMenuConfig[matchingLink.id] || 'operacion';
      setActiveTab(category);
    }
  }, [pathname, mergedMenuConfig]);

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
      if (config?.menuConfig) {
        setMenuConfig(config.menuConfig);
      }
      if (config?.operacionColor) {
        setOperacionColor(config.operacionColor);
      }
      if (config?.administracionColor) {
        setAdministracionColor(config.administracionColor);
      }
      if (config?.logoFormat) {
        setLogoFormat(config.logoFormat as 'square' | 'horizontal');
      }
      if (config?.logoHeightHeader) {
        setLogoHeightHeader(config.logoHeightHeader);
      }
      if (config?.logoWidthHeader) {
        setLogoWidthHeader(config.logoWidthHeader);
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
      <header className="sticky top-0 z-50 flex flex-col border-b border-border/40 bg-background/60 backdrop-blur-xl shadow-[0_1px_10px_-5px_rgba(0,0,0,0.05)]">
          {/* Fila Superior */}
          <div className="flex h-12 w-full items-center justify-between px-4 md:px-8 relative">
              <div className="flex items-center gap-2">
                 <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0 md:hidden hover:bg-muted/50 rounded-full h-9 w-9">
                          <Menu className="h-5 w-5" />
                          <span className="sr-only">Toggle navigation menu</span>
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="flex flex-col w-[280px] p-0 border-r border-border/40 shadow-2xl">
                        <SheetHeader className="p-6 border-b border-border/10 text-left bg-muted/20">
                          <Logo logoUrl={logoUrl} logoFormat={logoFormat} appName={appName} className="mb-0" size="md" customHeight={logoHeightHeader} customWidth={logoWidthHeader} />
                          <SheetTitle className="sr-only">{appName}</SheetTitle>
                          <SheetDescription className="sr-only">Menú de navegación principal</SheetDescription>
                        </SheetHeader>
                        <nav className="flex-1 overflow-y-auto py-4">
                          <MainNav 
                            isMobile={true} 
                            onLinkClick={() => setMobileMenuOpen(false)} 
                            menuConfig={menuConfig} 
                            activeTab={activeTab} 
                            setActiveTab={setActiveTab}
                            operacionColor={operacionColor}
                            administracionColor={administracionColor}
                          />
                        </nav>
                      </SheetContent>
                  </Sheet>
                  
                  {/* Logo escritorio */}
                  <Link
                      href="/dashboard"
                      className="hidden items-center gap-2 md:flex mr-4 transition-transform active:scale-95"
                  >
                      <Logo logoUrl={logoUrl} logoFormat={logoFormat} appName={appName} size="md" customHeight={logoHeightHeader} customWidth={logoWidthHeader} />
                  </Link>
              </div>

              {/* Logo centrado en móvil */}
              <div className="absolute left-1/2 -translate-x-1/2 md:hidden">
                  <Link href="/dashboard" className="transition-transform active:scale-95">
                      <Logo logoUrl={logoUrl} logoFormat={logoFormat} appName={appName} size="md" customHeight={logoHeightHeader} customWidth={logoWidthHeader} />
                  </Link>
              </div>

              {/* Centro: Selector de Pestañas (Solo Escritorio) */}
              <div className="hidden md:flex">
                  <div className="inline-flex items-center bg-muted/65 p-0.5 rounded-full border border-border/40 shadow-inner h-8">
                      <button
                        onClick={() => setActiveTab('operacion')}
                        style={activeTab === 'operacion' ? { backgroundColor: operacionColor, color: '#ffffff' } : undefined}
                        className={cn(
                          "px-4 py-1 rounded-full text-xs font-bold transition-all duration-300 active:scale-95",
                          activeTab === 'operacion'
                            ? "shadow-sm ring-1 ring-border/20 font-black"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Operación
                      </button>
                      <button
                        onClick={() => setActiveTab('administracion')}
                        style={activeTab === 'administracion' ? { backgroundColor: administracionColor, color: '#ffffff' } : undefined}
                        className={cn(
                          "px-4 py-1 rounded-full text-xs font-bold transition-all duration-300 active:scale-95",
                          activeTab === 'administracion'
                            ? "shadow-sm ring-1 ring-border/20 font-black"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Administración
                      </button>
                  </div>
              </div>

              {/* Derecha: Acciones y Perfil */}
              <div className="flex items-center gap-1">
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
          </div>

          {/* Fila Inferior: Enlaces (Solo Escritorio) */}
          <div className="hidden md:flex w-full justify-center py-1">
              <MainNav 
                menuConfig={menuConfig} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab}
                operacionColor={operacionColor}
                administracionColor={administracionColor}
              />
          </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 px-4 py-2 md:gap-4 md:px-8 md:py-3 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out pb-24 md:pb-8">
        {children}
      </main>
      <MobileNavBar />
    </div>
  );
}
