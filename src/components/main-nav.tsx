'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import type { UserPermissions } from '@/lib/types';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, Settings, Activity, Search, History, Coins, Megaphone, type LucideIcon } from 'lucide-react';

import { useState, useEffect, useMemo } from 'react';

export const allLinks: { href: string; label: string; id: string, icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', id: 'dashboard', icon: LayoutDashboard },
  { href: '/dashboard/clientes', label: 'Clientes', id: 'clients', icon: Users },
  { href: '/dashboard/consultar-cliente', label: 'Consultar', id: 'consultarCliente', icon: Search },
  { href: '/dashboard/prestamos', label: 'Préstamos', id: 'loans', icon: Landmark },
  { href: '/dashboard/pendientes', label: 'Pendientes', id: 'overduePortfolio', icon: FileWarning },
  { href: '/dashboard/cartera-vencida', label: 'Vencida', id: 'carteraVencida', icon: History },
  { href: '/dashboard/debes', label: 'Debes', id: 'debes', icon: Coins },
  { href: '/dashboard/bitacora', label: 'Bitacora', id: 'wallet', icon: Wallet },
  { href: '/dashboard/control', label: 'Control', id: 'control', icon: Activity },
  { href: '/dashboard/ajustes', label: 'Ajustes', id: 'settings', icon: Settings },
  { href: '/dashboard/avisos', label: 'Avisos', id: 'avisos', icon: Megaphone },
];

interface MainNavProps {
    isMobile?: boolean;
    onLinkClick?: () => void;
    menuConfig?: Record<string, 'operacion' | 'administracion'>;
    activeTab: 'operacion' | 'administracion';
    setActiveTab: (tab: 'operacion' | 'administracion') => void;
    operacionColor?: string;
    administracionColor?: string;
}

export function MainNav({ 
  isMobile = false, 
  onLinkClick, 
  menuConfig, 
  activeTab, 
  setActiveTab,
  operacionColor = '#3b82f6',
  administracionColor = '#8b5cf6' 
}: MainNavProps) {
  const pathname = usePathname();
  const { appUser } = useAuth();

  const currentTabColor = activeTab === 'operacion' ? operacionColor : administracionColor;

  const mergedMenuConfig = useMemo(() => {
    const defaultMenuConfig: Record<string, 'operacion' | 'administracion'> = {
      dashboard: 'operacion',
      clients: 'operacion',
      consultarCliente: 'operacion',
      loans: 'operacion',
      overduePortfolio: 'operacion',
      carteraVencida: 'operacion',
      debes: 'operacion',
      wallet: 'administracion',
      control: 'administracion',
      settings: 'administracion',
      avisos: 'administracion',
    };
    return { ...defaultMenuConfig, ...menuConfig };
  }, [menuConfig]);

  if (!appUser) {
    return null;
  }

  const allowedLinks = allLinks.filter(link => {
    if (appUser.role === 'admin') {
      return true;
    }
    
    if (link.id === 'settings') {
        const p = appUser.permissions;
        return p.settings || p.manageUsers || p.manageZones || p.manageMigration || p.managePlans || p.manageSystem || p.manageMaintenance;
    }

    if (link.id === 'avisos') {
        return appUser.permissions && appUser.permissions.manageAvisos;
    }

    return appUser.permissions && appUser.permissions[link.id as keyof UserPermissions];
  });

  const getIconClass = (id: string, isActive: boolean, sizeClass = "h-5 w-5") => {
    return cn(
        sizeClass,
        "transition-all duration-300 transform",
        isActive ? "scale-110" : "group-hover:scale-110 opacity-70 group-hover:opacity-100",
        id === 'overduePortfolio' && (isActive ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'group-hover:text-orange-500'),
        id === 'carteraVencida' && (isActive ? 'text-red-600 drop-shadow-[0_0_8px_rgba(220,38,38,0.4)]' : 'group-hover:text-red-600'),
        id === 'control' && (isActive ? 'text-blue-600 drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]' : 'group-hover:text-blue-600')
    );
  };

  if (isMobile) {
    const filteredLinks = allowedLinks.filter(link => {
      const category = mergedMenuConfig[link.id] || 'operacion';
      return category === activeTab;
    });

    return (
        <div className="flex flex-col gap-4">
            {/* Mobile Tab Selector */}
            <div className="flex bg-muted p-1 rounded-xl border border-border/10 mx-4 justify-between relative h-10 items-center">
              {/* Mobile Sliding Pill Background */}
              <div 
                className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-in-out shadow-sm"
                style={{
                  left: activeTab === 'operacion' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)',
                  backgroundColor: activeTab === 'operacion' ? operacionColor : administracionColor,
                }}
              />
              <button
                onClick={() => setActiveTab('operacion')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all relative z-10",
                  activeTab === 'operacion'
                    ? "text-white font-black"
                    : "text-muted-foreground"
                )}
              >
                Operación
              </button>
              <button
                onClick={() => setActiveTab('administracion')}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs font-bold text-center transition-all relative z-10",
                  activeTab === 'administracion'
                    ? "text-white font-black"
                    : "text-muted-foreground"
                )}
              >
                Administración
              </button>
            </div>

            <div key={activeTab} className="flex flex-col gap-1.5 px-2 animate-in fade-in slide-in-from-left-3 duration-300">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 active:scale-95',
                                isActive 
                                    ? 'shadow-sm' 
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                            style={isActive ? {
                              backgroundColor: `${currentTabColor}15`,
                              color: currentTabColor,
                              boxShadow: `0 0 0 1px ${currentTabColor}30`
                            } : undefined}
                            onClick={onLinkClick}
                        >
                            <link.icon 
                              className={getIconClass(link.id, isActive)} 
                              style={isActive && link.id !== 'overduePortfolio' && link.id !== 'carteraVencida' && link.id !== 'control' ? { color: currentTabColor } : undefined}
                            />
                            {link.label}
                        </Link>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground text-center p-4">No hay secciones en este menú.</p>
                )}
            </div>
        </div>
    );
  }

  const filteredLinks = allowedLinks.filter(link => {
    const category = mergedMenuConfig[link.id] || 'operacion';
    return category === activeTab;
  });

  return (
        <div className="flex items-center bg-muted/40 p-1 rounded-full border border-border/50 backdrop-blur-sm shadow-inner h-10 transition-all duration-300">
            <div key={activeTab} className="flex items-center gap-1.5 h-full animate-in fade-in slide-in-from-bottom-1 duration-300">
                {filteredLinks.length > 0 ? (
                  filteredLinks.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'group flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 relative overflow-hidden h-full',
                                isActive 
                                    ? 'bg-background text-foreground shadow-md ring-1 ring-border/50 translate-y-[-1px]' 
                                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            )}
                        >
                            <link.icon 
                              className={getIconClass(link.id, isActive, "h-4 w-4")} 
                              style={isActive && link.id !== 'overduePortfolio' && link.id !== 'carteraVencida' && link.id !== 'control' ? { 
                                color: currentTabColor,
                                filter: `drop-shadow(0 0 8px ${currentTabColor}60)`
                              } : undefined}
                            />
                            <span className={cn(
                                "transition-all duration-300",
                                isActive ? "opacity-100" : "opacity-80 group-hover:opacity-100"
                            )}>
                                {link.label}
                            </span>
                            {isActive && (
                                <span 
                                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-pulse" 
                                  style={{ backgroundColor: currentTabColor }}
                                />
                            )}
                        </Link>
                    );
                  })
                ) : (
                  <span className="text-xs text-muted-foreground px-6 py-2">No hay secciones en este menú.</span>
                )}
            </div>
        </div>
  );
}
