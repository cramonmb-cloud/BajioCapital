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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import type { Client, Loan, LoanPlan, Group } from '@/lib/types';
import { PlusCircle, Loader2, AlertTriangle, BadgeDollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLoanAction, payOffLoanAction } from '@/app/dashboard/actions';
import { useRouter } from 'next/navigation';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';

const stepOneSchema = z.object({
  groupId: z.string().min(1, 'Debes seleccionar un grupo.'),
  loanPlanId: z.string().min(1, 'Debes seleccionar un tipo de préstamo.'),
  amount: z.coerce.number().min(1, 'El monto del préstamo debe ser mayor a 0.'),
  clientName: z.string().min(3, 'El nombre del cliente debe tener al menos 3 caracteres.'),
});

const stepTwoSchema = z.object({
  phone: z.string().optional(),
  street: z.string().optional(),
  neighborhood: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  guarantee: z.string().optional(),
  endorsement: z.string().optional(),
  endorsementStreet: z.string().optional(),
  endorsementNeighborhood: z.string().optional(),
  endorsementPostalCode: z.string().optional(),
  endorsementCity: z.string().optional(),
  endorsementPhone: z.string().optional(),
});

const formSchema = stepOneSchema.merge(stepTwoSchema);

type LoanFormValues = z.infer<typeof formSchema>;

interface CreateLoanDialogProps {
    clients: Client[];
    loanPlans: LoanPlan[];
    loans: Loan[];
    groups: Group[];
}

interface ActiveLoanDetails {
    loan: Loan;
    settlementAmount: number;
    weeksRemaining: number;
}

