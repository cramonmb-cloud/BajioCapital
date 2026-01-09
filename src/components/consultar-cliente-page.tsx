'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Client, Loan, LoanPlan } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, FileText, Calendar, Wallet, Hash, Clock, CircleDollarSign, Shield, Phone, Home, ChevronDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface ConsultarClientePageProps {
  clients: Client[];
  loans: Loan[];
  loanPlans: LoanPlan[];
}

export function ConsultarClientePage({ clients, loans, loanPlans }: ConsultarClientePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return [];
    }
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5); // Limit results for performance
  }, [searchTerm, clients]);

  const activeLoanDetails = useMemo(() => {
    if (!selectedClient) return null;

    const activeLoan = loans.find(
      loan => loan.clientId === selectedClient.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );

    if (!activeLoan) return null;

    const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
    if (!loanPlan) return null;

    const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
    
    const today = new Date();
    const loanStartDate = new Date(activeLoan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
    
    let missedWeeksCount = 0;
    for (let i = 1; i < currentLoanWeek; i++) {
        const paymentForWeek = activeLoan.payments.find(p => p.weekNumber === i);
        const paidForWeek = paymentForWeek?.amount || 0;
        if (paidForWeek < weeklyPayment) {
            missedWeeksCount++;
        }
    }
    const hasPenalty = missedWeeksCount >= 2;
    const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);

    let endorsementName = selectedClient.endorsement;
    let endorsementDetails = '';
    const endorsementMatch = selectedClient.endorsement.match(/(.*) \((.*)\)/);
    if (endorsementMatch) {
        endorsementName = endorsementMatch[1];
        endorsementDetails = endorsementMatch[2];
    }

    return {
      loan: activeLoan,
      loanPlan,
      weeklyPayment,
      currentLoanWeek,
      endorsementName,
      endorsementDetails,
      termInWeeks: termInWeeks
    };
  }, [selectedClient, loans, loanPlans]);
  
  useEffect(() => {
    if (filteredClients.length === 1 && searchTerm === filteredClients[0].name) {
       handleClientSelect(filteredClients[0]);
    }
  }, [searchTerm, filteredClients]);

  const handleClientSelect = (client: Client) => {
    setSearchTerm(client.name);
    setSelectedClient(client);
  };
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  };


  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Consultar Cliente</h1>
            <p className="text-muted-foreground">
                Busca un cliente para ver los detalles de su préstamo activo.
            </p>
        </div>
      
        <div className="relative max-w-lg mx-auto">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="text"
                    placeholder="Escribe el nombre del cliente..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (selectedClient && e.target.value !== selectedClient.name) {
                            setSelectedClient(null);
                        }
                    }}
                    className="pl-10 h-12 text-lg rounded-full shadow-lg focus-visible:ring-primary/50"
                />
            </div>
            {filteredClients.length > 0 && !selectedClient && (
            <Card className="absolute z-10 w-full mt-2 shadow-lg">
                <CardContent className="p-0">
                    <ul className="divide-y">
                        {filteredClients.map(client => (
                        <li key={client.id}
                            className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent"
                            onClick={() => handleClientSelect(client)}>
                            <Avatar>
                                <AvatarImage src={client.avatarUrl} alt={client.name} />
                                <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{client.name}</span>
                        </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            )}
        </div>

        {selectedClient && (
            <Card className="max-w-4xl mx-auto animate-in fade-in-50">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 border-2 border-primary">
                            <AvatarImage src={selectedClient.avatarUrl} alt={selectedClient.name} />
                            <AvatarFallback className="text-3xl">{selectedClient.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-3xl">{selectedClient.name}</CardTitle>
                            <CardDescription>ID de Cliente: {selectedClient.id}</CardDescription>
                        </div>
                    </div>
                     <div className="text-sm text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {selectedClient.phone}</div>
                        <div className="flex items-center gap-2 col-span-2"><Home className="h-4 w-4" /> {`${selectedClient.street}, ${selectedClient.neighborhood}`}</div>
                    </div>
                </CardHeader>

                <Separator />
                
                {activeLoanDetails ? (
                    <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                        
                        <div className="space-y-4">
                             <h3 className="font-semibold text-xl flex items-center gap-2"><Wallet className="text-primary"/> Progreso del Pago</h3>
                             <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Semana Actual</p>
                                    <p className="font-bold text-3xl">{activeLoanDetails.currentLoanWeek} <span className="text-lg text-muted-foreground">de {activeLoanDetails.termInWeeks}</span></p>
                                </div>
                                 <div className="space-y-1">
                                    <p className="text-muted-foreground">Abono Semanal</p>
                                    <p className="font-bold text-3xl" style={{ color: '#005DC7' }}>{formatCurrency(activeLoanDetails.weeklyPayment)}</p>
                                 </div>
                             </div>
                            <Separator className="my-4"/>
                            <h3 className="font-semibold text-xl flex items-center gap-2"><FileText className="text-primary"/> Detalles del Préstamo Activo</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Monto Solicitado</p>
                                    <p className="font-bold text-lg">{formatCurrency(activeLoanDetails.loan.amount)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Plan</p>
                                    <p className="font-semibold">{activeLoanDetails.loanPlan.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Fecha de Inicio</p>
                                    <p className="font-semibold">{formatDate(activeLoanDetails.loan.startDate)}</p>
                                </div>
                                 <div className="space-y-1">
                                    <p className="text-muted-foreground">Estado</p>
                                    <p className="font-semibold">{activeLoanDetails.loan.status}</p>
                                </div>
                            </div>
                        </div>
                        
                         <div className="space-y-2 border-l md:pl-8">
                             <Collapsible>
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between w-full">
                                        <h3 className="font-semibold text-xl flex items-center gap-2"><Shield className="text-primary"/> Información del Aval</h3>
                                        <ChevronDown className="h-5 w-5 transition-transform [&[data-state=open]]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-3 text-sm mt-4">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Garantía</p>
                                            <p className="font-semibold">{selectedClient.guarantee}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Nombre del Aval</p>
                                            <p className="font-bold text-lg">{activeLoanDetails.endorsementName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Contacto y Domicilio</p>
                                            <p className="font-semibold">{activeLoanDetails.endorsementDetails || 'No especificado'}</p>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                         </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-6 text-center">
                        <p className="text-muted-foreground">Este cliente no tiene ningún préstamo activo o vencido.</p>
                    </CardContent>
                )}
            </Card>
        )}
        
        {!selectedClient && searchTerm && filteredClients.length === 0 && (
             <div className="text-center mt-8 text-muted-foreground animate-in fade-in-50">
                <p>No se encontraron clientes con ese nombre.</p>
            </div>
        )}

        {!selectedClient && !searchTerm && (
            <div className="text-center mt-8 text-muted-foreground animate-in fade-in-50">
                <p>Comienza a escribir para buscar un cliente.</p>
            </div>
        )}
    </div>
  );
}
