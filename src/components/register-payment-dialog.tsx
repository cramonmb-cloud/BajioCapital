'use client';

import { useState, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Client, Loan, LoanPlan } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPaymentAction } from '@/app/dashboard/actions';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  amountPaid: z.coerce.number().min(0, 'El monto debe ser un número positivo.'),
});

type PaymentFormValues = z.infer<typeof formSchema>;

interface RegisterPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  clients: Client[];
  loanPlans: LoanPlan[];
  weekNumber: number;
  weekDate: Date;
  initialAmount: number;
  onPaymentRegistered: () => void;
}

export function RegisterPaymentDialog({
  isOpen,
  onOpenChange,
  loan,
  clients,
  loanPlans,
  weekNumber,
  weekDate,
  initialAmount,
  onPaymentRegistered,
}: RegisterPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAuth();

  const client = clients.find(c => c.id === loan.clientId);
  const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);

  const getWeeklyPaymentAmount = (loan: Loan) => {
    const plan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!plan) return 0;
    return (loan.amount / 1000) * plan.weeklyPaymentRate;
  };

  const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPaid: initialAmount,
    },
  });

  const amountPaid = form.watch('amountPaid') ?? 0;

  useEffect(() => {
    if (isOpen) {
      form.reset({ amountPaid: initialAmount });
    }
  }, [isOpen, initialAmount, form]);

  const onSubmit = async (values: PaymentFormValues) => {
    if (!loanPlan) return;
    setIsSubmitting(true);
    try {
      const result = await registerPaymentAction(loan.id, weekDate, values.amountPaid, weekNumber, appUser?.id);

      if (result.success) {
        toast({
          title: 'Pago Registrado',
          description: result.message || `El pago para la semana ${weekNumber} ha sido registrado.`,
        });
        onOpenChange(false);
        onPaymentRegistered();
      } else {
        throw new Error(result.message || 'Error desconocido');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al Registrar Pago',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset({ amountPaid: initialAmount });
        }
    }}>
      <DialogContent className="sm:max-w-[380px] rounded-2xl p-6 border border-border/40 shadow-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base font-black uppercase tracking-wider text-slate-800">Registrar Abono</DialogTitle>
              <DialogDescription className="sr-only">Formulario para registrar el cobro semanal del préstamo</DialogDescription>
            </DialogHeader>

            {/* Ficha compacta de detalles */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">Cliente</span>
                <span className="font-extrabold text-slate-700 uppercase text-[11px] truncate max-w-[180px]">{client?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">Semana</span>
                <span className="font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px]">S{weekNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold uppercase text-[9px] tracking-wider">Esperado</span>
                <span className="font-extrabold text-slate-700">
                  {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(weeklyPaymentAmount || 0)}
                </span>
              </div>
            </div>

            {/* Input de monto */}
            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Monto Recibido</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-sm">$</span>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        {...field} 
                        className="pl-7 h-11 text-base font-bold rounded-xl focus-visible:ring-blue-500 border-border/80" 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )}
            />

            {/* Diferencia / Falla */}
            {weeklyPaymentAmount > amountPaid && (
              <div className="flex justify-between items-center text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/10 px-3.5 py-2.5 rounded-xl border border-red-100 dark:border-red-900/30">
                <span className="uppercase text-[9px] tracking-wider font-bold">Falla</span>
                <span className="font-extrabold text-sm">Fallo con {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(weeklyPaymentAmount - amountPaid)}</span>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2 sm:gap-2 flex items-center">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="h-12 text-xs font-bold rounded-xl hover:bg-muted/40 px-4"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="h-12 px-8 text-sm font-black uppercase tracking-wider rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-0 flex-1 transition-all active:scale-95"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