export function CreateLoanDialog({ clients, loanPlans, loans, groups }: CreateLoanDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeLoanDetails, setActiveLoanDetails] = useState<ActiveLoanDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayingOff, setIsPayingOff] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<LoanFormValues | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(step === 1 ? stepOneSchema : formSchema),
    defaultValues: {
      groupId: '',
      loanPlanId: '',
      amount: 0,
      clientName: '',
      phone: '',
      street: '',
      neighborhood: '',
      postalCode: '',
      city: '',
      guarantee: '',
      endorsement: '',
      endorsementStreet: '',
      endorsementNeighborhood: '',
      endorsementPostalCode: '',
      endorsementCity: '',
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
    form.setValue('phone', client.phone);
    form.setValue('street', client.street);
    form.setValue('neighborhood', client.neighborhood);
    form.setValue('postalCode', client.postalCode);
    form.setValue('city', client.city);
    form.setValue('guarantee', client.guarantee);
    // Aval data is not stored in the client object, so it's not pre-filled.
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
    const isValid = await form.trigger(['groupId', 'loanPlanId', 'amount', 'clientName']);
    if (isValid) {
        if(activeLoanDetails) {
            toast({
                variant: 'destructive',
                title: 'Cliente con préstamo activo',
                description: 'Este cliente ya tiene un préstamo activo o vencido y no puede solicitar uno nuevo.',
            });
            return;
        }
        if (!selectedClient) {
            // If it's a new client, ensure the fields are empty
            form.setValue('phone', '');
            form.setValue('street', '');
            form.setValue('neighborhood', '');
            form.setValue('postalCode', '');
            form.setValue('city', '');
            form.setValue('guarantee', '');
            form.setValue('endorsement', '');
            form.setValue('endorsementStreet', '');
            form.setValue('endorsementNeighborhood', '');
            form.setValue('endorsementPostalCode', '');
            form.setValue('endorsementCity', '');
            form.setValue('endorsementPhone', '');
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
  
    const proceedWithSubmission = async (values: LoanFormValues) => {
        setIsSubmitting(true);
        try {
            const endorsementAddressParts = [
                values.endorsementStreet?.toUpperCase(),
                values.endorsementNeighborhood?.toUpperCase(),
                values.endorsementPostalCode?.toUpperCase(),
                values.endorsementCity?.toUpperCase(),
                values.endorsementPhone ? `Tel: ${values.endorsementPhone.toUpperCase()}` : ''
            ].filter(Boolean); // filter out empty strings

            const endorsementAddress = endorsementAddressParts.join(', ');

            const endorsementValue = values.endorsement?.toUpperCase();
            
            const fullEndorsement = endorsementValue && endorsementAddress ? `${endorsementValue} (${endorsementAddress})` : endorsementValue || '';


            const clientData: Omit<Client, 'id' | 'avatarUrl'> & { id?: string } = selectedClient ?
                {
                    ...selectedClient,
                    name: values.clientName.toUpperCase(),
                    street: values.street?.toUpperCase() || '',
                    neighborhood: values.neighborhood?.toUpperCase() || '',
                    postalCode: values.postalCode?.toUpperCase() || '',
                    city: values.city?.toUpperCase() || '',
                    phone: values.phone?.toUpperCase() || '',
                    guarantee: values.guarantee?.toUpperCase() || '',
                    endorsement: fullEndorsement,
                } :
                {
                    name: values.clientName.toUpperCase(),
                    email: `${values.clientName.split(' ').join('.').toLowerCase()}@example.com`,
                    street: values.street?.toUpperCase() || '',
                    neighborhood: values.neighborhood?.toUpperCase() || '',
                    postalCode: values.postalCode?.toUpperCase() || '',
                    city: values.city?.toUpperCase() || '',
                    phone: values.phone?.toUpperCase() || '',
                    guarantee: values.guarantee?.toUpperCase() || '',
                    endorsement: fullEndorsement,
                };

            if (selectedClient?.id) {
                clientData.id = selectedClient.id;
            }

            const result = await createLoanAction({
                groupId: values.groupId,
                loanPlanId: values.loanPlanId,
                amount: values.amount,
                client: clientData,
            });

            if (result.success) {
                toast({
                    title: 'Préstamo Creado',
                    description: `El préstamo para ${values.clientName} ha sido creado exitosamente.`,
                });

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
            setShowConfirmation(false);
            setFormValues(null);
        }
    };


  const onSubmit = async (values: LoanFormValues) => {
    const step2Fields = [
        values.phone, values.street, values.neighborhood, values.postalCode,
        values.city, values.guarantee, values.endorsement, values.endorsementStreet,
        values.endorsementNeighborhood, values.endorsementPostalCode,
        values.endorsementCity, values.endorsementPhone
    ];

    const areStep2FieldsEmpty = step2Fields.every(field => !field || field.trim() === '');

    if (areStep2FieldsEmpty) {
        setFormValues(values);
        setShowConfirmation(true);
    } else {
        await proceedWithSubmission(values);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          form.reset();
          setStep(1);
          setMatchingClients([]);
          setSelectedClient(null);
          setActiveLoanDetails(null);
        }
    }}>
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
                {step === 1 ? 'Completa la información inicial del préstamo.' : 'Completa los datos del cliente y su aval (opcional).'}
              </DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 py-4">
                <FormField
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Grupo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={group.id}>
                                {group.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
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
                        <Input placeholder="Busca o registra un cliente" {...field} onChange={handleClientNameChange} className="uppercase" />
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
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                 <h3 className="text-lg font-medium">Datos del Cliente</h3>
                 <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: 555-0101" {...field} value={field.value || ''} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Calle y Número</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: Av. Siempreviva 742" {...field} value={field.value || ''} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />
                 <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="neighborhood"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Colonia</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Springfield" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="postalCode"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>C.P.</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: 12345" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Ciudad</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Springfield" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
                 <FormField
                    control={form.control}
                    name="guarantee"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Garantías</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe las garantías del cliente (nómina, propiedad, etc.)" {...field} value={field.value || ''} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                 <hr className="my-6"/>

                 <h3 className="text-lg font-medium">Datos del Aval</h3>
                 <FormField
                    control={form.control}
                    name="endorsement"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Nombre del Aval</FormLabel>
                        <FormControl>
                            <Input placeholder="Nombre completo del aval" {...field} value={field.value || ''} className="uppercase" />
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
                            <Input placeholder="Teléfono de contacto del aval" {...field} value={field.value || ''} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="endorsementStreet"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Calle y Número del Aval</FormLabel>
                        <FormControl>
                             <Input placeholder="Domicilio del aval" {...field} value={field.value || ''} className="uppercase" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="endorsementNeighborhood"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Colonia</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Centro" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="endorsementPostalCode"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>C.P.</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: 54321" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="endorsementCity"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Ciudad</FormLabel>
                            <FormControl>
                                <Input placeholder="Ej: Shelbyville" {...field} value={field.value || ''} className="uppercase" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
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
    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Continuar con datos incompletos?</AlertDialogTitle>
                <AlertDialogDescription>
                    No se han registrado todos los datos del cliente y/o aval. ¿Deseas crear el préstamo de todos modos?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setFormValues(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { if (formValues) proceedWithSubmission(formValues); }}>
                    Continuar
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
