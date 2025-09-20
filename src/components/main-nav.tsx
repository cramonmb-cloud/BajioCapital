'use client';

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Landmark,
  FileText,
} from 'lucide-react';

const links = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard />,
  },
  {
    href: '/dashboard/clients',
    label: 'Clientes',
    icon: <Users />,
  },
  {
    href: '/dashboard/loans',
    label: 'Préstamos',
    icon: <Landmark />,
  },
  {
    href: '/dashboard/plans',
    label: 'Planes de Préstamo',
    icon: <FileText />,
  },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {links.map((link) => (
        <SidebarMenuItem key={link.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))}
            tooltip={link.label}
          >
            <Link href={link.href}>
              {link.icon}
              <span>{link.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
