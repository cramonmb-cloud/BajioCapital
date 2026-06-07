'use client';

import { useState, useMemo } from 'react';
import type { Loan, LoanPlan, Client, Plaza, Localidad, Promotora } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { 
  Banknote, TrendingDown, X, Calculator, Landmark, AlertCircle, 
  LayoutDashboard, Building2, FileBarChart2, TrendingUp, Percent, CheckCircle2,
  Calendar, ShieldAlert, Award
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { ReportsSection } from './reports-section';
import { Separator } from './ui/separator';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import Loading from '@/app/dashboard/loading';
import { generateColorPalette } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ControlClientPageProps {
    initialClients: Client[];
    initialLoanPlans: LoanPlan[];
    initialPlazas: Plaza[];
    initialLocalidades: Localidad[];
    initialPromotoras: Promotora[];
}

// Centralized helper to check dynamic penalty
const checkPenalty = (loan: Loan, loanPlan: LoanPlan) => {
    const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
    let missedWeeksCount = 0;
    let totalPaidInBaseTerm = 0;
    
    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const startDayUTC = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
    const currentLoanWeek = Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);

    const baseTerm = loanPlan.termInWeeks;
    for (let i = 1; i <= baseTerm; i++) {
        const p = loan.payments.find(pay => pay.weekNumber === i);
        if (p) {
            totalPaidInBaseTerm += p.amount;
            if (p.amount < weeklyPayment) missedWeeksCount++;
        } else if (i < currentLoanWeek - 1) {
            missedWeeksCount++;
        }
    }
    
    const isExpired = currentLoanWeek > baseTerm + 1;
    return (missedWeeksCount >= 2) || (isExpired && totalPaidInBaseTerm < (baseTerm * weeklyPayment));
};

