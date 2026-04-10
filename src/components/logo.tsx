import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  logoUrl?: string | null;
  appName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, logoUrl, appName = 'CrediControl', size = 'md' }: LogoProps) {
  const dimensions = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 text-xl font-extrabold tracking-tight transition-opacity hover:opacity-90',
        className
      )}
    >
      <div className={cn("relative overflow-hidden rounded-xl border bg-white shadow-sm", dimensions[size])}>
        {logoUrl ? (
          <Image 
            src={logoUrl} 
            alt="Logo" 
            fill
            className="object-contain p-1" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/10 text-primary">
            <CreditCard className={cn(size === 'sm' ? 'h-4 w-4' : 'h-6 w-6')} />
          </div>
        )}
      </div>
      <span className={cn(size === 'sm' ? 'hidden lg:inline-block' : 'inline-block')}>
        {appName}
      </span>
    </div>
  );
}
