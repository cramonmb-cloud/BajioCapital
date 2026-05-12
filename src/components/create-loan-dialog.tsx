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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Client, Loan, LoanPlan, Promotora, Plaza, Localidad } from '@/lib/types';
import { PlusCircle, Loader2, AlertTriangle, BadgeDollarSign, Calendar, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createLoanAction, payOffLoanAction } from '@/app/dashboard/actions';
import { useRouter } from 'next/navigation';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { IdScanner } from './id-scanner';
import type { IdDataOutput } from '@/ai/flows/extract-id-data-flow';
import { useAuth } from '@/hooks/use-auth';

const stepOneSchema = z.object({
  promotoraId: z.string().min(1, 'Debes seleccionar una promotora.'),
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
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
    initialSelection?: {
        plazaId: string;
        localidadId: string;
        promotoraId: string;
    };
}

interface ActiveLoanDetails {
    loan: Loan;
    settlementAmount: number;
    weeksRemaining: number;
    planName: string;
    hierarchy: {
        plazaName: string;
        localidadName: string;
        promotoraName: string;
    };
}

export function CreateLoanDialog({ clients, loanPlans, loans, plazas, localidades, promotoras, initialSelection }: CreateLoanDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeLoanDetails, setActiveLoanDetails] = useState<ActiveLoanDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPayingOff, setIsPayingOff] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<LoanFormValues | null>(null);
  
  const [selectedPlaza, setSelectedPlaza] = useState(initialSelection?.plazaId || '');
  const [selectedLocalidad, setSelectedLocalidad] = useState(initialSelection?.localidadId || '');

  const { toast } = useToast();
  const router = useRouter();
  const { appUser } = useAuth();

  const form = useForm<LoanFormValues>({
    resolver: zodResolver(step === 1 ? stepOneSchema : formSchema),
    defaultValues: {
      promotoraId: initialSelection?.promotoraId || '',
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

  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => a.name.localeCompare(b.name)), [plazas]);
  const filteredLocalidades = useMemo(() => localidades.filter(l => l.plazaId === selectedPlaza).sort((a, b) => a.name.localeCompare(b.name)), [localidades, selectedPlaza]);
  const filteredPromotoras = useMemo(() => promotoras.filter(p => p.localidadId === selectedLocalidad).sort((a, b) => a.name.localeCompare(b.name)), [promotoras, selectedLocalidad]);
  const sortedLoanPlans = useMemo(() => [...loanPlans].sort((a, b) => a.name.localeCompare(b.name)), [loanPlans]);

  useEffect(() => {
    if (initialSelection) {
      setSelectedPlaza(initialSelection.plazaId);
      setSelectedLocalidad(initialSelection.localidadId);
      form.setValue('promotoraId', initialSelection.promotoraId);
    }
     if (open) {
      if(initialSelection) {
        setSelectedPlaza(initialSelection.plazaId);
        setSelectedLocalidad(initialSelection.localidadId);
        form.reset({
          ...form.getValues(),
          promotoraId: initialSelection.promotoraId,
        });
      }
    } else {
        form.reset();
        setStep(1);
        setMatchingClients([]);
        setSelectedClient(null);
        setActiveLoanDetails(null);
        setSelectedPlaza('');
        setSelectedLocalidad('');
    }
  }, [initialSelection, open, form]);


  const getHierarchy = (promotoraId?: string) => {
    const promotora = promotoras.find(p => p.id === promotoraId);
    const localidad = localidades.find(l => l.id === promotora?.localidadId);
    const plaza = plazas.find(p => p.id === localidad?.plazaId);
    return {
      promotoraName: promotora?.name || 'N/A',
      localidadName: localidad?.name || 'N/A',
      plazaName: plaza?.name || 'N/A',
    };
  };

  const checkActiveLoanForClient = (client: Client) => {
    const activeLoan = loans.find(
      (loan) => loan.clientId === client.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );
    
    if (activeLoan) {
        const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
        if (loanPlan) {
            const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const today = new Date();
            const loanStartDate = new Date(activeLoan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            const baseTerm = loanPlan.termInWeeks;
            let missedWeeksCount = 0;
            for (let i = 1; i < rawCurrentLoanWeek; i++) {
                const p = activeLoan.payments.find(p => p.weekNumber === i);
                if (p && p.amount < weeklyPayment) missedWeeksCount++;
            }

            const hasPenalty = missedWeeksCount >= 2;
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
            
            let effectivePaidBase = 0;
            for (let i = 1; i <= baseTerm; i++) {
                const p = activeLoan.payments.find(pay => pay.weekNumber === i);
                if (p) {
                    effectivePaidBase += p.amount;
                } else if (i < rawCurrentLoanWeek) {
                    effectivePaidBase += weeklyPayment;
                }
            }

            const baseDebt = Math.max(0, (weeklyPayment * baseTerm) - effectivePaidBase);
            let penaltyDebt = 0;
            if (hasPenalty) {
                const penaltyPayment = activeLoan.payments.find(p => p.weekNumber === baseTerm + 1);
                penaltyDebt = weeklyPayment - (penaltyPayment?.amount || 0);
            }

            const settlementAmount = baseDebt + penaltyDebt;
            const futureWeeksCount = Math.max(0, termInWeeks - rawCurrentLoanWeek + 1);
            
            const hierarchy = getHierarchy(activeLoan.promotoraId);

            setActiveLoanDetails({
                loan: activeLoan,
                settlementAmount: settlementAmount,
                weeksRemaining: Math.ceil(futureWeeksCount),
                planName: loanPlan.name,
                hierarchy: hierarchy
            });
        }
    } else {
        setActiveLoanDetails(null);
    }
  };

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.toUpperCase();
    form.setValue('clientName', name);
    
    // Check for exact match automatically
    const exactMatch = clients.find(c => c.name.toUpperCase() === name);
    if (exactMatch) {
        setSelectedClient(exactMatch);
        checkActiveLoanForClient(exactMatch);
        setMatchingClients([]);
    } else {
        setSelectedClient(null);
        setActiveLoanDetails(null);

        if (name.length >= 2) {
          const matches = clients.filter((client) =>
            client.name.toUpperCase().includes(name)
          );
          setMatchingClients(matches);
        } else {
          setMatchingClients([]);
        }
    }
  };

  const selectClient = (client: Client) => {
    form.setValue('clientName', client.name.toUpperCase());
    form.setValue('phone', client.phone);
    form.setValue('street', client.street);
    form.setValue('neighborhood', client.neighborhood);
    form.setValue('postalCode', client.postalCode);
    form.setValue('city', client.city);
    form.setValue('guarantee', client.guarantee);
    setSelectedClient(client);
    setMatchingClients([]);
    checkActiveLoanForClient(client);
  };
  
  const handleNextStep = async () => {
    const isValid = await form.trigger(['promotoraId', 'loanPlanId', 'amount', 'clientName']);
    if (isValid) {
        if(activeLoanDetails) {
            toast({
                variant: 'destructive',
                title: 'Cliente con préstamo activo',
                description: 'Este cliente ya tiene un préstamo activo o vencido. Debe liquidarlo antes de solicitar uno nuevo.',
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
        const result = await payOffLoanAction(activeLoanDetails.loan.id, appUser?.id);
        if (result.success) {
            toast({
                title: 'Préstamo Liquidado',
                description: 'El préstamo ha sido liquidado exitosamente. Ahora puede proceder con el nuevo registro.'
            });
            setActiveLoanDetails(null);
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
            ].filter(Boolean);

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
                promotoraId: values.promotoraId,
                loanPlanId: values.loanPlanId,
                amount: values.amount,
                client: clientData,
            });

            if (result.success) {
                toast({
                    title: 'Préstamo Creado',
                    description: `El préstamo para ${values.clientName} ha sido creado exitosamente.`,
                });
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

  const handlePlazaChange = (plazaId: string) => {
    setSelectedPlaza(plazaId);
    setSelectedLocalidad('');
    form.setValue('promotoraId', '');
  };

  const handleLocalidadChange = (localidadId: string) => {
      setSelectedLocalidad(localidadId);
      form.setValue('promotoraId', '');
  };

    const handleDataExtracted = (data: Partial<IdDataOutput>) => {
        if (data.name) form.setValue('clientName', data.name.toUpperCase());
        if (data.street) form.setValue('street', data.street.toUpperCase());
        if (data.neighborhood) form.setValue('neighborhood', data.neighborhood.toUpperCase());
        if (data.postalCode) form.setValue('postalCode', data.postalCode.toUpperCase());
        if (data.city) form.setValue('city', data.city.toUpperCase());

        setSelectedClient(null);
        setActiveLoanDetails(null);
    };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!initialSelection?.promotoraId}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Crear Préstamo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[95vh] overflow-y-auto">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="uppercase font-black tracking-tight">Crear Nuevo Préstamo - Paso {step} de 2</DialogTitle>
              <DialogDescription>
                {step === 1 ? 'Completa la información inicial del préstamo.' : 'Completa los datos del cliente y su aval (opcional).'}
              </DialogDescription>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 py-4">
                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Plaza</FormLabel>
                        <Select onValueChange={handlePlazaChange} value={selectedPlaza} disabled={!!initialSelection?.plazaId}>
                            <FormControl>
                            <SelectTrigger className="h-11 uppercase font-bold">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {sortedPlazas.map((plaza) => (
                                <SelectItem key={plaza.id} value={plaza.id} className="uppercase font-bold">
                                {plaza.name}
                                </SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                    </FormItem>
                    <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Localidad</FormLabel>
                        <Select onValueChange={handleLocalidadChange} value={selectedLocalidad} disabled={!selectedPlaza || !!initialSelection?.localidadId}>
                            <FormControl>
                            <SelectTrigger className="h-11 uppercase font-bold">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {filteredLocalidades.map((localidad) => (
                                <SelectItem key={localidad.id} value={localidad.id} className="uppercase font-bold">
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Promotora</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!selectedLocalidad || !!initialSelection?.promotoraId}>
                                <FormControl>
                                <SelectTrigger className="h-11 uppercase font-bold">
                                    <SelectValue placeholder="Selecciona..." />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                {filteredPromotoras.map((promotora) => (
                                    <SelectItem key={promotora.id} value={promotora.id} className="uppercase font-bold">
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
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="loanPlanId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Tipo de Préstamo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger className="h-11 uppercase font-bold">
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {sortedLoanPlans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id} className="uppercase font-bold">
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
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Monto del Préstamo ($)</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="Ej: 1000" {...field} className="h-11 font-bold text-lg" />
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
                    <FormItem className="relative">
                      <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Nombre del Cliente</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input placeholder="Busca o registra un cliente" {...field} onChange={handleClientNameChange} autoComplete="off" className="uppercase h-11 font-bold flex-grow" />
                          </FormControl>
                          <IdScanner onDataExtracted={handleDataExtracted} />
                        </div>
                       {matchingClients.length > 0 && (
                        <Card className="absolute z-50 w-full mt-1 shadow-2xl border-2">
                            <ul className="max-h-60 overflow-y-auto divide-y">
                                {matchingClients.map(client => (
                                    <li key={client.id}
                                        className="px-4 py-3 cursor-pointer hover:bg-blue-50 flex items-center justify-between transition-colors"
                                        onClick={() => selectClient(client)}>
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase text-blue-900">{client.name}</span>
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{client.street}, {client.neighborhood}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[8px] font-black border-blue-200 text-blue-600 bg-blue-50">REGISTRADO</Badge>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                       )}

                        {activeLoanDetails && (
                            <Card className="mt-4 bg-red-50 border-2 border-red-200 animate-in fade-in zoom-in-95 duration-300">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0 mt-1" />
                                        <div className="flex-grow space-y-3">
                                            <div>
                                                <h3 className="font-black text-red-700 uppercase text-sm tracking-tight">¡Atención! Cliente con Préstamo Activo</h3>
                                                <p className="text-[10px] font-bold text-red-600 uppercase">
                                                    No se puede crear un nuevo crédito mientras el actual no esté liquidado.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/60 p-3 rounded-lg border border-red-100 shadow-inner">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500">
                                                        <span>Plan:</span>
                                                        <span className="text-zinc-800">{activeLoanDetails.planName}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500">
                                                        <span>Monto Orig:</span>
                                                        <span className="text-zinc-800">{formatCurrency(activeLoanDetails.loan.amount)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500">
                                                        <span>Semanas Pend:</span>
                                                        <span className="text-zinc-800">{activeLoanDetails.weeksRemaining}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-1 border-t border-red-100">
                                                        <span className="text-[10px] font-black text-red-700 uppercase">Saldo Liquidar:</span>
                                                        <span className="text-sm font-black text-red-700">{formatCurrency(activeLoanDetails.settlementAmount)}</span>
                                                    </div>
                                                </div>
                                                <div className='border-l border-red-100 pl-4 space-y-1'>
                                                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500">
                                                    <PlusCircle className="h-3 w-3 text-red-400" /> Plaza: <span className="text-zinc-800">{activeLoanDetails.hierarchy.plazaName}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500">
                                                    <PlusCircle className="h-3 w-3 text-red-400" /> Localidad: <span className="text-zinc-800">{activeLoanDetails.hierarchy.localidadName}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-zinc-500">
                                                    <PlusCircle className="h-3 w-3 text-red-400" /> Promotora: <span className="text-zinc-800">{activeLoanDetails.hierarchy.promotoraName}</span>
                                                  </div>
                                                </div>
                                            </div>

                                             <Button 
                                                type="button" 
                                                variant="destructive" 
                                                size="sm" 
                                                className="w-full h-10 font-black uppercase text-xs shadow-lg"
                                                onClick={handlePayOffLoan}
                                                disabled={isPayingOff}
                                            >
                                                {isPayingOff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeDollarSign className="mr-2 h-4 w-4" />}
                                                {isPayingOff ? 'Liquidando...' : 'Liquidar Préstamo Ahora'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                       {!activeLoanDetails && selectedClient && (
                           <Alert className="mt-3 bg-blue-50 border-blue-200">
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-xs font-black uppercase text-blue-800">Cliente Verificado</AlertTitle>
                                <AlertDescription className="text-[10px] font-bold text-blue-700 uppercase">Sin deudas activas. Puede continuar con el registro.</AlertDescription>
                           </Alert>
                       )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                 <h3 className="text-sm font-black uppercase tracking-widest text-primary border-b pb-1">Datos del Cliente</h3>
                 <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Teléfono</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: 311-000-0000" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Calle y Número</FormLabel>
                        <FormControl>
                            <Input placeholder="Ej: Av. Principal 123" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Colonia</FormLabel>
                            <FormControl>
                                <Input placeholder="Centro" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">C.P.</FormLabel>
                            <FormControl>
                                <Input placeholder="63000" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Ciudad</FormLabel>
                            <FormControl>
                                <Input placeholder="Tepic" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Garantías</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Describe las garantías..." {...field} value={field.value || ''} className="uppercase font-bold min-h-[60px]" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                 />

                 <hr className="my-6"/>

                 <h3 className="text-sm font-black uppercase tracking-widest text-blue-600 border-b pb-1">Datos del Responsable (Aval)</h3>
                 <FormField
                    control={form.control}
                    name="endorsement"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Nombre del Aval</FormLabel>
                        <FormControl>
                            <Input placeholder="Nombre completo del aval" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Teléfono del Aval</FormLabel>
                        <FormControl>
                            <Input placeholder="Teléfono de contacto" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Calle y Número del Aval</FormLabel>
                        <FormControl>
                             <Input placeholder="Domicilio del aval" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Colonia</FormLabel>
                            <FormControl>
                                <Input placeholder="Centro" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">C.P.</FormLabel>
                            <FormControl>
                                <Input placeholder="63000" {...field} value={field.value || ''} className="uppercase font-bold" />
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
                            <FormLabel className="text-[10px] font-black uppercase text-muted-foreground">Ciudad</FormLabel>
                            <FormControl>
                                <Input placeholder="Tepic" {...field} value={field.value || ''} className="uppercase font-bold" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                 </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
                {step === 1 && (
                     <Button type="button" onClick={handleNextStep} disabled={!!activeLoanDetails} className="w-full sm:w-auto font-black uppercase h-11 px-8">Siguiente Paso</Button>
                )}
                {step === 2 && (
                    <>
                        <Button type="button" variant="outline" onClick={() => setStep(1)} className="font-black uppercase h-11">Atrás</Button>
                        <Button type="submit" disabled={isSubmitting} className="font-black uppercase h-11 px-8">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar y Crear Crédito
                        </Button>
                    </>
                )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase tracking-tight">¿Continuar con datos incompletos?</AlertDialogTitle>
                <AlertDialogDescription className="font-bold text-xs">
                    No se han registrado todos los datos del cliente o del aval (dirección, teléfono, garantías). ¿Deseas crear el préstamo de todos modos con la información actual?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
                <AlertDialogCancel onClick={() => setFormValues(null)} className="rounded-lg font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { if (formValues) proceedWithSubmission(formValues); }} className="rounded-lg font-bold bg-blue-600">
                    Sí, Crear Préstamo
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
