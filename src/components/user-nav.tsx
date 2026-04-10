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
import { User, LogOut, ChevronDown, UserCircle, Settings2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function UserNav() {
  const { user, signOut, appUser } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  const username = appUser?.username || user?.email?.split('@')[0] || 'Usuario';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative flex items-center gap-2 rounded-full p-1 h-9 hover:bg-muted/50 border border-transparent hover:border-border/40 transition-all active:scale-95">
          <Avatar className="h-7 w-7 border shadow-sm ring-1 ring-background">
            <AvatarImage src={`https://picsum.photos/seed/${user?.uid}/40/40`} alt={username} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
              {username.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline-block text-xs font-bold text-foreground/80 uppercase tracking-tight pr-1">
            {username}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 mr-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 mt-1 rounded-2xl p-2 shadow-2xl border-border/40" align="end" forceMount>
        <DropdownMenuLabel className="font-normal px-2 py-3">
          <div className="flex flex-col space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cuenta Activa</p>
            <p className="text-sm font-semibold leading-none truncate">{username}</p>
            <p className="text-[10px] leading-none text-muted-foreground/70 truncate">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="opacity-50" />
        <DropdownMenuGroup className="p-1">
          <DropdownMenuItem disabled className="opacity-50 rounded-lg cursor-not-allowed">
            <UserCircle className="mr-2 h-4 w-4" />
            <span className="text-xs font-medium">Mi Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="opacity-50 rounded-lg cursor-not-allowed">
            <Settings2 className="mr-2 h-4 w-4" />
            <span className="text-xs font-medium">Preferencias</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="opacity-50" />
        <div className="p-1">
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer rounded-lg font-bold text-xs">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Cerrar sesión</span>
            </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