export function ControlClientPage({ initialClients, initialLoanPlans, initialPlazas, initialLocalidades, initialPromotoras }: ControlClientPageProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'resumen' | 'plazas' | 'informes'>('resumen');
    const { data, loading: dataLoading } = useRealtimeData();

    const { loans, clients, loanPlans, plazas, localidades, promotoras } = data || {
        loans: [],
        clients: initialClients,
        loanPlans: initialLoanPlans,
        plazas: initialPlazas,
        localidades: initialLocalidades,
        promotoras: initialPromotoras,
    };

    const filteredLoans = useMemo(() => {
        if (!dateRange || !dateRange.from) {
            return loans;
        }
        const fromDate = dateRange.from;
        const toDate = dateRange.to ? dateRange.to : fromDate;

        return loans.filter(loan => {
            const loanStartDate = new Date(loan.startDate);
            return loanStartDate >= fromDate && loanStartDate <= toDate;
        });
    }, [loans, dateRange]);

    const stats = useMemo(() => {
        const statsByPlaza: Record<string, { 
            plazaName: string; 
            totalPrestado: number; 
            dineroEnCalle: number; 
            carteraVencida: number; 
            totalColocadoActive: number; 
            color: string; 
        }> = {};
        const colorPalette = generateColorPalette(plazas.length);

        plazas.forEach((plaza, index) => {
            statsByPlaza[plaza.id] = {
                plazaName: plaza.name,
                totalPrestado: 0,
                dineroEnCalle: 0,
                carteraVencida: 0,
                totalColocadoActive: 0,
                color: colorPalette[index],
            };
        });

        let globalTotalPrestado = 0;
        let globalDineroEnCalle = 0;
        let globalCarteraVencida = 0;
        let globalTotalColocadoActive = 0;

        filteredLoans.forEach(loan => {
            if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return;

            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            if (!localidad) return;

            const plazaId = localidad.plazaId;
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan) return;

            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const baseTerm = loanPlan.termInWeeks;

            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const startDayUTC = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
            const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
            const rawCurrentLoanWeek = Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);
            
            const actualTotalPaid = (loan.payments || []).reduce((sum, p) => sum + p.amount, 0);

            // CARTERA VENCIDA (PRÉSTAMO EXPIRADO CON ADEUDO)
            if (rawCurrentLoanWeek > baseTerm + 1) {
                let totalPaidInBase = 0;
                let missedCount = 0;
                for (let i = 1; i <= baseTerm; i++) {
                    const p = loan.payments.find(pay => pay.weekNumber === i);
                    if (p) {
                        totalPaidInBase += p.amount;
                        if (p.amount < weeklyPayment) missedCount++;
                    } else {
                        missedCount++;
                    }
                }
                
                const isExpired = true;
                const hasPenalty = (missedCount >= 2) || (isExpired && totalPaidInBase < (baseTerm * weeklyPayment));
                
                const totalExpectedWithPenalty = weeklyPayment * (baseTerm + (hasPenalty ? 1 : 0));
                const balanceRemainingAbsolute = Math.max(0, totalExpectedWithPenalty - actualTotalPaid);
                
                if (balanceRemainingAbsolute > 0) {
                    if (statsByPlaza[plazaId]) {
                        statsByPlaza[plazaId].carteraVencida += balanceRemainingAbsolute;
                    }
                    globalCarteraVencida += balanceRemainingAbsolute;
                }
                return; 
            }

            // CAPITAL PENDIENTE (VIGENTE)
            const hasPenalty = checkPenalty(loan, loanPlan);
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
            const totalExpected = weeklyPayment * termInWeeks;

            let effectivePaidForStats = 0;
            for (let i = 1; i <= termInWeeks; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p) {
                    effectivePaidForStats += p.amount;
                } else if (i < rawCurrentLoanWeek - 1) {
                    effectivePaidForStats += weeklyPayment;
                }
            }

            const principalRatio = totalExpected > 0 ? (loan.amount / totalExpected) : 0;
            const capitalRecuperado = effectivePaidForStats * principalRatio;
            const capitalPendiente = Math.max(0, loan.amount - capitalRecuperado);
            const balanceRemainingVigente = Math.max(0, totalExpected - effectivePaidForStats);

            if (statsByPlaza[plazaId]) {
                statsByPlaza[plazaId].totalPrestado += capitalPendiente;
                statsByPlaza[plazaId].dineroEnCalle += balanceRemainingVigente;
                statsByPlaza[plazaId].totalColocadoActive += loan.amount;
            }

            globalTotalPrestado += capitalPendiente;
            globalDineroEnCalle += balanceRemainingVigente;
            globalTotalColocadoActive += loan.amount;
        });

        return {
            byPlaza: Object.values(statsByPlaza),
            global: {
                totalPrestado: globalTotalPrestado,
                dineroEnCalle: globalDineroEnCalle,
                carteraVencida: globalCarteraVencida,
                totalColocadoActive: globalTotalColocadoActive
            }
        };

    }, [filteredLoans, loanPlans, plazas, localidades, promotoras]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const clearFilters = () => {
        setDateRange(undefined);
    };

    // Calculate recoveries
    const globalCapitalRecuperado = Math.max(0, stats.global.totalColocadoActive - stats.global.totalPrestado);
    const globalRecuperadoPercent = stats.global.totalColocadoActive > 0 
        ? Math.round((globalCapitalRecuperado / stats.global.totalColocadoActive) * 100) 
        : 0;
    const globalPendientePercent = stats.global.totalColocadoActive > 0 
        ? Math.round((stats.global.totalPrestado / stats.global.totalColocadoActive) * 100) 
        : 0;

    if (dataLoading) {
        return <Loading />;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200/60 dark:border-zinc-800 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-blue-500/10 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wider">Métricas Financieras</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight uppercase text-zinc-900 dark:text-zinc-50">Control de Cartera</h1>
                    <p className="text-sm text-muted-foreground">
                        Supervisa colocación, capital activo y estados de morosidad en tiempo real.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded-2xl border">
                    <Calendar className="h-4 w-4 text-muted-foreground ml-2" />
                    <DatePicker date={dateRange} onDateChange={setDateRange} />
                    {dateRange && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={clearFilters}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-xl"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Quitar filtros</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Premium Sliding Navigation Tabs */}
            <div className="flex justify-center">
                <div className="relative flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-[2rem] border shadow-inner max-w-lg w-full justify-between items-center h-12">
                    <div 
                        className="absolute top-1 bottom-1 rounded-[1.7rem] transition-all duration-300 ease-in-out shadow-md"
                        style={{
                            left: activeTab === 'resumen' ? '6px' : activeTab === 'plazas' ? 'calc(33.3% + 2px)' : 'calc(66.6% - 2px)',
                            width: 'calc(33.3% - 4px)',
                            backgroundColor: '#3b82f6',
                        }}
                    />
                    <button
                        onClick={() => setActiveTab('resumen')}
                        className={cn(
                            "flex-1 py-2 rounded-full text-xs font-black uppercase text-center transition-all relative z-10",
                            activeTab === 'resumen' ? "text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            Resumen
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('plazas')}
                        className={cn(
                            "flex-1 py-2 rounded-full text-xs font-black uppercase text-center transition-all relative z-10",
                            activeTab === 'plazas' ? "text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Plazas
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('informes')}
                        className={cn(
                            "flex-1 py-2 rounded-full text-xs font-black uppercase text-center transition-all relative z-10",
                            activeTab === 'informes' ? "text-white" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <FileBarChart2 className="h-3.5 w-3.5" />
                            Informes
                        </span>
                    </button>
                </div>
            </div>

            {/* TAB CONTENT: RESUMEN */}
            {activeTab === 'resumen' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Metrics Grid */}
                    <div className="grid gap-6 md:grid-cols-3">
                        <Card className="relative overflow-hidden group bg-gradient-to-br from-blue-500/10 to-indigo-500/5 hover:from-blue-500/15 hover:to-indigo-500/10 border-blue-500/20 rounded-3xl shadow-sm hover:shadow-md hover:shadow-blue-500/5 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all duration-500">
                                <Landmark className="h-28 w-28 text-blue-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black uppercase tracking-wider text-blue-600/80">Capital Pendiente</p>
                                    <div className="p-2 bg-blue-500/15 text-blue-600 rounded-xl">
                                        <Landmark className="h-4 w-4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-3xl font-black tracking-tight text-blue-600">
                                    {formatCurrency(stats.global.totalPrestado)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Capital activo aún por cobrar de los préstamos en plazo vigente.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden group bg-gradient-to-br from-emerald-500/10 to-teal-500/5 hover:from-emerald-500/15 hover:to-teal-500/10 border-emerald-500/20 rounded-3xl shadow-sm hover:shadow-md hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all duration-500">
                                <Calculator className="h-28 w-28 text-emerald-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black uppercase tracking-wider text-emerald-600/80">Dinero en Calle</p>
                                    <div className="p-2 bg-emerald-500/15 text-emerald-600 rounded-xl">
                                        <Calculator className="h-4 w-4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-3xl font-black tracking-tight text-emerald-600">
                                    {formatCurrency(stats.global.dineroEnCalle)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Saldo total (capital + rendimientos) pendiente de cobro en préstamos activos.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden group bg-gradient-to-br from-rose-500/10 to-red-500/5 hover:from-rose-500/15 hover:to-red-500/10 border-rose-500/20 rounded-3xl shadow-sm hover:shadow-md hover:shadow-rose-500/5 transition-all duration-300 hover:-translate-y-1">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-all duration-500">
                                <AlertCircle className="h-28 w-28 text-rose-600" />
                            </div>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black uppercase tracking-wider text-rose-600/80">Cartera Vencida</p>
                                    <div className="p-2 bg-rose-500/15 text-rose-600 rounded-xl">
                                        <AlertCircle className="h-4 w-4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="text-3xl font-black tracking-tight text-rose-600">
                                    {formatCurrency(stats.global.carteraVencida)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Adeudo acumulado de préstamos expirados (incluyendo recargos/penalizaciones).
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Visual Health Indicator / Progress Bar */}
                    <Card className="bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
                        <CardHeader className="px-0 pt-0 pb-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-base font-bold uppercase tracking-wide">Rendimiento de Colocación Activa</CardTitle>
                                    <CardDescription>Distribución porcentual de los préstamos vigentes actualmente en calle.</CardDescription>
                                </div>
                                <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/15 px-3 py-1.5 rounded-xl text-blue-600 dark:text-blue-400 font-bold text-xs">
                                    <TrendingUp className="h-4 w-4" />
                                    Total Colocado Activo: {formatCurrency(stats.global.totalColocadoActive)}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="px-0 pb-0 space-y-6">
                            {/* Segmented Progress Bar */}
                            <div className="space-y-2">
                                <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
                                    <div 
                                        className="bg-gradient-to-r from-emerald-500 to-green-400 h-full transition-all duration-500" 
                                        style={{ width: `${globalRecuperadoPercent}%` }}
                                        title={`Recuperado: ${globalRecuperadoPercent}%`}
                                    />
                                    <div 
                                        className="bg-gradient-to-r from-blue-500 to-indigo-400 h-full transition-all duration-500" 
                                        style={{ width: `${globalPendientePercent}%` }}
                                        title={`Pendiente: ${globalPendientePercent}%`}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase px-1">
                                    <span>Colocación Inicial</span>
                                    <span>Límite de Plazo</span>
                                </div>
                            </div>

                            {/* Legend Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                                    <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Capital Recuperado</p>
                                        <p className="text-lg font-extrabold text-zinc-800 dark:text-zinc-200">{formatCurrency(globalCapitalRecuperado)}</p>
                                        <p className="text-[10px] text-muted-foreground">{globalRecuperadoPercent}% del capital inicial recuperado.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                    <div className="h-3.5 w-3.5 rounded-full bg-blue-500 mt-0.5" />
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">Capital Pendiente</p>
                                        <p className="text-lg font-extrabold text-zinc-800 dark:text-zinc-200">{formatCurrency(stats.global.totalPrestado)}</p>
                                        <p className="text-[10px] text-muted-foreground">{globalPendientePercent}% del capital inicial por cobrar.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* TAB CONTENT: PLAZAS */}
            {activeTab === 'plazas' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {stats.byPlaza.map(stat => {
                            const plazaCapitalRecuperado = Math.max(0, stat.totalColocadoActive - stat.totalPrestado);
                            const recPercent = stat.totalColocadoActive > 0 
                                ? Math.round((plazaCapitalRecuperado / stat.totalColocadoActive) * 100) 
                                : 0;
                            const totalPlazaPortfolio = stat.totalPrestado + stat.carteraVencida;
                            const cvRatio = totalPlazaPortfolio > 0
                                ? Math.round((stat.carteraVencida / totalPlazaPortfolio) * 100)
                                : 0;

                            return (
                                <Card 
                                    key={stat.plazaName} 
                                    className="relative overflow-hidden rounded-3xl border-2 hover:shadow-xl hover:shadow-zinc-200/50 dark:hover:shadow-none transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between"
                                    style={{ borderColor: `${stat.color}30` }}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                        <Building2 className="h-24 w-24" style={{ color: stat.color }} />
                                    </div>
                                    
                                    <div>
                                        <div className="p-5 border-b flex items-center justify-between" style={{ backgroundColor: `${stat.color}06` }}>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: stat.color }} />
                                                <CardTitle className="text-sm font-black uppercase tracking-wider" style={{ color: stat.color }}>
                                                    {stat.plazaName}
                                                </CardTitle>
                                            </div>
                                            <span className="text-[9px] font-black uppercase px-2 py-1 rounded-full border" style={{ color: stat.color, borderColor: `${stat.color}40`, backgroundColor: `${stat.color}10` }}>
                                                Activos
                                            </span>
                                        </div>
                                        
                                        <div className="p-5 space-y-4">
                                            {/* Metrics list */}
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Cap. Pendiente:</span>
                                                    <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">{formatCurrency(stat.totalPrestado)}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">En Calle Vigente:</span>
                                                    <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-100">{formatCurrency(stat.dineroEnCalle)}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase">Cartera Vencida:</span>
                                                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">{formatCurrency(stat.carteraVencida)}</span>
                                                </div>
                                            </div>

                                            {/* Micro Progress bars */}
                                            <div className="space-y-2 pt-2">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase">
                                                        <span>Recuperación de Capital</span>
                                                        <span className="font-extrabold" style={{ color: stat.color }}>{recPercent}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ width: `${recPercent}%`, backgroundColor: stat.color }} />
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase">
                                                        <span>Tasa de Morosidad</span>
                                                        <span className="font-extrabold text-rose-600">{cvRatio}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                                        <div className="h-full bg-rose-500 rounded-full" style={{ width: `${cvRatio}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border-t flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                                        <span>Colocación Activa:</span>
                                        <span className="font-extrabold text-zinc-700 dark:text-zinc-300">{formatCurrency(stat.totalColocadoActive)}</span>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    {stats.byPlaza.length === 0 && (
                        <Card className="rounded-3xl border border-dashed p-12 text-center text-muted-foreground bg-zinc-50/50">
                            <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="font-medium">No hay plazas definidas o no hay datos de préstamos activos.</p>
                        </Card>
                    )}
                </div>
            )}

            {/* TAB CONTENT: INFORMES */}
            {activeTab === 'informes' && (
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <ReportsSection 
                        loans={loans} 
                        clients={clients} 
                        loanPlans={loanPlans} 
                        plazas={plazas} 
                        localidades={localidades} 
                        promotoras={promotoras} 
                    />
                </div>
            )}
        </div>
    );
}