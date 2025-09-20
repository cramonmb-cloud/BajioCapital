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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
import type { Client, Loan, LoanPlan } from '@/lib/types';
import { PlusCircle, Loader2, AlertTriangle, BadgeDollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLoanAction, payOffLoanAction } from '@/app/dashboard/actions';
import { useRouter } from 'next/navigation';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';

const stepOneSchema = z.object({
  loanPlanId: z.string().min(1, 'Debes seleccionar un tipo de préstamo.'),
  amount: z.coerce.number().min(1, 'El monto del préstamo debe ser mayor a 0.'),
  clientName: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
});

const stepTwoSchema = z.object({
  address: z.string().min(5, 'La dirección es requerida.'),
  phone: z.string().min(7, 'El teléfono es requerido.'),
  guarantee: z.string().min(3, 'La garantía es requerida.'),
  endorsement: z.string().min(3, 'El nombre del aval es requerido.'),
  endorsementAddress: z.string().min(5, 'La dirección del aval es requerida.'),
  endorsementPhone: z.string().min(7, 'El teléfono del aval es requerido.'),
});

const formSchema = stepOneSchema.merge(stepTwoSchema);

type LoanFormValues = z.infer<typeof formSchema>;

interface CreateLoanDialogProps {
    clients: Client[];
    loanPlans: LoanPlan[];
    loans: Loan[];
}

interface ActiveLoanDetails {
    loan: Loan;
    settlementAmount: number;
    weeksRemaining: number;
}

