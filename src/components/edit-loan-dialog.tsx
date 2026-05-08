'use client';

import { useState, useEffect, useMemo } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import type { Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateLoanAction, deleteLoanAction } from '@/app/dashboard/actions';
import { Separator } from './ui/separator';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
  loanPlanId: z.string().min(1, 'Debes seleccionar un plan.'),
  amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0.'),
  startDate: z.string().min(1, 'Debes seleccionar una fecha de inicio.'),
  promotoraId: z.string().min(1, 'Debes seleccionar una promotora.'),
});

type EditLoanFormValues = z.infer<typeof formSchema>;

interface EditLoanDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  loan: Loan;
  loanPlans: LoanPlan[];
  allLoanWeeks: string[];
  plazas: Plaza[];
  localidades: Localidad[];
  promotoras: Promotora[];
}

export function EditLoanDialog({
  isOpen,
  onOpenChange,
  loan,
  loanPlans,
  allLoanWeeks,
  plazas,
  localidades,
  promotoras,
}: EditLoanDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { appUser } = useAuth();

  const [selectedPlaza, setSelectedPlaza] = useState('');
  const [selectedLocalidad, setSelectedLocalidad] = useState('');

  const form = useForm<EditLoanFormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (loan && isOpen) {
      const getSaturdayOfWeek = (d: Date) => {
        const date = new Date(d);
        date.setUTCHours(0, 0, 0, 0);
        const day = date.getUTCDay();
        const diff = day === 0 ? -1 : 6 - day;
        date.setUTCDate(date.getUTCDate() + diff);
        return date;
      };

      const saturdayOfLoan = getSaturdayOfWeek(new Date(loan.startDate)).toISOString();
      const currentPromotora = promotoras.find(p => p.id === loan.promotoraId);
      const currentLocalidad = localidades.find(l => l.id === currentPromotora?.localidadId);
      const currentPlaza = plazas.find(p => p.id === currentLocalidad?.plazaId);

      setSelectedPlaza(currentPlaza?.id || '');
      setSelectedLocalidad(currentLocalidad?.id || '');

      form.reset({
        loanPlanId: loan.loanPlanId,
        amount: loan.amount,
        startDate: saturdayOfLoan,
        promotoraId: loan.promotoraId || '',
      });
    }
  }, [loan, isOpen, form, promotoras, localidades, plazas]);

  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => a.name.localeCompare(b.name)), [plazas]);
  
  const filteredLocalidades = useMemo(() => {
    if (!selectedPlaza) return [];
    return localidades
      .filter(l => l.plazaId === selectedPlaza)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedPlaza, localidades]);

  const filteredPromotoras = useMemo(() => {
    if (!selectedLocalidad) return [];
    return promotoras
      .filter(p => p.localidadId === selectedLocalidad)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedLocalidad, promotoras]);

  const sortedLoanPlans = useMemo(() => [...loanPlans].sort((a, b) => a.name.localeCompare(b.name)), [loanPlans]);

  useEffect(() => {
    if (filteredLocalidades.length > 0 && !filteredLocalidades.find(l => l.id === selectedLocalidad)) {
        setSelectedLocalidad('');
        form.setValue('promotoraId', '');
    }
  }, [selectedPlaza, filteredLocalidades, selectedLocalidad, form]);

  useEffect(() => {
    const currentPromotoraId = form.getValues('promotoraId');
    if (filteredPromotoras.length > 0 && !filteredPromotoras.find(p => p.id === currentPromotoraId)) {
        form.setValue('promotoraId', '');
    }
  }, [selectedLocalidad, filteredPromotoras, form]);

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
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

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
        const result = await deleteLoanAction(loan.id);
        if (result.success) {
            toast({ title: 'Préstamo Eliminado', description: result.message });
            onOpenChange(false);
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Préstamo</DialogTitle>
          <DialogDescription>
            Modifica los detalles del préstamo seleccionado.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
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
                        {sortedLoanPlans.map((plan) => (
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
              <Separator />
              <h3 className="text-md font-medium">Reasignar Préstamo</h3>
               <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <FormItem>
                        <FormLabel>Plaza</FormLabel>
                        <Select onValueChange={setSelectedPlaza} value={selectedPlaza}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una plaza" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {sortedPlazas.map((plaza) => (
                                <SelectItem key={plaza.id} value={plaza.id}>
                                {plaza.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                    <FormItem>
                        <FormLabel>Localidad</FormLabel>
                        <Select onValueChange={setSelectedLocalidad} value={selectedLocalidad} disabled={!selectedPlaza}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una localidad" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {filteredLocalidades.map((localidad) => (
                                <SelectItem key={localidad.id} value={localidad.id}>
                                {localidad.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                    <FormField
                        control={form.control}
                        name="promotoraId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Promotora</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLocalidad}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona una promotora" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {filteredPromotoras.map((promotora) => (
                                    <SelectItem key={promotora.id} value={promotora.id}>
                                    {promotora.name}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>

                {appUser?.username === 'Cristobal' && (
                    <div className="mt-6 rounded-lg border border-destructive/50 p-4 bg-destructive/5">
                        <h4 className="text-sm font-semibold text-destructive mb-1">Zona de Peligro</h4>
                        <p className="text-xs text-muted-foreground mb-3">
                            Eliminar este préstamo revertirá los abonos de la cartera y borrará todo su historial financiero.
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="destructive" size="sm" className="w-full">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar Préstamo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción eliminará el préstamo permanentemente y restará los abonos ya registrados del saldo de la cartera. Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-white">
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, eliminar préstamo"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || isDeleting}>
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
