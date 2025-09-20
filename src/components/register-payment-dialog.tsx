'use client';

import { useState } from 'react';
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
  onPaymentRegistered,
}: RegisterPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const client = clients.find(c => c.id === loan.clientId);
  const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPaid: loanPlan?.weeklyPayment || 0,
    },
  });

  const onSubmit = async (values: PaymentFormValues) => {
    if (!loanPlan) return;
    setIsSubmitting(true);
    try {
      const result = await registerPaymentAction(loan.id, weekDate, values.amountPaid);

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
      form.reset({ amountPaid: loanPlan?.weeklyPayment || 0 });
    }
  };
  
  const formatDate = (date: Date) => {
      return date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
            form.reset({ amountPaid: loanPlan?.weeklyPayment || 0 });
        }
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <DialogHeader>
              <DialogTitle>Registrar Pago - Semana {weekNumber}</DialogTitle>
              <DialogDescription>
                Registra el abono para <span className="font-semibold">{client?.name}</span> comenzando en la semana del <span className="font-semibold">{formatDate(weekDate)}</span>. 
                El abono semanal esperado es de {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(loanPlan?.weeklyPayment || 0)}.
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
