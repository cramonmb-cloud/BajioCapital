'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { LayoutDashboard, Users, Landmark, FileWarning, Wallet, Settings, Activity, Search, History, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const allLinks: { href: string; label: string; id: string, icon: LucideIcon, color: string }[] = [
  { href: '/dashboard', label: 'Inicio', id: 'dashboard', icon: LayoutDashboard, color: '#3b82f6' },
  { href: '/dashboard/clients', label: 'Clientes', id: 'clients', icon: Users, color: '#3b82f6' },
  { href: '/dashboard/consultar-cliente', label: 'Buscar', id: 'consultarCliente', icon: Search, color: '#3b82f6' },
  { href: '/dashboard/loans', label: 'Pagos', id: 'loans', icon: Landmark, color: '#3b82f6' },
  { href: '/dashboard/overdue-portfolio', label: 'Pendientes', id: 'overduePortfolio', icon: FileWarning, color: '#f97316' },
  { href: '/dashboard/cartera-vencida', label: 'Vencida', id: 'carteraVencida', icon: History, color: '#dc2626' },
  { href: '/dashboard/wallet', label: 'Cartera', id: 'wallet', icon: Wallet, color: '#3b82f6' },
  { href: '/dashboard/control', label: 'Control', id: 'control', icon: Activity, color: '#2563eb' },
  { href: '/dashboard/settings', label: 'Ajustes', id: 'settings', icon: Settings, color: '#3b82f6' },
];

export function MobileNavBar() {
  const pathname = usePathname();
  const { appUser } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY < 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!appUser || !appUser.permissions.showMobileNavBar) {
    return null;
  }

  const mobileSections = appUser.permissions.mobileSections || [];
  const linksToShow = allLinks.filter(link => mobileSections.includes(link.id)).slice(0, 5);

  if (linksToShow.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[90%] max-w-[400px] md:hidden">
      <nav className={cn(
        "relative flex items-center justify-around px-4 py-3 rounded-[2.5rem] bg-background/70 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] transition-all duration-500",
        !isVisible && "opacity-90 scale-95"
      )}>
        {linksToShow.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex flex-col items-center gap-1 transition-all duration-300 active:scale-90",
                isActive ? "text-foreground" : "text-muted-foreground/60"
              )}
            >
              <div className={cn(
                "p-2 rounded-2xl transition-all duration-500",
                isActive && "bg-white shadow-[0_8px_20px_-4px_rgba(0,0,0,0.1)] scale-110 -translate-y-1"
              )}>
                <link.icon 
                  className="h-5 w-5" 
                  style={{ color: isActive ? link.color : 'currentColor' }} 
                />
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-tighter transition-all duration-300",
                isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
              )}>
                {link.label}
              </span>
              {isActive && (
                <span 
                  className="absolute -top-1 w-1 h-1 rounded-full animate-pulse" 
                  style={{ backgroundColor: link.color }} 
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
