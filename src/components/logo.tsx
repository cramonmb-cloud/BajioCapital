
import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  logoUrl?: string | null;
  appName?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className, logoUrl, appName = 'CrediControl', size = 'md' }: LogoProps) {
  const dimensions = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-16 w-16',
    xl: 'h-32 w-32'
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 text-sm font-bold tracking-tight transition-all group',
        className
      )}
    >
      <div className={cn(
        "relative overflow-hidden rounded-lg border border-border/40 bg-white shadow-[0_2px_5px_-1px_rgba(0,0,0,0.1)] transition-transform group-hover:scale-105 group-active:scale-95",
        dimensions[size as keyof typeof dimensions]
      )}>
        {logoUrl ? (
          <Image 
            src={logoUrl} 
            alt="Logo" 
            fill
            className="object-contain p-1" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
            <CreditCard className={cn(size === 'sm' ? 'h-3.5 w-3.5' : size === 'xl' ? 'h-12 w-12' : 'h-5 w-5')} />
          </div>
        )}
      </div>
      <span className={cn(
        "bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70",
        (size === 'sm' || size === 'md' || size === 'lg') ? "hidden lg:inline-block text-sm" : "inline-block text-2xl"
      )}>
        {appName}
      </span>
    </div>
  );
}
