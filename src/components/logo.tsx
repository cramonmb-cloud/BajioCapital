import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  logoUrl?: string | null;
  appName?: string;
}

export function Logo({ className, logoUrl, appName = 'CrediControl' }: LogoProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-lg font-bold tracking-tighter',
        className
      )}
    >
      {logoUrl ? (
        <Image src={logoUrl} alt="Logo" width={32} height={32} className="h-8 w-8 object-contain" />
      ) : (
        <CreditCard className="size-5" />
      )}
      {appName}
    </div>
  );
}
