'use client';

import { useState, useMemo } from 'react';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Wallet, Calendar, Shield, Phone, Home, X, CircleDollarSign, Building, MapPin, List, ChevronRight, UserCheck, Smartphone, Info, Route, ArrowRight, AlertTriangle, User, Monitor } from 'lucide-react';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
    const allowedPromotoraIds = allowedPromotoraIds.map(p => p.id);
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

  // Listado filtrado
  const canShowList = filterPlaza !== 'all' && filterLocalidad !== 'all';

  const filteredList = useMemo(() => {
    if (!canShowList) return [];

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

    return result;
  }, [loans, clients, searchTerm, filterPlaza, filterLocalidad, filterPromotora, filterWeek, allLocalidades, allPromotoras, canShowList]);

  const activeLoanDetails = useMemo(() => {
    if (!selectedClient) return null;

    const activeLoan = allLoans.find(
      loan => loan.clientId === selectedClient.id && (loan.status === 'Active' || loan.status === 'Overdue')
    );

    if (!activeLoan) return null;

    const loanPlan = loanPlans.find(p => p.id === activeLoan.loanPlanId);
    if (!loanPlan) return null;

    const weeklyPayment = (activeLoan.amount / 1000) * loanPlan.weeklyPaymentRate;
    
    // CALENDARIO JALISCO (Ignorar desfase UTC)
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
    
    // Solo contar lo que se registra explícitamente como incompleto (pagos parciales o ceros)
    (activeLoan.payments || []).forEach(p => {
        if (p.weekNumber > 0 && p.weekNumber <= baseTerm && p.amount < weeklyPayment) {
            registeredMissedCount++;
            baseArrears += (weeklyPayment - p.amount);
        }
    });

    const hasPenalty = isExpired || (registeredMissedCount >= 2);
    const totalTerm = baseTerm + (hasPenalty ? 1 : 0);

    const actualTotalPaid = (activeLoan.payments || []).reduce((acc, p) => acc + p.amount, 0);
    
    // El saldo a liquidar se compone de:
    // 1. Fallos registrados
    // 2. Semana actual (lo que resta por pagar de ella)
    // 3. Semanas futuras del contrato
    // 4. Semana extra (si aplica)
    
    // Primero determinamos el total esperado del contrato (Base + Penalización)
    const totalExpectedContract = totalTerm * weeklyPayment;
    
    // Calculamos cuánto se ha pagado en "semanas pasadas sin fallos" (Semanas asumidas)
    let assumedPaidAmount = 0;
    for (let i = 1; i < currentWeekSafe; i++) {
        if (i > baseTerm) break; // No asumir pagada la semana extra
        const p = (activeLoan.payments || []).find(pay => pay.weekNumber === i);
        if (!p) {
            assumedPaidAmount += weeklyPayment;
        }
    }

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

  const handleClientSelect = (client: Client) => {
      setSelectedClient(client);
      setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold tracking-tight uppercase">Buscador Inteligente</h1>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 font-black uppercase text-[10px] tracking-widest border-primary/20">
                    Sincronizado: {new Date().toLocaleTimeString()}
                </Badge>
            </div>
        </div>

        <Card className="shadow-lg border-2">
            <CardHeader className="p-4 border-b bg-muted/20">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" /> Parámetros de Búsqueda
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">
                    Selecciona Plaza y Localidad para visualizar el listado de clientes.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Plaza (Obligatorio)</label>
                        <Select value={filterPlaza} onValueChange={(v) => { setFilterPlaza(v); setFilterLocalidad('all'); setFilterPromotora('all'); }}>
                            <SelectTrigger className="h-10 text-[10px] font-black uppercase border-2"><SelectValue placeholder="PLAZA" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">TODAS LAS PLAZAS</SelectItem>
                                {plazaOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Localidad (Obligatorio)</label>
                        <Select value={filterLocalidad} onValueChange={(v) => { setFilterLocalidad(v); setFilterPromotora('all'); }} disabled={filterPlaza === 'all' && !isAdmin}>
                            <SelectTrigger className="h-10 text-[10px] font-black uppercase border-2"><SelectValue placeholder="LOCALIDAD" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">TODAS LAS ZONAS</SelectItem>
                                {localidadOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Promotora (Opcional)</label>
                        <Select value={filterPromotora} onValueChange={setFilterPromotora} disabled={filterLocalidad === 'all' && !isAdmin}>
                            <SelectTrigger className="h-10 text-[10px] font-black uppercase border-2"><SelectValue placeholder="PROMOTORA" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">TODAS LAS RUTAS</SelectItem>
                                {promotoraOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Semana de Inicio</label>
                        <Select value={filterWeek} onValueChange={setFilterWeek}>
                            <SelectTrigger className="h-10 text-[10px] font-black uppercase border-2"><SelectValue placeholder="SEMANA" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">CUALQUIER FECHA</SelectItem>
                                {weekOptions.map(iso => (
                                    <SelectItem key={iso} value={iso}>{formatDate(iso)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="relative">
                    <label className="text-[9px] font-black uppercase text-muted-foreground ml-1 mb-1 block">Buscar por Nombre</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ESCRIBE EL NOMBRE DEL CLIENTE..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-11 text-xs rounded-xl shadow-sm uppercase font-bold border-2"
                        />
                        {searchTerm && (
                            <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setSearchTerm('')}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>

        {canShowList ? (
            <Card className="shadow-lg border-2 overflow-hidden">
                <CardHeader className="p-4 border-b bg-primary/5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                            <List className="h-4 w-4 text-blue-600" /> Resultados de Consulta ({filteredList.length})
                        </CardTitle>
                        <CardDescription className="text-[9px] font-bold uppercase mt-0.5">
                            Mostrando todos los clientes para la localidad seleccionada.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-[80px]"></TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">Cliente</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Dirección</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Monto</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider">Estado</TableHead>
                                <TableHead className="text-right pr-6"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredList.map(({ loan, client }) => (
                                <TableRow 
                                    key={loan.id} 
                                    className="hover:bg-muted/30 cursor-pointer group transition-colors"
                                    onClick={() => handleClientSelect(client!)}
                                >
                                    <TableCell className="pl-6">
                                        <Avatar className="h-9 w-9 border shadow-sm group-hover:scale-110 transition-transform">
                                            <AvatarImage src={client?.avatarUrl} alt={client?.name} />
                                            <AvatarFallback className="text-[10px] font-bold">{client?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-[11px] font-black uppercase group-hover:text-blue-700">{client?.name}</span>
                                            <span className="text-[9px] text-muted-foreground font-bold">ID: {client?.id}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] font-bold uppercase text-zinc-600 truncate max-w-[250px]">{client?.street}, {client?.neighborhood}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-[11px] font-black text-zinc-900">{formatCurrency(loan.amount)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={loan.status === 'Overdue' ? 'destructive' : 'outline'} className="text-[8px] font-black uppercase h-4 px-2">
                                            {loan.status === 'Overdue' ? 'VENCIDO' : 'ACTIVO'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button variant="ghost" size="sm" className="h-8 rounded-full hover:bg-primary hover:text-white group-hover:px-6 transition-all duration-300">
                                            <span className="hidden group-hover:inline text-[9px] font-black uppercase mr-2">Consultar</span>
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredList.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-48 text-center">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <Info className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Sin coincidencias para los filtros actuales.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        ) : (
            <div className="py-24 flex flex-col items-center justify-center border-4 border-dashed rounded-[3rem] bg-zinc-50/50 space-y-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Smartphone className="h-24 w-24 text-primary/40 relative" />
                </div>
                <div className="text-center space-y-2 max-w-sm">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Panel de Consulta</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed px-8">
                        Selecciona una Plaza y una Localidad en la parte superior para cargar el listado de clientes y comenzar la supervisión.
                    </p>
                </div>
            </div>
        )}

        {/* MODAL DE DETALLE DEL CLIENTE - REDISEÑO SEGÚN IMAGEN */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden border-0 shadow-2xl rounded-sm">
                {selectedClient && (
                    <div className="bg-white flex flex-col">
                        {/* Cabecera Estilo Imagen */}
                        <div className="p-8 flex flex-col md:flex-row justify-between gap-6 border-b">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-24 w-24 border shadow-sm rounded-full overflow-hidden">
                                    <AvatarImage src={selectedClient.avatarUrl} alt={selectedClient.name} className="object-cover" />
                                    <AvatarFallback className="text-3xl font-black bg-muted text-zinc-400">{selectedClient.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black uppercase tracking-tight text-zinc-900 leading-none">{selectedClient.name}</h2>
                                    <p className="text-xs font-bold text-zinc-800">ID: {selectedClient.id}</p>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2.5 min-w-[280px]">
                                <div className="flex items-center gap-3 text-blue-600">
                                    <Phone className="h-4 w-4" />
                                    <span className="text-sm font-black tracking-tighter">{selectedClient.phone}</span>
                                </div>
                                <div className="flex items-center gap-3 text-blue-600">
                                    <Home className="h-4 w-4" />
                                    <span className="text-[10px] font-black uppercase">{selectedClient.street}, {selectedClient.neighborhood},</span>
                                </div>
                                <div className="flex items-center gap-4 text-zinc-500 pt-1">
                                    <div className="flex items-center gap-1.5">
                                        <Building className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase">{activeLoanDetails?.plazaName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase">{activeLoanDetails?.localidadName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <User className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold uppercase">{activeLoanDetails?.promotoraName}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase mt-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Fecha Préstamo: {activeLoanDetails ? formatDate(activeLoanDetails.loanStartDate) : 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Cuerpo en dos columnas */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-x divide-zinc-100">
                            {/* Columna Izquierda: DETALLES */}
                            <div className="p-8 space-y-8 bg-zinc-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 bg-white border rounded shadow-sm">
                                        <Wallet className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <h3 className="text-xl font-black uppercase tracking-tight text-zinc-800">Detalles:</h3>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white border rounded-2xl p-4 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1.5">Semana</p>
                                        <p className="text-2xl font-black text-zinc-900 leading-none">
                                            {activeLoanDetails?.currentLoanWeek} <span className="text-zinc-300 text-lg">/ {activeLoanDetails?.termInWeeks}</span>
                                        </p>
                                    </div>
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">Abono</p>
                                        <p className="text-2xl font-black text-blue-600 leading-none">{activeLoanDetails ? formatCurrency(activeLoanDetails.weeklyPayment) : '$0.00'}</p>
                                    </div>
                                    <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-center shadow-sm">
                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1.5">Fallos</p>
                                        <p className="text-2xl font-black text-red-600 leading-none">{activeLoanDetails?.missedWeeks || 0}</p>
                                    </div>
                                </div>

                                <div className="bg-zinc-100/80 rounded-[2rem] p-8 space-y-6 border border-zinc-200/50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Suma de Fallos</span>
                                        <span className="text-lg font-black text-zinc-800">{activeLoanDetails ? formatCurrency(activeLoanDetails.baseArrears) : '$0.00'}</span>
                                    </div>
                                    <div className="flex justify-between items-end pt-4 border-t border-zinc-200">
                                        <span className="text-[11px] font-black text-red-700 uppercase tracking-widest mb-1">Total a Liquidar</span>
                                        <span className="text-5xl font-black text-red-700 tracking-tighter leading-none">
                                            {activeLoanDetails ? formatCurrency(activeLoanDetails.totalBalance) : '$0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Columna Derecha: AVAL Y GARANTÍAS */}
                            <div className="p-8 space-y-10">
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Shield className="h-5 w-5 text-blue-400" />
                                        <h3 className="text-xl font-black uppercase tracking-tight text-zinc-800">Datos de Aval</h3>
                                    </div>
                                    <div className="bg-blue-600 rounded-[1.5rem] p-6 text-white shadow-xl shadow-blue-200/50 space-y-3 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                                            <UserCheck className="h-24 w-24" />
                                        </div>
                                        <p className="text-[9px] font-bold uppercase text-blue-200 tracking-widest">Responsable Solidario</p>
                                        <h4 className="text-2xl font-black uppercase leading-tight">{selectedClient.endorsement.split('(')[0].trim()}</h4>
                                        <p className="text-xs font-medium leading-relaxed opacity-90">
                                            {selectedClient.endorsement.match(/\((.*)\)/)?.[1] || 'SIN DIRECCIÓN REGISTRADA'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="h-5 w-5 text-blue-400" />
                                        <h3 className="text-xl font-black uppercase tracking-tight text-zinc-800">Garantía del Cliente</h3>
                                    </div>
                                    <div className="border-2 border-dashed border-zinc-200 rounded-[1.5rem] p-6 bg-zinc-50/50">
                                        <p className="text-xs font-black uppercase text-zinc-600 leading-relaxed tracking-wide text-center italic">
                                            {selectedClient.guarantee || 'SIN GARANTÍAS REGISTRADAS'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer de acción */}
                        <div className="p-6 bg-zinc-50 border-t flex justify-end">
                            <Button 
                                variant="outline" 
                                className="h-12 px-10 rounded-xl font-black uppercase text-xs tracking-widest border-2 hover:bg-zinc-100" 
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cerrar Expediente
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    </div>
  );
}
