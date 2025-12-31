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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Loan, LoanPlan } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateLoanAction } from '@/app/dashboard/actions';

const formSchema = z.object({
  loanPlanId: z.string().min(1, 'Debes seleccionar un plan.'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0.'),
  startDate: z.string().min(1, 'Debes seleccionar una fecha de inicio.'),
});

type EditLoanFormValues = z.infer<typeof formSchema>;

interface EditLoanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  loanPlans: LoanPlan[];
  allLoanWeeks: string[];
}

export function EditLoanDialog({
  isOpen,
  onOpenChange,
  loan,
  loanPlans,
  allLoanWeeks,
}: EditLoanDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (loan && isOpen) {
      const saturdayOfLoan = getSaturdayOfWeek(new Date(loan.startDate)).toISOString();
      form.reset({
        loanPlanId: loan.loanPlanId,
        amount: loan.amount,
        startDate: saturdayOfLoan,
      });
    }
  }, [loan, isOpen, form]);

  const getSaturdayOfWeek = (d: Date) => {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    const day = date.getUTCDay();
    const diff = day === 0 ? -1 : 6 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  };
  
  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      // Adjust for timezone offset to show the correct local date
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  };

  const onSubmit = async (values: EditLoanFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await updateLoanAction(loan.id, values);

      if (result.success) {
        toast({
          title: 'Préstamo Actualizado',
          description: 'Los datos del préstamo han sido actualizados.',
        });
        onOpenChange(false);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al Actualizar',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Préstamo</DialogTitle>
          <DialogDescription>
            Modifica los detalles del préstamo seleccionado.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="loanPlanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan de Préstamo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un plan" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {loanPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Inicio (Semana)</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una semana" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allLoanWeeks.map((week) => (
                        <SelectItem key={week} value={week}>
                          {formatDate(week)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
