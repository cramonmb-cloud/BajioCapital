import { CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 text-lg font-bold tracking-tighter',
        className
      )}
    >
      <CreditCard className="size-5" />
      CrediControl
    </div>
  );
}
