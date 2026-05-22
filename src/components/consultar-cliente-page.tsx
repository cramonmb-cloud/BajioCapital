'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, User, Wallet, Calendar, Shield, Phone, Home, X, CircleDollarSign, Building, MapPin, Tv, Filter, List, ChevronRight, UserCheck } from 'lucide-react';
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
    // Filtrar clientes que tienen algún préstamo en las zonas permitidas
    const allowedLocIds = allowedLocalidades.map(l => l.id);
    const allowedPromotoras = allPromotoras.filter(p => allowedLocIds.includes(p.localidadId));
    const allowedPromotoraIds = allowedPromotoraIndices.map(p => p.id);
    
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
      // Solo mostrar promotoras que el usuario tiene permitido (basado en localidades permitidas)
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

  // Listado filtrado
  const filteredList = useMemo(() => {
    if (filterPlaza === 'all' && filterLocalidad === 'all' && filterPromotora === 'all' && filterWeek === 'all') {
        return [];
    }

    return loans.filter(loan => {
        const promotora = allPromotoras.find(p => p.id === loan.promotoraId);
        const localidad = allLocalidades.find(l => l.id === promotora?.localidadId);
        const plaza = allPlazas.find(p => p.id === localidad?.plazaId);

        const matchPlaza = filterPlaza === 'all' || plaza?.id === filterPlaza;
        const matchLocalidad = filterLocalidad === 'all' || localidad?.id === filterLocalidad;
        const matchPromotora = filterPromotora === 'all' || loan.promotoraId === filterPromotora;
        
        const loanDate = new Date(loan.startDate);
        const loanWeekIso = new Date(Date.UTC(loanDate.getUTCFullYear(), loanDate.getUTCMonth(), loanDate.getUTCDate())).toISOString();
        const matchWeek = filterWeek === 'all' || loanWeekIso === filterWeek;

        return matchPlaza && matchLocalidad && matchPromotora && matchWeek;
    }).map(loan => {
        const client = clients.find(c => c.id === loan.clientId);
        return { loan, client };
    }).filter(item => item.client !== undefined);
  }, [loans, clients, filterPlaza, filterLocalidad, filterPromotora, filterWeek, allPlazas, allLocalidades, allPromotoras]);


  const filteredClientsSearch = useMemo(() => {
    if (!searchTerm) return [];
    return clients.filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [searchTerm, clients]);

  const activeLoanDetails = useMemo(() => {
    if (!selectedClient) return null;

    const activeLoan = allLoans.find(
      loan => loan.clientId === selectedClient.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );

    if (!activeLoan) return null;

    const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
    if (!loanPlan) return null;

    const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
    
    // --- LÓGICA DE CALENDARIO LOCAL JALISCO (MÉXICO) ---
    const now = new Date();
    // Normalización a medianoche local para comparaciones de "Días de Calendario"
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const loanStartDate = new Date(activeLoan.startDate);
    // Normalización del inicio del préstamo (Viene de Firestore como UTC medianoche)
    const startLocal = new Date(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate());
    
    // Diferencia en milisegundos convertida a días enteros (redondeado por seguridad)
    const timeDiff = todayLocal.getTime() - startLocal.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    
    // Cálculo de semana: 0-6 días = Sem 1, 7-13 días = Sem 2, etc.
    const currentWeekSafe = Math.max(1, Math.floor(daysDiff / 7) + 1);
    
    const baseTerm = loanPlan.termInWeeks;
    const isExpired = currentWeekSafe > baseTerm;

    // REGLA DE FALLOS Y ABONOS ASUMIDOS (SEGÚN HOJA SEMANAL)
    let registeredMissedCount = 0;
    let baseArrears = 0;
    let assumedPaidAmount = 0; 
    
    for (let i = 1; i <= baseTerm; i++) {
        const paymentRecord = (activeLoan.payments || []).find(pay => pay.weekNumber === i);
        const amountPaid = paymentRecord ? paymentRecord.amount : 0;
        
        // Fecha de vencimiento de la semana i (Sábado siguiente)
        const dueDate = new Date(startLocal.getTime());
        dueDate.setDate(startLocal.getDate() + (i * 7));
        
        // Un fallo solo se cuenta si el Sábado de vencimiento ya pasó completamente
        if (paymentRecord) {
            if (amountPaid < weeklyPayment) {
                registeredMissedCount++;
                baseArrears += (weeklyPayment - amountPaid);
            }
        } else {
            // Si no hay registro y la semana ya pasó (hoy > vencimiento) -> Se asume pagada por el negocio
            if (todayLocal > dueDate) {
                assumedPaidAmount += weeklyPayment;
            }
        }
    }
    
    // REGLA PENALIZACIÓN: Vencido O 2 o más fallos registrados
    const hasPenalty = isExpired || (registeredMissedCount >= 2);
    const totalTerm = baseTerm + (hasPenalty ? 1 : 0);

    // --- CÁLCULO DE SALDO TOTAL (SOLO LO PENDIENTE REAL) ---
    const actualTotalPaid = (activeLoan.payments || []).reduce((acc, p) => acc + p.amount, 0);
    const totalExpectedContract = totalTerm * weeklyPayment;
    
    // Restamos lo ya pagado y lo que el sistema "regaló" como asumido
    const totalBalanceDue = Math.max(0, totalExpectedContract - actualTotalPaid - assumedPaidAmount);

    // Desglose de penalización para la UI
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
    <div className="space-y-8">
        <div className="text-center space-y-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase text-zinc-900">Consulta Inteligente</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">Buscador y Listado de Clientes por Zona</p>
        </div>
      
        {/* BUSCADOR Y FILTROS */}
        <div className="grid lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            
            {/* Columna Buscador Directo */}
            <div className="space-y-4">
                <h3 className="font-black text-xs uppercase flex items-center gap-2 text-primary tracking-widest"><Search className="h-4 w-4"/> Búsqueda Rápida</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="NOMBRE DEL CLIENTE..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (selectedClient && e.target.value !== selectedClient.name) {
                                setSelectedClient(null);
                            }
                        }}
                        className="pl-10 pr-10 h-14 text-lg rounded-2xl shadow-md focus-visible:ring-primary/50 uppercase font-bold"
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
                {filteredClientsSearch.length > 0 && !selectedClient && (
                    <Card className="shadow-2xl border-2 animate-in fade-in zoom-in-95 duration-200">
                        <CardContent className="p-0">
                            <ul className="divide-y">
                                {filteredClientsSearch.map(client => (
                                <li key={client.id}
                                    className="flex items-center gap-4 px-4 py-4 cursor-pointer hover:bg-blue-50 transition-colors"
                                    onClick={() => handleClientSelect(client)}>
                                    <Avatar className="h-10 w-10 border shadow-sm">
                                        <AvatarImage src={client.avatarUrl} alt={client.name} />
                                        <AvatarFallback className="font-bold bg-muted text-primary">{client.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-black uppercase text-xs text-blue-900">{client.name}</span>
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase">{client.street}, {client.neighborhood}</span>
                                    </div>
                                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                                </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Columna Filtros */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="font-black text-xs uppercase flex items-center gap-2 text-blue-600 tracking-widest"><Filter className="h-4 w-4"/> Listado por Filtros</h3>
                <Card className="shadow-md border-2 border-blue-50">
                    <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Plaza</label>
                            <Select value={filterPlaza} onValueChange={(v) => { setFilterPlaza(v); setFilterLocalidad('all'); setFilterPromotora('all'); }}>
                                <SelectTrigger className="h-10 text-xs font-bold uppercase border-2"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS</SelectItem>
                                    {plazaOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Localidad</label>
                            <Select value={filterLocalidad} onValueChange={(v) => { setFilterLocalidad(v); setFilterPromotora('all'); }} disabled={filterPlaza === 'all' && !isAdmin}>
                                <SelectTrigger className="h-10 text-xs font-bold uppercase border-2"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS</SelectItem>
                                    {localidadOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Promotora</label>
                            <Select value={filterPromotora} onValueChange={setFilterPromotora} disabled={filterLocalidad === 'all' && !isAdmin}>
                                <SelectTrigger className="h-10 text-xs font-bold uppercase border-2"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">TODAS</SelectItem>
                                    {promotoraOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-zinc-500 ml-1">Semana Inicio</label>
                            <Select value={filterWeek} onValueChange={setFilterWeek}>
                                <SelectTrigger className="h-10 text-xs font-bold uppercase border-2"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">CUALQUIER FECHA</SelectItem>
                                    {weekOptions.map(iso => (
                                        <SelectItem key={iso} value={iso}>{new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Resultados del Listado */}
                {filteredList.length > 0 ? (
                    <Card className="shadow-lg border-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <CardHeader className="py-3 bg-muted/20 border-b flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                <List className="h-4 w-4 text-blue-600" /> Clientes Encontrados ({filteredList.length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[300px]">
                                <Table>
                                    <TableHeader className="bg-zinc-50 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="text-[9px] font-black uppercase">Cliente</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase">Préstamo</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase hidden md:table-cell">Estado</TableHead>
                                            <TableHead className="text-right pr-4"><span className="sr-only">Acciones</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredList.map(({ loan, client }) => (
                                            <TableRow 
                                                key={loan.id} 
                                                className="cursor-pointer hover:bg-blue-50/50 group transition-all"
                                                onClick={() => setSelectedClient(client!)}
                                            >
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8 border">
                                                            <AvatarImage src={client?.avatarUrl} alt={client?.name} />
                                                            <AvatarFallback className="text-[10px] font-bold">{client?.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black uppercase leading-none group-hover:text-blue-700">{client?.name}</span>
                                                            <span className="text-[8px] font-bold text-muted-foreground uppercase mt-1">{client?.street}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-[10px] font-black">{formatCurrency(loan.amount)}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <Badge variant={loan.status === 'Overdue' ? 'destructive' : 'secondary'} className="text-[8px] h-4 font-black uppercase">
                                                        {loan.status === 'Overdue' ? 'VENCIDO' : 'ACTIVO'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-4">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                ) : (
                    filterPlaza !== 'all' || filterLocalidad !== 'all' || filterPromotora !== 'all' || filterWeek !== 'all' ? (
                        <div className="text-center p-8 border-2 border-dashed rounded-2xl bg-zinc-50">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">No se encontraron clientes para los filtros seleccionados.</p>
                        </div>
                    ) : null
                )}
            </div>
        </div>

        {/* DETALLE DEL CLIENTE SELECCIONADO */}
        {selectedClient && (
            <Card className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500 border-2 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-8 bg-zinc-50/50">
                    <div className="flex items-center gap-6">
                        <Avatar className="h-24 w-24 border-4 border-white shadow-xl rounded-3xl">
                            <AvatarImage src={selectedClient.avatarUrl} alt={selectedClient.name} />
                            <AvatarFallback className="text-4xl font-black bg-white text-primary rounded-2xl">{selectedClient.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                            <CardTitle className="text-3xl font-black uppercase tracking-tighter text-zinc-900">{selectedClient.name}</CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-black text-[9px] uppercase border-primary/30 text-primary bg-primary/5 h-5 px-2">CLIENTE ID: {selectedClient.id}</Badge>
                            </div>
                        </div>
                    </div>
                     <div className="text-xs font-bold text-muted-foreground grid grid-cols-1 gap-y-2 uppercase bg-white p-4 rounded-2xl border shadow-inner">
                        <div className="flex items-center gap-2 text-zinc-800"><Phone className="h-4 w-4 text-blue-600" /> {selectedClient.phone}</div>
                        <div className="flex items-start gap-2 max-w-[250px]">
                             <Home className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" /> 
                             <span className="leading-tight">{`${selectedClient.street}, ${selectedClient.neighborhood}`}</span>
                        </div>
                        {activeLoanDetails && (
                            <div className="pt-2 mt-2 border-t border-dashed flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500">
                                    <Building className="h-3 w-3" /> {activeLoanDetails.plazaName}
                                </div>
                                <div className="flex items-center gap-2 text-[9px] font-black text-zinc-500">
                                    <MapPin className="h-3 w-3" /> {activeLoanDetails.localidadName}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                                    <Calendar className="h-3 w-3" /> INICIÓ: {formatDate(activeLoanDetails.loanStartDate)}
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>

                <Separator />
                
                {activeLoanDetails ? (
                    <CardContent className="p-8 grid md:grid-cols-2 gap-12">
                         <div className="space-y-8">
                             <div className='flex items-center justify-between'>
                                <h3 className="font-black text-xl uppercase flex items-center gap-2 tracking-tight text-zinc-900 border-l-4 border-primary pl-3">ESTADO DE CUENTA:</h3>
                                {activeLoanDetails.hasPenalty && (
                                    <Badge className="bg-orange-500 hover:bg-orange-600 font-black text-[10px] px-4 py-1 shadow-lg uppercase animate-pulse">S. EXTRA ACTIVA</Badge>
                                )}
                             </div>
                             <div className="grid grid-cols-3 gap-3">
                                <div className="p-4 rounded-2xl bg-zinc-100/50 border-2 border-zinc-100 text-center shadow-sm">
                                    <p className="text-muted-foreground uppercase text-[9px] font-black tracking-widest mb-1 opacity-70">Semana</p>
                                    <p className="font-black text-2xl tracking-tighter text-zinc-900">{activeLoanDetails.currentLoanWeek} / {activeLoanDetails.termInWeeks}</p>
                                </div>
                                 <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 text-center shadow-sm">
                                    <p className="text-blue-600 uppercase text-[9px] font-black tracking-widest mb-1 opacity-80">Abono</p>
                                    <p className="font-black text-2xl tracking-tighter text-blue-800">{formatCurrency(activeLoanDetails.weeklyPayment)}</p>
                                 </div>
                                  <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 text-center shadow-sm">
                                    <p className="text-red-600 uppercase text-[9px] font-black tracking-widest mb-1 opacity-80">Fallos</p>
                                    <p className={cn("font-black text-2xl tracking-tighter text-red-700")}>{activeLoanDetails.missedWeeks}</p>
                                 </div>
                             </div>

                            <div className="space-y-4 p-6 bg-zinc-900 rounded-[2rem] border-4 border-zinc-800 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <Wallet className="h-20 w-20 text-white" />
                                </div>
                                <div className="flex justify-between items-center text-zinc-400">
                                    <span className="font-black text-[10px] uppercase tracking-widest">Suma de Fallos (Deuda)</span>
                                    <span className="font-black text-lg text-white">{formatCurrency(activeLoanDetails.baseArrears)}</span>
                                </div>
                                {activeLoanDetails.hasPenalty && (
                                    <div className="flex justify-between items-center text-zinc-400 border-b border-zinc-800 border-dashed pb-3">
                                        <span className={cn("font-black uppercase text-[10px] tracking-widest", activeLoanDetails.isExpired ? "text-red-400" : "text-orange-400")}>
                                            Semana de Penalización {activeLoanDetails.isExpired ? '(VENCIDO)' : ''}
                                        </span>
                                        <span className={cn("font-black text-lg", activeLoanDetails.isExpired ? "text-red-400" : "text-orange-400")}>
                                            +{formatCurrency(activeLoanDetails.penaltyArrear)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center pt-2">
                                    <span className={cn("font-black uppercase text-xs tracking-widest", activeLoanDetails.totalBalance <= 0 ? "text-green-400" : "text-primary")}>Saldo a Liquidar</span>
                                    <span className={cn("text-4xl font-black tracking-tighter", activeLoanDetails.totalBalance <= 0 ? "text-green-400" : "text-white")}>
                                        {formatCurrency(activeLoanDetails.totalBalance)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                         <div className="space-y-8 md:border-l-2 md:pl-12 border-zinc-100">
                             <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <Shield className="h-6 w-6 text-primary"/>
                                    <h3 className="font-black text-xl uppercase tracking-tight text-zinc-900">DATOS DE AVAL</h3>
                                </div>
                                <div className="p-6 rounded-3xl bg-blue-600 text-white shadow-xl space-y-4 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:rotate-12 transition-transform">
                                        <UserCheck className="h-24 w-24" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest mb-1 opacity-80">Responsable Solidario</p>
                                        <p className="font-black text-2xl uppercase leading-none tracking-tight">{selectedClient.endorsement.split('(')[0].trim()}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest opacity-80">Ubicación del Aval</p>
                                        <p className="text-xs font-bold uppercase leading-relaxed text-blue-50/90">{selectedClient.endorsement.match(/\((.*)\)/)?.[1] || 'SIN DIRECCIÓN REGISTRADA'}</p>
                                    </div>
                                </div>
                             </div>

                             <div className="space-y-5">
                                <div className="flex items-center gap-3">
                                    <Tv className="h-6 w-6 text-primary"/>
                                    <h3 className="font-black text-xl uppercase tracking-tight text-zinc-900">GARANTÍA</h3>
                                </div>
                                <div className="p-6 rounded-3xl border-4 border-dashed border-zinc-100 bg-zinc-50/50 hover:bg-white transition-colors">
                                    <p className="font-bold text-sm uppercase text-zinc-700 leading-relaxed italic">"{selectedClient.guarantee}"</p>
                                </div>
                             </div>
                         </div>
                    </CardContent>
                ) : (
                    <CardContent className="p-24 text-center">
                        <div className="max-w-md mx-auto space-y-6">
                            <div className="p-6 bg-zinc-50 rounded-full w-fit mx-auto shadow-inner">
                                <CircleDollarSign className="h-20 w-20 text-zinc-300" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-zinc-900 font-black uppercase text-lg tracking-tight">Sin Préstamos Activos</p>
                                <p className="text-zinc-500 font-bold uppercase text-[10px] tracking-widest">Este cliente no cuenta con deudas vigentes o vencidas en el sistema.</p>
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>
        )}
        
        {!selectedClient && searchTerm && filteredClientsSearch.length === 0 && (
             <div className="text-center mt-8 p-20 border-4 border-dashed rounded-[3rem] animate-in fade-in-50 bg-zinc-50/50">
                <div className="max-w-xs mx-auto space-y-4">
                    <Search className="h-12 w-12 text-zinc-300 mx-auto" />
                    <p className="text-zinc-500 font-black uppercase text-xs tracking-widest">No se encontraron clientes con el nombre "{searchTerm}"</p>
                </div>
            </div>
        )}
    </div>
  );
}
