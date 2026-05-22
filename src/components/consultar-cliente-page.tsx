'use client';

import { useState, useMemo } from 'react';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, Wallet, Calendar, Shield, Phone, Home, X, CircleDollarSign, Building, MapPin, Tv, Filter, List, ChevronRight, UserCheck, Smartphone, Info } from 'lucide-react';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ConsultarClientePageProps {
  clients: Client[];
  loans: Loan[];
  loanPlans: LoanPlan[];
  plazas: Plaza[];
  localidades: Localidad[];
  promotoras: Promotora[];
}

export function ConsultarClientePage({ clients: allClients, loans: allLoans, loanPlans, plazas: allPlazas, localidades: allLocalidades, promotoras: allPromotoras }: ConsultarClientePageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Filtros
  const [filterPlaza, setFilterPlaza] = useState('all');
  const [filterLocalidad, setFilterLocalidad] = useState('all');
  const [filterPromotora, setFilterPromotora] = useState('all');
  const [filterWeek, setFilterWeek] = useState('all');

  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin' || appUser?.username.toUpperCase() === 'CRISTOBAL';

  // Lógica de restricción de datos por usuario
  const allowedPlazas = useMemo(() => {
    if (isAdmin) return allPlazas;
    const assignedIds = appUser?.assignedPlazaIds || [];
    return allPlazas.filter(p => assignedIds.includes(p.id));
  }, [allPlazas, isAdmin, appUser]);

  const allowedLocalidades = useMemo(() => {
    if (isAdmin) return allLocalidades;
    const assignedIds = appUser?.assignedLocalidadIds || [];
    return allLocalidades.filter(l => assignedIds.includes(l.id));
  }, [allLocalidades, isAdmin, appUser]);

  const clients = useMemo(() => {
    if (isAdmin) return allClients;
    const allowedLocIds = allowedLocalidades.map(l => l.id);
    const allowedPromotoras = allPromotoras.filter(p => allowedLocIds.includes(p.localidadId));
    const allowedPromotoraIds = allowedPromotoras.map(p => p.id);
    
    const clientIdsInZones = new Set(allLoans
        .filter(l => l.promotoraId && allowedPromotoraIds.includes(l.promotoraId))
        .map(l => l.clientId)
    );
    
    return allClients.filter(c => clientIdsInZones.has(c.id));
  }, [allClients, allLoans, allPromotoras, allowedLocalidades, isAdmin]);

  const loans = useMemo(() => {
    if (isAdmin) return allLoans;
    const allowedLocIds = allowedLocalidades.map(l => l.id);
    const allowedPromotoras = allPromotoras.filter(p => allowedLocIds.includes(p.localidadId));
    const allowedPromotoraIds = allowedPromotoras.map(p => p.id);
    return allLoans.filter(l => l.promotoraId && allowedPromotoraIds.includes(l.promotoraId));
  }, [allLoans, allPromotoras, allowedLocalidades, isAdmin]);

  // Opciones de filtros
  const plazaOptions = useMemo(() => allowedPlazas.sort((a,b) => a.name.localeCompare(b.name)), [allowedPlazas]);
  const localidadOptions = useMemo(() => {
      let result = allowedLocalidades;
      if (filterPlaza !== 'all') result = result.filter(l => l.plazaId === filterPlaza);
      return result.sort((a,b) => a.name.localeCompare(b.name));
  }, [allowedLocalidades, filterPlaza]);
  
  const promotoraOptions = useMemo(() => {
      let result = allPromotoras;
      if (filterLocalidad !== 'all') {
          result = result.filter(p => p.localidadId === filterLocalidad);
      } else if (filterPlaza !== 'all') {
          const locIdsInPlaza = allLocalidades.filter(l => l.plazaId === filterPlaza).map(l => l.id);
          result = result.filter(p => locIdsInPlaza.includes(p.localidadId));
      }
      if (!isAdmin) {
          const allowedLocIds = allowedLocalidades.map(l => l.id);
          result = result.filter(p => allowedLocIds.includes(p.localidadId));
      }
      return result.sort((a,b) => a.name.localeCompare(b.name));
  }, [allPromotoras, allLocalidades, filterLocalidad, filterPlaza, allowedLocalidades, isAdmin]);

  const weekOptions = useMemo(() => {
    const weeks = Array.from(new Set(loans.map(l => {
        const d = new Date(l.startDate);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
    }))).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
    return weeks;
  }, [loans]);

  // Listado filtrado unificado (Search + Filtros)
  const filteredList = useMemo(() => {
    let result = loans.map(loan => {
        const client = clients.find(c => c.id === loan.clientId);
        return { loan, client };
    }).filter(item => item.client !== undefined);

    // Apply Search
    if (searchTerm) {
        result = result.filter(item => 
            item.client!.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Apply Filters
    if (filterPlaza !== 'all') {
        result = result.filter(item => {
            const p = allPromotoras.find(prom => prom.id === item.loan.promotoraId);
            const l = allLocalidades.find(loc => loc.id === p?.localidadId);
            return l?.plazaId === filterPlaza;
        });
    }
    if (filterLocalidad !== 'all') {
        result = result.filter(item => {
            const p = allPromotoras.find(prom => prom.id === item.loan.promotoraId);
            return p?.localidadId === filterLocalidad;
        });
    }
    if (filterPromotora !== 'all') {
        result = result.filter(item => item.loan.promotoraId === filterPromotora);
    }
    if (filterWeek !== 'all') {
        result = result.filter(item => {
            const d = new Date(item.loan.startDate);
            return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString() === filterWeek;
        });
    }

    return result.slice(0, searchTerm ? 20 : 50); // Limit for performance
  }, [loans, clients, searchTerm, filterPlaza, filterLocalidad, filterPromotora, filterWeek, allLocalidades, allPromotoras]);

  const activeLoanDetails = useMemo(() => {
    if (!selectedClient) return null;

    const activeLoan = allLoans.find(
      loan => loan.clientId === selectedClient.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );

    if (!activeLoan) return null;

    const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
    if (!loanPlan) return null;

    const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
    
    // CALENDARIO JALISCO
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const loanStartDate = new Date(activeLoan.startDate);
    const startLocal = new Date(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate());
    const timeDiff = todayLocal.getTime() - startLocal.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    const currentWeekSafe = Math.max(1, Math.floor(daysDiff / 7) + 1);
    
    const baseTerm = loanPlan.termInWeeks;
    const isExpired = currentWeekSafe > baseTerm;

    let registeredMissedCount = 0;
    let baseArrears = 0;
    let assumedPaidAmount = 0; 
    
    for (let i = 1; i <= baseTerm; i++) {
        const paymentRecord = (activeLoan.payments || []).find(pay => pay.weekNumber === i);
        const amountPaid = paymentRecord ? paymentRecord.amount : 0;
        const dueDate = new Date(startLocal.getTime());
        dueDate.setDate(startLocal.getDate() + (i * 7));
        
        if (paymentRecord) {
            if (amountPaid < weeklyPayment) {
                registeredMissedCount++;
                baseArrears += (weeklyPayment - amountPaid);
            }
        } else {
            if (todayLocal > dueDate) {
                assumedPaidAmount += weeklyPayment;
            }
        }
    }
    
    const hasPenalty = isExpired || (registeredMissedCount >= 2);
    const totalTerm = baseTerm + (hasPenalty ? 1 : 0);

    const actualTotalPaid = (activeLoan.payments || []).reduce((acc, p) => acc + p.amount, 0);
    const totalExpectedContract = totalTerm * weeklyPayment;
    const totalBalanceDue = Math.max(0, totalExpectedContract - actualTotalPaid - assumedPaidAmount);

    let penaltyArrear = 0;
    if (hasPenalty) {
        const pExtra = (activeLoan.payments || []).find(pay => pay.weekNumber === baseTerm + 1);
        penaltyArrear = Math.max(0, weeklyPayment - (pExtra?.amount || 0));
    }

    const currentLoanWeekDisplay = Math.min(currentWeekSafe, totalTerm);
    const promotora = allPromotoras.find(p => p.id === activeLoan.promotoraId);
    const localidad = allLocalidades.find(l => l.id === promotora?.localidadId);
    const plaza = allPlazas.find(p => p.id === localidad?.plazaId);

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
  }, [selectedClient, allLoans, loanPlans, allPlazas, allLocalidades, allPromotoras]);
  
  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] overflow-hidden">
        <div className="flex-1 grid lg:grid-cols-[380px_1fr] gap-4 min-h-0">
            
            {/* COLUMNA IZQUIERDA: BUSCADOR Y LISTADO */}
            <div className="flex flex-col gap-4 min-h-0">
                <Card className="shadow-sm border-2 shrink-0">
                    <CardHeader className="p-3 border-b bg-muted/20">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <Search className="h-3 w-3 text-primary" /> Búsqueda y Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="NOMBRE DEL CLIENTE..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs rounded-xl shadow-sm uppercase font-bold border-2"
                            />
                            {searchTerm && (
                                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchTerm('')}>
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            <Select value={filterPlaza} onValueChange={(v) => { setFilterPlaza(v); setFilterLocalidad('all'); setFilterPromotora('all'); }}>
                                <SelectTrigger className="h-8 text-[9px] font-black uppercase border-2"><SelectValue placeholder="PLAZA" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS LAS PLAZAS</SelectItem>
                                    {plazaOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterLocalidad} onValueChange={(v) => { setFilterLocalidad(v); setFilterPromotora('all'); }} disabled={filterPlaza === 'all' && !isAdmin}>
                                <SelectTrigger className="h-8 text-[9px] font-black uppercase border-2"><SelectValue placeholder="LOCALIDAD" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS LAS ZONAS</SelectItem>
                                    {localidadOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterPromotora} onValueChange={setFilterPromotora} disabled={filterLocalidad === 'all' && !isAdmin}>
                                <SelectTrigger className="h-8 text-[9px] font-black uppercase border-2"><SelectValue placeholder="PROMOTORA" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS LAS RUTAS</SelectItem>
                                    {promotoraOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Select value={filterWeek} onValueChange={setFilterWeek}>
                                <SelectTrigger className="h-8 text-[9px] font-black uppercase border-2"><SelectValue placeholder="SEMANA" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">CUALQUIER FECHA</SelectItem>
                                    {weekOptions.map(iso => (
                                        <SelectItem key={iso} value={iso}>{formatDate(iso)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-2 flex-1 min-h-0 overflow-hidden">
                    <CardHeader className="p-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <List className="h-3 w-3 text-blue-600" /> Resultados ({filteredList.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 h-full">
                        <ScrollArea className="h-full">
                            <div className="divide-y">
                                {filteredList.map(({ loan, client }) => (
                                    <div 
                                        key={loan.id} 
                                        className={cn(
                                            "flex items-center gap-3 p-3 cursor-pointer transition-colors group",
                                            selectedClient?.id === client?.id ? "bg-primary/10" : "hover:bg-muted/30"
                                        )}
                                        onClick={() => setSelectedClient(client!)}
                                    >
                                        <Avatar className="h-8 w-8 border shrink-0">
                                            <AvatarImage src={client?.avatarUrl} alt={client?.name} />
                                            <AvatarFallback className="text-[10px] font-bold">{client?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-black uppercase truncate group-hover:text-blue-700">{client?.name}</span>
                                                <Badge variant={loan.status === 'Overdue' ? 'destructive' : 'outline'} className="text-[7px] h-3.5 px-1 font-black shrink-0">
                                                    {loan.status === 'Overdue' ? 'VENCIDO' : 'ACTIVO'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <span className="text-[8px] font-bold text-muted-foreground truncate uppercase">{client?.street}</span>
                                                <span className="text-[9px] font-black text-zinc-900">{formatCurrency(loan.amount)}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", selectedClient?.id === client?.id && "translate-x-1 text-primary")} />
                                    </div>
                                ))}
                                {filteredList.length === 0 && (
                                    <div className="p-8 text-center">
                                        <Info className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest leading-tight">No se encontraron clientes con los criterios actuales.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* COLUMNA DERECHA: DETALLE DEL CLIENTE */}
            <div className="min-h-0">
                {selectedClient ? (
                    <ScrollArea className="h-full pr-1">
                        <div className="space-y-4 pb-4">
                            <Card className="border-2 shadow-md relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                                <CardHeader className="p-4 bg-zinc-50/50">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-16 w-16 border-2 border-white shadow-md rounded-2xl">
                                                <AvatarImage src={selectedClient.avatarUrl} alt={selectedClient.name} />
                                                <AvatarFallback className="text-2xl font-black bg-white text-primary rounded-xl">{selectedClient.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <CardTitle className="text-xl font-black uppercase tracking-tighter text-zinc-900 leading-tight">{selectedClient.name}</CardTitle>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="font-black text-[8px] uppercase border-primary/30 text-primary bg-primary/5 h-4 px-1.5">ID: {selectedClient.id}</Badge>
                                                    {activeLoanDetails && (
                                                        <Badge variant="outline" className="font-black text-[8px] uppercase border-blue-200 text-blue-600 bg-blue-50 h-4 px-1.5">{activeLoanDetails.loanPlan.name}</Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-1 gap-x-4 gap-y-1 bg-white p-3 rounded-xl border shadow-inner">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-800"><Phone className="h-3 w-3 text-blue-600" /> {selectedClient.phone}</div>
                                            <div className="flex items-start gap-2 text-[10px] font-bold text-zinc-800">
                                                <Home className="h-3 w-3 text-blue-600 shrink-0 mt-0.5" /> 
                                                <span className="truncate max-w-[150px] md:max-w-none uppercase">{selectedClient.street}, {selectedClient.neighborhood}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>

                                <Separator />
                                
                                {activeLoanDetails ? (
                                    <CardContent className="p-4 grid md:grid-cols-[1fr_300px] gap-6">
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="p-3 rounded-xl bg-zinc-100/50 border border-zinc-200 text-center shadow-sm">
                                                    <p className="text-muted-foreground uppercase text-[8px] font-black tracking-widest mb-1">Semana</p>
                                                    <p className="font-black text-lg tracking-tighter text-zinc-900">{activeLoanDetails.currentLoanWeek} / {activeLoanDetails.termInWeeks}</p>
                                                </div>
                                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center shadow-sm">
                                                    <p className="text-blue-600 uppercase text-[8px] font-black tracking-widest mb-1">Abono</p>
                                                    <p className="font-black text-lg tracking-tighter text-blue-800">{formatCurrency(activeLoanDetails.weeklyPayment)}</p>
                                                </div>
                                                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center shadow-sm relative overflow-hidden">
                                                    <p className="text-red-600 uppercase text-[8px] font-black tracking-widest mb-1">Fallos</p>
                                                    <p className="font-black text-lg tracking-tighter text-red-700">{activeLoanDetails.missedWeeks}</p>
                                                    {activeLoanDetails.hasPenalty && (
                                                        <div className="absolute top-0 right-0 p-0.5 bg-orange-500 text-[6px] text-white font-black uppercase rotate-45 translate-x-2 translate-y-[-2px] w-12 text-center shadow-sm">+1</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-5 bg-zinc-900 rounded-[1.5rem] border-4 border-zinc-800 shadow-xl relative overflow-hidden">
                                                <div className="absolute top-0 right-0 p-3 opacity-5">
                                                    <Wallet className="h-16 w-16 text-white" />
                                                </div>
                                                <div className="flex justify-between items-center text-zinc-400">
                                                    <span className="font-black text-[9px] uppercase tracking-widest">Deuda por Fallos</span>
                                                    <span className="font-black text-sm text-white">{formatCurrency(activeLoanDetails.baseArrears)}</span>
                                                </div>
                                                {activeLoanDetails.hasPenalty && (
                                                    <div className="flex justify-between items-center border-b border-zinc-800 border-dashed pb-2">
                                                        <span className={cn("font-black uppercase text-[9px] tracking-widest", activeLoanDetails.isExpired ? "text-red-400" : "text-orange-400")}>
                                                            Semana Extra {activeLoanDetails.isExpired ? '(VENCIDO)' : ''}
                                                        </span>
                                                        <span className={cn("font-black text-sm", activeLoanDetails.isExpired ? "text-red-400" : "text-orange-400")}>
                                                            +{formatCurrency(activeLoanDetails.penaltyArrear)}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-end pt-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Total a Pagar</span>
                                                        <span className={cn("font-black uppercase text-[10px] tracking-widest leading-none", activeLoanDetails.totalBalance <= 0 ? "text-green-400" : "text-primary")}>Saldo Liquidación</span>
                                                    </div>
                                                    <span className={cn("text-3xl font-black tracking-tighter leading-none", activeLoanDetails.totalBalance <= 0 ? "text-green-400" : "text-white")}>
                                                        {formatCurrency(activeLoanDetails.totalBalance)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-2xl border-2 bg-muted/20 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Building className="h-3 w-3 text-primary" />
                                                        <span className="text-[8px] font-black uppercase text-muted-foreground">Ubicación Operativa</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-bold uppercase text-zinc-600 flex justify-between">Plaza: <span className="font-black text-zinc-900">{activeLoanDetails.plazaName}</span></p>
                                                        <p className="text-[9px] font-bold uppercase text-zinc-600 flex justify-between">Localidad: <span className="font-black text-zinc-900">{activeLoanDetails.localidadName}</span></p>
                                                        <p className="text-[9px] font-bold uppercase text-zinc-600 flex justify-between">Promotora: <span className="font-black text-zinc-900">{activeLoanDetails.promotoraName}</span></p>
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-2xl border-2 bg-blue-50/20 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3 w-3 text-blue-600" />
                                                        <span className="text-[8px] font-black uppercase text-blue-600/70">Cronología</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[9px] font-bold uppercase text-zinc-600 flex justify-between">Fecha Inicio: <span className="font-black text-zinc-900">{formatDate(activeLoanDetails.loanStartDate)}</span></p>
                                                        <p className="text-[9px] font-bold uppercase text-zinc-600 flex justify-between">Plan: <span className="font-black text-zinc-900">{activeLoanDetails.loanPlan.termInWeeks} SEMANAS</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4 text-blue-600"/>
                                                    <h3 className="font-black text-xs uppercase tracking-tight text-zinc-900">Datos de Aval</h3>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-blue-600 text-white shadow-lg space-y-3 relative overflow-hidden">
                                                    <div className="absolute -bottom-2 -right-2 opacity-10">
                                                        <UserCheck className="h-16 w-16" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase text-blue-200 tracking-widest opacity-80">Responsable</p>
                                                        <p className="font-black text-sm uppercase leading-tight tracking-tight">{selectedClient.endorsement.split('(')[0].trim()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[8px] font-black uppercase text-blue-200 tracking-widest opacity-80">Ubicación</p>
                                                        <p className="text-[9px] font-bold uppercase leading-relaxed text-blue-50/90">{selectedClient.endorsement.match(/\((.*)\)/)?.[1] || 'SIN DIRECCIÓN'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4 text-zinc-400"/>
                                                    <h3 className="font-black text-xs uppercase tracking-tight text-zinc-900">Garantía</h3>
                                                </div>
                                                <div className="p-4 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50/30">
                                                    <p className="font-bold text-[10px] uppercase text-zinc-600 leading-relaxed italic">"{selectedClient.guarantee || 'SIN GARANTÍA REGISTRADA'}"</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                ) : (
                                    <CardContent className="p-12 text-center">
                                        <div className="max-w-xs mx-auto space-y-4">
                                            <div className="p-5 bg-muted rounded-full w-fit mx-auto">
                                                <CircleDollarSign className="h-10 w-10 text-muted-foreground/30" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-zinc-900 font-black uppercase text-sm tracking-tight">Sin Préstamos Activos</p>
                                                <p className="text-zinc-500 font-bold uppercase text-[8px] tracking-widest leading-tight">Este cliente no cuenta con deudas vigentes en el sistema.</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-zinc-50/50">
                        <div className="text-center space-y-4 max-w-sm px-8">
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                                <Smartphone className="h-16 w-16 text-primary/40 relative" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-400">Selecciona un Cliente</h3>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                                    Utiliza el buscador o los filtros de zona a la izquierda para localizar a un cliente y visualizar su estado de cuenta detallado.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}