export function CreateLoanDialog({ clients, loanPlans, loans }: CreateLoanDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeLoanDetails, setActiveLoanDetails] = useState<ActiveLoanDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayingOff, setIsPayingOff] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(step === 1 ? stepOneSchema : formSchema),
    defaultValues: {
      loanPlanId: '',
      amount: 0,
      clientName: '',
      address: '',
      phone: '',
      guarantee: 'N/A',
      endorsement: '',
      endorsementAddress: '',
      endorsementPhone: '',
    },
  });

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    form.setValue('clientName', name);
    setSelectedClient(null);
    setActiveLoanDetails(null);

    if (name.length >= 2) {
      const matches = clients.filter((client) =>
        client.name.toLowerCase().includes(name.toLowerCase())
      );
      setMatchingClients(matches);
    } else {
      setMatchingClients([]);
    }
  };

  const selectClient = (client: Client) => {
    form.setValue('clientName', client.name);
    form.setValue('address', client.address);
    form.setValue('phone', client.phone);
    form.setValue('guarantee', client.guarantee);
    setSelectedClient(client);
    setMatchingClients([]);
    
    const activeLoan = loans.find(
      (loan) => loan.clientId === client.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );
    
    if (activeLoan) {
        const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
        if (loanPlan) {
            const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const totalLoanAmount = weeklyPayment * loanPlan.termInWeeks;
            const totalPaid = activeLoan.payments.reduce((acc, p) => acc + p.amount, 0);
            const settlementAmount = totalLoanAmount - totalPaid;

            // Simplified weeks remaining calculation
            const weeksPaid = totalPaid / weeklyPayment;
            const weeksRemaining = Math.max(0, loanPlan.termInWeeks - weeksPaid);

            setActiveLoanDetails({
                loan: activeLoan,
                settlementAmount: settlementAmount > 0 ? settlementAmount : 0,
                weeksRemaining: Math.ceil(weeksRemaining),
            });
        }
    } else {
        setActiveLoanDetails(null);
    }
  };
  
  const handleNextStep = async () => {
    const isValid = await form.trigger(['loanPlanId', 'amount', 'clientName']);
    if (isValid) {
        if(activeLoanDetails) {
            toast({
                variant: 'destructive',
                title: 'Cliente con préstamo activo',
                description: 'Este cliente ya tiene un préstamo activo o vencido y no puede solicitar uno nuevo.',
            });
            return;
        }
        setStep(2);
    }
  };

  const handlePayOffLoan = async () => {
    if (!activeLoanDetails) return;
    setIsPayingOff(true);
    try {
        const result = await payOffLoanAction(activeLoanDetails.loan.id);
        if (result.success) {
            toast({
                title: 'Préstamo Liquidado',
                description: 'El préstamo ha sido liquidado. Ahora puede crear uno nuevo.'
            });
            setActiveLoanDetails(null); // Clear the warning
            router.refresh(); // Refresh data to reflect the change
        } else {
            throw new Error(result.message);
        }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Error al Liquidar',
            description: error.message || 'No se pudo liquidar el préstamo.'
        });
    } finally {
        setIsPayingOff(false);
    }
  };
  
  const onSubmit = async (values: LoanFormValues) => {
    setIsSubmitting(true);
    try {
        const clientData: Omit<Client, 'id' | 'avatarUrl'> & { id?: string } = selectedClient ? 
            { name: values.clientName,
              email: selectedClient.email, 
              address: values.address,
              phone: values.phone,
              guarantee: values.guarantee,
              endorsement: values.endorsement,
             } : 
            {
                name: values.clientName,
                email: `${values.clientName.split(' ').join('.').toLowerCase()}@example.com`,
                address: values.address,
                phone: values.phone,
                guarantee: values.guarantee,
                endorsement: `${values.endorsement} (Tel: ${values.endorsementPhone}, Dir: ${values.endorsementAddress})`,
            };

        if(selectedClient?.id) {
            clientData.id = selectedClient.id;
        }
       
      const result = await createLoanAction({
        loanPlanId: values.loanPlanId,
        amount: values.amount,
        client: clientData,
      });

      if (result.success) {
        toast({
            title: 'Préstamo Creado',
            description: `El préstamo para ${values.clientName} ha sido creado exitosamente.`,
        });

        // Reset form and state
        form.reset();
        setStep(1);
        setMatchingClients([]);
        setSelectedClient(null);
        setActiveLoanDetails(null);
        setOpen(false);
      } else {
        throw new Error(result.message || 'Error desconocido');
      }

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Hubo un error al crear el préstamo. Por favor, inténtelo de nuevo.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Préstamo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Préstamo - Paso {step} de 2</DialogTitle>
              <DialogDescription>
                {step === 1 ? 'Completa la información inicial del préstamo.' : 'Completa los datos del cliente y su aval.'}
              </DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="loanPlanId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Tipo de Préstamo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormLabel>Monto del Préstamo ($)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Ej: 1000" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Cliente</FormLabel>
                      <FormControl>
                        <Input placeholder="Busca o registra un cliente" {...field} onChange={handleClientNameChange}/>
                      </FormControl>
                       {matchingClients.length > 0 && (
                        <div className="relative">
                            <ul className="absolute z-10 w-full bg-card border rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {matchingClients.map(client => (
                                    <li key={client.id}
                                        className="px-3 py-2 cursor-pointer hover:bg-accent"
                                        onClick={() => selectClient(client)}>
                                        {client.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                       )}
                        {activeLoanDetails && (
                            <Card className="mt-4 bg-destructive/10 border-destructive/50">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
                                        <div className="flex-grow">
                                            <h3 className="font-semibold text-destructive">Cliente con Préstamo Activo</h3>
                                            <p className="text-sm text-destructive/90">
                                                Este cliente no puede solicitar un nuevo préstamo hasta que el actual sea liquidado.
                                            </p>
                                            <div className="mt-2 text-sm space-y-1">
                                                <p><strong>Monto Original:</strong> {formatCurrency(activeLoanDetails.loan.amount)}</p>
                                                <p><strong>Saldo para Liquidar:</strong> <span className="font-bold">{formatCurrency(activeLoanDetails.settlementAmount)}</span></p>
                                                <p><strong>Semanas Restantes:</strong> {activeLoanDetails.weeksRemaining}</p>
                                            </div>
                                             <Button 
                                                type="button" 
                                                variant="destructive" 
                                                size="sm" 
                                                className="mt-3"
                                                onClick={handlePayOffLoan}
                                                disabled={isPayingOff}
                                            >
                                                {isPayingOff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeDollarSign className="mr-2 h-4 w-4" />}
                                                Liquidar Préstamo
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                       {!activeLoanDetails && selectedClient && (
                           <FormDescription className="text-primary">
                               Cliente seleccionado. Puede continuar.
                           </FormDescription>
                       )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-4 py-4 max-h-[50vh] overflow-y-auto pr-2">
                 <h3 className="text-lg font-medium">Datos del Cliente</h3>
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Domicilio Completo (Calle, Número, Colonia, CP, Ciudad)</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Ej: Av. Siempreviva 742, Springfield..." {...field} disabled={!!selectedClient} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Teléfono</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: 555-0101" {...field} disabled={!!selectedClient} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="guarantee"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Garantías</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Nómina" {...field} disabled={!!selectedClient} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>

                 <hr className="my-6"/>

                 <h3 className="text-lg font-medium">Datos del Aval</h3>
                 <p className="text-sm text-muted-foreground">
                    Si el cliente existe, la información del aval se guardará como una nota en el perfil del cliente.
                 </p>
                 <FormField
                    control={form.control}
                    name="endorsement"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre del Aval</FormLabel>
                        <FormControl>
                            <Input placeholder="Nombre completo del aval" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="endorsementAddress"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Domicilio del Aval</FormLabel>
                        <FormControl>
                             <Textarea placeholder="Domicilio completo del aval" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="endorsementPhone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Teléfono del Aval</FormLabel>
                        <FormControl>
                            <Input placeholder="Teléfono de contacto del aval" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>
            )}

            <DialogFooter>
                {step === 1 && (
                     <Button type="button" onClick={handleNextStep} disabled={!!activeLoanDetails}>Siguiente</Button>
                )}
                {step === 2 && (
                    <>
                        <Button type="button" variant="outline" onClick={() => setStep(1)}>Anterior</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Crear Préstamo
                        </Button>
                    </>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
