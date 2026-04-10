'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function UserNav() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  const getUsernameFromEmail = (email: string | null | undefined) => {
    if (!email) return 'No Conectado';
    const username = email.split('@')[0];
    return username.charAt(0).toUpperCase() + username.slice(1);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative flex items-center gap-2 rounded-full pl-1 pr-2 h-9 hover:bg-muted">
          <Avatar className="h-7 w-7 border">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/40/40`} alt={user?.email || ''} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline-block text-xs font-semibold text-muted-foreground">
            {getUsernameFromEmail(user?.email)}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold leading-none uppercase">Sesión Activa</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled className="opacity-50">
            <User className="mr-2 h-4 w-4" />
            <span>Ver Perfil</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
