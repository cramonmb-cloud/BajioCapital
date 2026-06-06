'use client';

import { useState, useMemo } from 'react';
import type { OverdueLoanDetails } from '@/app/dashboard/cartera-vencida/page';
import { Input } from '@/components/ui/input';
import { OverdueCard } from '@/components/overdue-card';
import type { Client, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X, Search, Filter, ChevronDown, ChevronUp, CalendarDays, Eye, EyeOff, CalendarRange } from 'lucide-react';
import { generateColorPalette, cn } from '@/lib/utils';
import { useRealtimeData } from '@/hooks/use-realtime-data';

interface OverduePortfolioClientPageProps {
    initialOverdueLoans: OverdueLoanDetails[];
    clients: Client[];
    loanPlans: LoanPlan[];
    plazas: Plaza[];
    localidades: Localidad[];
    promotoras: Promotora[];
    title: string;
}

export function OverduePortfolioClientPage({ 
    initialOverdueLoans, 
    clients, 
    loanPlans, 
    plazas, 
    localidades, 
    promotoras,
    title
}: OverduePortfolioClientPageProps) {
    const { data } = useRealtimeData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlaza, setSelectedPlaza] = useState('all');
    const [selectedLocalidad, setSelectedLocalidad] = useState('all');
    const [selectedPromotora, setSelectedPromotora] = useState('all');
    const [selectedFailures, setSelectedFailures] = useState('all');
    
    // Date Filters
    const [selectedStartDate, setSelectedStartDate] = useState('all');
    const [startFilterMode, setStartFilterMode] = useState<'include' | 'exclude'>('include');
    
    const [selectedMaturityDate, setSelectedMaturityDate] = useState('all');
    const [maturityFilterMode, setMaturityFilterMode] = useState<'include' | 'exclude'>('include');

    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const isOverduePortfolio = title === "Pagos Pendientes";
    const globalDebtLabel = isOverduePortfolio ? "Cobro de Mora (Filtro)" : "Deuda Pendiente (Filtro)";

    const appConfig = data?.config;

    const plazaColors = useMemo(() => {
        const sortedPlazas = [...plazas].sort((a, b) => a.name.localeCompare(b.name));
        const colors = generateColorPalette(sortedPlazas.length);
        const map: Record<string, string> = {};
        sortedPlazas.forEach((p, i) => {
            map[p.id] = colors[i];
        });
        return map;
    }, [plazas]);

    const availableStartDates = useMemo(() => {
        const dates = Array.from(new Set(initialOverdueLoans.map(d => {
            const date = new Date(d.loan.startDate);
            return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
        })));
        return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [initialOverdueLoans]);

    const availableMaturityDates = useMemo(() => {
        const dates = Array.from(new Set(initialOverdueLoans.map(d => {
            const startDate = new Date(d.loan.startDate);
            const mDate = new Date(startDate);
            mDate.setUTCDate(startDate.getUTCDate() + (d.loanPlan.termInWeeks * 7));
            return new Date(Date.UTC(mDate.getUTCFullYear(), mDate.getUTCMonth(), mDate.getUTCDate())).toISOString();
        })));
        return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [initialOverdueLoans]);

    const filteredLocalidadesOptions = useMemo(() => {
        let result = selectedPlaza === 'all' 
            ? localidades 
            : localidades.filter(l => l.plazaId === selectedPlaza);
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedPlaza, localidades]);

    const filteredPromotorasOptions = useMemo(() => {
        let result;
        if (selectedLocalidad === 'all') {
            if (selectedPlaza === 'all') {
                result = promotoras;
            } else {
                const plazaLocalidadIds = localidades.filter(l => l.plazaId === selectedPlaza).map(l => l.id);
                result = promotoras.filter(p => plazaLocalidadIds.includes(p.localidadId));
            }
        } else {
            result = promotoras.filter(p => p.localidadId === selectedLocalidad);
        }
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedLocalidad, selectedPlaza, promotoras, localidades]);

    const filteredLoans = useMemo(() => {
        return initialOverdueLoans.filter(details => {
            const term = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                details.client.name.toLowerCase().includes(term) ||
                details.client.street.toLowerCase().includes(term) ||
                details.client.phone.includes(term) || 
                details.hierarchy.plazaName.toLowerCase().includes(term) ||
                details.hierarchy.localidadName.toLowerCase().includes(term) ||
                details.hierarchy.promotoraName.toLowerCase().includes(term);

            const matchesPlaza = selectedPlaza === 'all' || details.hierarchy.plazaId === selectedPlaza;
            const matchesLocalidad = selectedLocalidad === 'all' || details.hierarchy.localidadId === selectedLocalidad;
            const matchesPromotora = selectedPromotora === 'all' || details.hierarchy.promotoraId === selectedPromotora;
            const matchesFailures = selectedFailures === 'all' || details.missedPayments.toString() === selectedFailures;
            
            // Start Date Filter
            let matchesStart = true;
            if (selectedStartDate !== 'all') {
                const loanDate = new Date(details.loan.startDate);
                const loanDateIso = new Date(Date.UTC(loanDate.getUTCFullYear(), loanDate.getUTCMonth(), loanDate.getUTCDate())).toISOString();
                matchesStart = startFilterMode === 'include' ? (loanDateIso === selectedStartDate) : (loanDateIso !== selectedStartDate);
            }

            // Maturity Date Filter
            let matchesMaturity = true;
            if (selectedMaturityDate !== 'all') {
                const sDate = new Date(details.loan.startDate);
                const mDate = new Date(sDate);
                mDate.setUTCDate(sDate.getUTCDate() + (details.loanPlan.termInWeeks * 7));
                const mDateIso = new Date(Date.UTC(mDate.getUTCFullYear(), mDate.getUTCMonth(), mDate.getUTCDate())).toISOString();
                matchesMaturity = maturityFilterMode === 'include' ? (mDateIso === selectedMaturityDate) : (mDateIso !== selectedMaturityDate);
            }

            return matchesSearch && matchesPlaza && matchesLocalidad && matchesPromotora && matchesFailures && matchesStart && matchesMaturity;
        });
    }, [initialOverdueLoans, searchTerm, selectedPlaza, selectedLocalidad, selectedPromotora, selectedFailures, selectedStartDate, startFilterMode, selectedMaturityDate, maturityFilterMode]);

    const totalDue = filteredLoans.reduce((acc, details) => acc + details.amountDue, 0);
    const totalClients = new Set(filteredLoans.map(d => d.client.id)).size;

    const formatDate = (iso: string) => {
        const date = new Date(iso);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const correctedDate = new Date(date.getTime() + userTimezoneOffset);
        return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <div className="space-y-4">
            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
                <div className="bg-destructive/80 text-white p-3 rounded-lg shadow-sm border border-destructive">
                    <div className="text-[9px] font-black uppercase tracking-wider opacity-80">{globalDebtLabel}</div>
                    <div className="text-lg font-black">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(totalDue)}
                    </div>
                </div>
                <div className="bg-card text-card-foreground p-3 rounded-lg border shadow-sm">
                    <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Clientes (Filtro)</div>
                    <div className="text-lg font-black">{totalClients}</div>
                    <p className="text-[8px] text-muted-foreground uppercase">{initialOverdueLoans.length} total histórico</p>
                </div>
            </div>

            <div className="bg-card p-3 rounded-lg border shadow-sm space-y-3">
                <div className="md:hidden">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                        className={cn(
                            "w-full flex justify-between items-center h-10 border-2 font-black uppercase text-[10px] tracking-widest",
                            isFiltersOpen ? "bg-zinc-100 border-zinc-300" : "bg-zinc-50"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-blue-600" />
                            Buscador y Filtros
                        </div>
                        {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </div>

                <div className={cn(
                    "flex flex-col gap-3",
                    !isFiltersOpen && "hidden md:flex"
                )}>
                    <div className="w-full space-y-1">
                        <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Buscador</label>
                        <div className="relative">
                            <Input
                                placeholder="Nombre, calle o teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-10 text-base font-bold uppercase"
                            />
                            {searchTerm && (
                                <Button variant="ghost" size="icon" onClick={() => setSearchTerm('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7">
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Plaza</label>
                            <Select value={selectedPlaza} onValueChange={(v) => { setSelectedPlaza(v); setSelectedLocalidad('all'); setSelectedPromotora('all'); }}>
                                <SelectTrigger className="h-10 text-[10px] uppercase font-bold"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {[...plazas].sort((a,b) => a.name.localeCompare(b.name)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Localidad</label>
                            <Select value={selectedLocalidad} onValueChange={(v) => { setSelectedLocalidad(v); setSelectedPromotora('all'); }}>
                                <SelectTrigger className="h-10 text-[10px] uppercase font-bold"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {filteredLocalidadesOptions.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Promotora</label>
                            <Select value={selectedPromotora} onValueChange={setSelectedPromotora}>
                                <SelectTrigger className="h-10 text-[10px] uppercase font-bold"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {filteredPromotorasOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Fallos</label>
                            <Select value={selectedFailures} onValueChange={setSelectedFailures}>
                                <SelectTrigger className="h-10 text-[10px] border-zinc-200 uppercase font-bold"><SelectValue placeholder="Ver Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Ver Todos</SelectItem>
                                    {Array.from({ length: 15 }, (_, i) => (
                                        <SelectItem key={i + 2} value={(i + 2).toString()}>{i + 2} Fallos</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Start Date Filters */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-1">
                                <CalendarDays className="h-2.5 w-2.5 text-blue-600" /> Fecha de Inicio
                            </label>
                            <Select value={selectedStartDate} onValueChange={setSelectedStartDate}>
                                <SelectTrigger className="h-10 text-[10px] border-blue-100 bg-blue-50/20 font-bold">
                                    <SelectValue placeholder="Cualquier Inicio" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Cualquier Inicio</SelectItem>
                                    {availableStartDates.map(iso => (
                                        <SelectItem key={iso} value={iso}>{formatDate(iso)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Modo Inicio</label>
                            <Select 
                                value={startFilterMode} 
                                onValueChange={(v: any) => setStartFilterMode(v)}
                                disabled={selectedStartDate === 'all'}
                            >
                                <SelectTrigger className={cn(
                                    "h-10 text-[10px] font-black uppercase border-blue-200 shadow-sm",
                                    startFilterMode === 'exclude' ? "text-orange-600" : "text-blue-700"
                                )}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="include" className="text-blue-700 font-bold">
                                        <div className="flex items-center gap-1.5"><Eye className="h-3 w-3"/> Mostrar Solo</div>
                                    </SelectItem>
                                    <SelectItem value="exclude" className="text-orange-600 font-bold">
                                        <div className="flex items-center gap-1.5"><EyeOff className="h-3 w-3"/> Ocultar Fecha</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Maturity Date Filters */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-1">
                                <CalendarRange className="h-2.5 w-2.5 text-red-600" /> Fecha Vencimiento
                            </label>
                            <Select value={selectedMaturityDate} onValueChange={setSelectedMaturityDate}>
                                <SelectTrigger className="h-10 text-[10px] border-red-100 bg-red-50/20 font-bold">
                                    <SelectValue placeholder="Cualquier Vence" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Cualquier Vence</SelectItem>
                                    {availableMaturityDates.map(iso => (
                                        <SelectItem key={iso} value={iso}>{formatDate(iso)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Modo Vence</label>
                            <Select 
                                value={maturityFilterMode} 
                                onValueChange={(v: any) => setMaturityFilterMode(v)}
                                disabled={selectedMaturityDate === 'all'}
                            >
                                <SelectTrigger className={cn(
                                    "h-10 text-[10px] font-black uppercase border-red-200 shadow-sm",
                                    maturityFilterMode === 'exclude' ? "text-orange-600" : "text-red-700"
                                )}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="include" className="text-red-700 font-bold">
                                        <div className="flex items-center gap-1.5"><Eye className="h-3 w-3"/> Mostrar Solo</div>
                                    </SelectItem>
                                    <SelectItem value="exclude" className="text-orange-600 font-bold">
                                        <div className="flex items-center gap-1.5"><EyeOff className="h-3 w-3"/> Ocultar Fecha</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-1 pt-1">
                    {filteredLoans.length > 0 ? (
                        filteredLoans.map(details => (
                           <OverdueCard 
                                key={details.loan.id} 
                                details={details} 
                                allClients={clients}
                                allLoanPlans={loanPlans}
                                plazaColor={plazaColors[details.hierarchy.plazaId] || '#666'}
                                isOverduePortfolio={isOverduePortfolio}
                                appConfig={appConfig}
                           />
                        ))
                    ) : (
                        <div className="col-span-full py-8 text-center border-2 border-dashed rounded-lg bg-muted/20">
                            <p className="text-[11px] text-muted-foreground font-black uppercase">
                                Sin resultados para estos filtros
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
