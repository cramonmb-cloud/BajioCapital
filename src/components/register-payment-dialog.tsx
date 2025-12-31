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
import type { Client, Loan, LoanPlan, AppUser } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPaymentAction } from '@/app/dashboard/actions';
import { useAuth } from '@/hooks/use-auth';

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

  // Effect to update default value when dialog opens with new data
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
  
  const formatDate = (date: Date) => {
      return date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset({ amountPaid: initialAmount });
        }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <DialogHeader>
              <DialogTitle>Registrar Pago - Semana {weekNumber}</DialogTitle>
              <DialogDescription>
                Registra el abono para <span className="font-semibold">{client?.name}</span> comenzando en la semana del <span className="font-semibold">{formatDate(weekDate)}</span>. 
                El abono semanal esperado es de {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(weeklyPaymentAmount || 0)}.
              </DialogDescription>
            </DialogHeader>

            <FormField
              control={form.control}
              name="amountPaid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto Abonado ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Pago
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
