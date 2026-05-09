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
import type { Loan } from '@/lib/types';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { registerPaymentAction } from '@/app/dashboard/actions';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const formSchema = z.object({
  amountPaid: z.coerce.number().min(0, 'El monto debe ser un número positivo.'),
  password: z.string().min(1, 'La contraseña de autorización es obligatoria.'),
});

type AdjustmentFormValues = z.infer<typeof formSchema>;

interface ManualPaymentAdjustmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  weekNumber: number;
  currentAmount: number;
  onSuccess?: () => void;
}

const AUTH_PASSWORD = "Lacrimosa_12";

export function ManualPaymentAdjustmentDialog({
  isOpen,
  onOpenChange,
  loan,
  weekNumber,
  currentAmount,
  onSuccess,
}: ManualPaymentAdjustmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAuth();

  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amountPaid: currentAmount,
      password: '',
    },
  });

  const onSubmit = async (values: AdjustmentFormValues) => {
    if (values.password !== AUTH_PASSWORD) {
      form.setError('password', { message: 'Contraseña de autorización incorrecta.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Usamos registerPaymentAction ya que maneja la lógica de sobrescribir el pago de una semana específica
      // y ajusta el saldo de la billetera basándose en la diferencia.
      const result = await registerPaymentAction(
        loan.id, 
        new Date(loan.startDate), // La fecha exacta no importa tanto para la corrección, sino el weekNumber
        values.amountPaid, 
        weekNumber, 
        appUser?.id
      );

      if (result.success) {
        toast({
          title: 'Ajuste Realizado',
          description: `El abono de la semana ${weekNumber} ha sido corregido a ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(values.amountPaid)}.`,
        });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al Ajustar',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Ajuste Manual (Corrección)
              </DialogTitle>
              <DialogDescription>
                Estás corrigiendo el abono de la <strong>Semana {weekNumber}</strong>. 
                El saldo de caja se ajustará automáticamente por la diferencia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
                <FormField
                control={form.control}
                name="amountPaid"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-bold text-xs uppercase">Nuevo Importe Recibido ($)</FormLabel>
                    <FormControl>
                        <Input type="number" step="0.01" {...field} className="h-11 border-2 focus:ring-primary" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="font-bold text-xs uppercase text-destructive">Contraseña de Autorización</FormLabel>
                    <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} className="h-11 border-2 border-destructive/20 focus:ring-destructive" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800 font-bold text-xs">Atención</AlertTitle>
                <AlertDescription className="text-[10px] text-amber-700">
                    Esta acción es una corrección administrativa y quedará registrada en el historial de la cartera.
                </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Autorizar Cambio
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
