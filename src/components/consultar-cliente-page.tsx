
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, Wallet, Calendar, Shield, Phone, Home, X, CircleDollarSign, Building, MapPin, Tv } from 'lucide-react';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface ConsultarClientePageProps {
  clients: Client[];
  loans: Loan[];
  loanPlans: LoanPlan[];
  plazas: Plaza[];
  localidades: Localidad[];
  promotoras: Promotora[];
}

export function ConsultarClientePage({ clients, loans, loanPlans, plazas, localidades, promotoras }: ConsultarClientePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return [];
    }
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
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
    
    // --- LÓGICA DE CALENDARIO UNIFICADA (MÉXICO/JALISCO) ---
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    
    const loanStartDate = new Date(activeLoan.startDate);
    const startUTC = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
    
    const daysDiff = Math.floor((todayUTC.getTime() - startUTC.getTime()) / (1000 * 3600 * 24));
    const currentWeekSafe = Math.max(1, Math.floor(daysDiff / 7) + 1);
    
    const baseTerm = loanPlan.termInWeeks;
    const isExpired = daysDiff >= (baseTerm * 7);

    // REGLA DE FALLOS Y PAGOS ASUMIDOS:
    let registeredMissedCount = 0;
    let baseArrears = 0;
    let assumedAmount = 0; // Suma de lo que el sistema "asume pagado" (semanas pasadas sin registro)
    
    for (let i = 1; i <= baseTerm; i++) {
        if (i < currentWeekSafe) {
            const p = (activeLoan.payments || []).find(pay => pay.weekNumber === i);
            const amountPaid = p ? p.amount : 0;
            
            // Un fallo es un registro explícito de pago incompleto
            // En préstamos vencidos, la ausencia de pago también es fallo
            const isFallo = isExpired 
                ? (amountPaid < weeklyPayment)
                : (!!p && amountPaid < weeklyPayment);

            if (isFallo) {
                registeredMissedCount++;
                baseArrears += (weeklyPayment - amountPaid);
            } else if (!p) {
                // Semana pasada sin registro = Asumido pagado por el negocio
                assumedAmount += weeklyPayment;
            }
        }
    }
    
    // REGLA PENALIZACIÓN: Vencido O 2+ fallos registrados
    const hasPenalty = isExpired || (registeredMissedCount >= 2);
    const totalTerm = baseTerm + (hasPenalty ? 1 : 0);

    // --- CÁLCULO DE SALDO A LIQUIDAR (AJUSTADO A PERCEPCIÓN DEL USUARIO) ---
    // Total Real Pagado en el sistema
    const actualPaid = (activeLoan.payments || []).reduce((acc, p) => acc + p.amount, 0);
    // Para el cálculo de deuda, sumamos lo "asumido" como si ya estuviera pagado (no es saldo pendiente)
    const businessPaid = actualPaid + assumedAmount;
    
    // El saldo total es lo que falta para completar el contrato (incluida penalización)
    const totalExpected = totalTerm * weeklyPayment;
    const totalBalanceDue = Math.max(0, totalExpected - businessPaid);

    // Desglose de penalización para la UI
    let penaltyArrear = 0;
    if (hasPenalty) {
        const pExtra = (activeLoan.payments || []).find(pay => pay.weekNumber === baseTerm + 1);
        penaltyArrear = Math.max(0, weeklyPayment - (pExtra?.amount || 0));
    }

    const currentLoanWeekDisplay = Math.min(currentWeekSafe, totalTerm);

    const promotora = promotoras.find(p => p.id === activeLoan.promotoraId);
    const localidad = localidades.find(l => l.id === promotora?.localidadId);
    const plaza = plazas.find(p => p.id === localidad?.plazaId);

    return {
      loan: activeLoan,
      loanPlan,
      weeklyPayment,
      currentLoanWeek: currentLoanWeekDisplay,
      termInWeeks: totalTerm,
      baseArrears,
      penaltyArrear,
      totalBalance: totalBalanceDue,
      missedWeeks: registeredMissedCount,
      hasPenalty,
      isExpired,
      plazaName: plaza?.name || 'N/A',
      localidadName: localidad?.name || 'N/A',
      promotoraName: promotora?.name || 'N/A',
      loanStartDate: activeLoan.startDate,
    };
  }, [selectedClient, loans, loanPlans, plazas, localidades, promotoras]);
  
  const handleClientSelect = (client: Client) => {
    setSearchTerm(client.name);
    setSelectedClient(client);
  };
  
  const clearSearch = () => {
    setSearchTerm('');
    setSelectedClient(null);
  };
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
        <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight uppercase">Consultar Detalle del Cliente</h1>
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
                    className="pl-10 pr-10 h-12 text-lg rounded-full shadow-lg focus-visible:ring-primary/50 uppercase"
                />
                 {searchTerm && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                        onClick={clearSearch}
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </Button>
                )}
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
                            <span className="font-bold uppercase text-sm">{client.name}</span>
                        </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
            )}
        </div>

        {selectedClient && (
            <Card className="max-w-4xl mx-auto animate-in fade-in-50 border-2">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-muted/20">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-20 w-20 border-2 border-white shadow-sm">
                            <AvatarImage src={selectedClient.avatarUrl} alt={selectedClient.name} />
                            <AvatarFallback className="text-3xl font-bold bg-white text-primary">{selectedClient.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <CardTitle className="text-2xl font-black uppercase">{selectedClient.name}</CardTitle>
                            <CardDescription className="font-bold">ID: {selectedClient.id}</CardDescription>
                        </div>
                    </div>
                     <div className="text-xs font-bold text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 uppercase">
                        <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-blue-600" /> {selectedClient.phone}</div>
                        <div className="flex items-center gap-2 col-span-2">
                             <Home className="h-3.5 w-3.5 text-blue-600" /> {`${selectedClient.street}, ${selectedClient.neighborhood}`}
                        </div>
                        {activeLoanDetails && (
                            <>
                                <div className="flex items-center gap-2 col-span-2 text-[10px] mt-1 text-zinc-500">
                                    <Building className="h-3 w-3" /> {activeLoanDetails.plazaName}
                                    <MapPin className="h-3 w-3 ml-2" /> {activeLoanDetails.localidadName}
                                    <User className="h-3 w-3 ml-2" /> {activeLoanDetails.promotoraName}
                                </div>
                                <div className="flex items-center gap-2 col-span-2 text-[10px] font-black text-blue-700 mt-0.5">
                                    <Calendar className="h-3 w-3" /> FECHA PRÉSTAMO: {formatDate(activeLoanDetails.loanStartDate)}
                                </div>
                            </>
                        )}
                    </div>
                </CardHeader>

                <Separator />
                
                {activeLoanDetails ? (
                    <CardContent className="p-6 grid md:grid-cols-2 gap-8">
                         <div className="space-y-6">
                             <div className='flex items-center justify-between'>
                                <h3 className="font-black text-lg uppercase flex items-center gap-2 tracking-tight text-zinc-800"><Wallet className="text-primary"/> DETALLES:</h3>
                                {activeLoanDetails.hasPenalty && (
                                    <Badge className="bg-orange-500 hover:bg-orange-600 font-black text-[10px] px-3 shadow-sm uppercase">S. EXTRA ACTIVA</Badge>
                                )}
                             </div>
                             <div className="grid grid-cols-3 gap-2">
                                <div className="p-3 rounded-xl bg-zinc-50 border text-center">
                                    <p className="text-muted-foreground uppercase text-[8px] font-black tracking-widest mb-1">Semana</p>
                                    <p className="font-black text-xl">{activeLoanDetails.currentLoanWeek} / {activeLoanDetails.termInWeeks}</p>
                                </div>
                                 <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center">
                                    <p className="text-blue-600 uppercase text-[8px] font-black tracking-widest mb-1">Abono</p>
                                    <p className="font-black text-xl text-blue-700">{formatCurrency(activeLoanDetails.weeklyPayment)}</p>
                                 </div>
                                  <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
                                    <p className="text-red-600 uppercase text-[8px] font-black tracking-widest mb-1">Fallos</p>
                                    <p className={cn("font-black text-xl text-red-700")}>{activeLoanDetails.missedWeeks}</p>
                                 </div>
                             </div>

                            <div className="space-y-3 p-5 bg-zinc-100 rounded-2xl border-2 border-zinc-200 shadow-inner">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="font-black text-muted-foreground uppercase text-[9px]">Suma de Fallos</span>
                                    <span className="font-black text-zinc-800">{formatCurrency(activeLoanDetails.baseArrears)}</span>
                                </div>
                                {activeLoanDetails.hasPenalty && (
                                    <div className="flex justify-between items-center text-xs border-b border-zinc-300 border-dashed pb-2">
                                        <span className={cn("font-black uppercase text-[9px]", activeLoanDetails.isExpired ? "text-red-600" : "text-orange-600")}>
                                            Semana de Penalización {activeLoanDetails.isExpired ? '(VENCIDO)' : ''}
                                        </span>
                                        <span className={cn("font-black", activeLoanDetails.isExpired ? "text-red-600" : "text-orange-600")}>
                                            +{formatCurrency(activeLoanDetails.penaltyArrear)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className={cn("font-black uppercase text-xs", activeLoanDetails.totalBalance <= 0 ? "text-green-700" : "text-red-700")}>Total a Liquidar</span>
                                    <span className={cn("text-3xl font-black tracking-tighter", activeLoanDetails.totalBalance <= 0 ? "text-green-700" : "text-red-700")}>
                                        {formatCurrency(activeLoanDetails.totalBalance)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                         <div className="space-y-6 md:border-l md:pl-8">
                             <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-primary"/>
                                    <h3 className="font-black text-lg uppercase tracking-tight text-zinc-800">DATOS DE AVAL</h3>
                                </div>
                                <div className="p-4 rounded-xl bg-blue-600 text-white shadow-lg space-y-3">
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-blue-200 tracking-widest mb-1">Responsable Solidario</p>
                                        <p className="font-black text-lg uppercase leading-none">{selectedClient.endorsement.split('(')[0].trim()}</p>
                                    </div>
                                    <p className="text-[10px] font-bold uppercase leading-relaxed text-blue-50 opacity-90">{selectedClient.endorsement.match(/\((.*)\)/)?.[1] || 'SIN DIRECCIÓN REGISTRADA'}</p>
                                </div>
                             </div>

                             <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Tv className="h-5 w-5 text-primary"/>
                                    <h3 className="font-black text-lg uppercase tracking-tight text-zinc-800">GARANTÍA DEL CLIENTE</h3>
                                </div>
                                <div className="p-4 rounded-xl border-2 border-dashed bg-zinc-50">
                                    <p className="font-bold text-xs uppercase text-zinc-700">{selectedClient.guarantee}</p>
                                </div>
                             </div>
                         </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-12 text-center">
                        <div className="max-w-xs mx-auto space-y-4">
                            <CircleDollarSign className="h-12 w-12 text-zinc-300 mx-auto" />
                            <p className="text-zinc-500 font-bold uppercase text-sm">Este cliente no tiene préstamos activos actualmente.</p>
                        </div>
                    </CardContent>
                )}
            </Card>
        )}
        
        {!selectedClient && searchTerm && filteredClients.length === 0 && (
             <div className="text-center mt-8 p-12 border-2 border-dashed rounded-3xl animate-in fade-in-50">
                <p className="text-zinc-500 font-bold uppercase text-sm">No se encontraron clientes con el nombre "{searchTerm}"</p>
            </div>
        )}
    </div>
  );
}
