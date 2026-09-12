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
  Calendar, ShieldAlert, Award, ShieldCheck
} from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { ReportsSection } from './reports-section';
import { Separator } from './ui/separator';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { query, where, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
    const startDayUTC = isNaN(loanStartDate.getTime()) 
        ? new Date() 
        : new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
    const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
    const currentLoanWeek = isNaN(daysDiff) ? 1 : Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);

    const baseTerm = loanPlan.termInWeeks;
    for (let i = 1; i <= baseTerm; i++) {
        const p = loan.payments.find(pay => pay.weekNumber === i);
        if (p) {
            const pAmount = (p.amount === null || p.amount === undefined || isNaN(p.amount)) ? 0 : p.amount;
            totalPaidInBaseTerm += pAmount;
            if (pAmount < weeklyPayment) missedWeeksCount++;
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
    const activeLoansQuery = useMemo(() => query(
        collection(db, 'loans'),
        where('status', 'in', ['Active', 'Overdue'])
    ), []);

    const { data, loading: dataLoading } = useRealtimeData({
        clients: initialClients,
        loanPlans: initialLoanPlans,
        plazas: initialPlazas,
        localidades: initialLocalidades,
        promotoras: initialPromotoras,
    }, {
        enabledCollections: ['loans', 'clients', 'loanPlans', 'plazas', 'localidades', 'promotoras'],
        queries: {
            loans: activeLoansQuery
        }
    });

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
            totalColocadoConInteres: number;
            totalCobradoActivo: number;
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
                totalColocadoConInteres: 0,
                totalCobradoActivo: 0,
                carteraVencida: 0,
                totalColocadoActive: 0,
                color: colorPalette[index],
            };
        });

        let globalTotalPrestado = 0;
        let globalDineroEnCalle = 0;
        let globalTotalColocadoConInteres = 0;
        let globalTotalCobradoActivo = 0;
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
            const startDayUTC = isNaN(loanStartDate.getTime()) 
                ? new Date() 
                : new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
            const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
            const rawCurrentLoanWeek = isNaN(daysDiff) ? 1 : Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);
            
            const actualTotalPaid = (loan.payments || []).reduce((sum, p) => {
                const pAmount = (p.amount === null || p.amount === undefined || isNaN(p.amount)) ? 0 : p.amount;
                return sum + pAmount;
            }, 0);

            // CARTERA VENCIDA (PRÉSTAMO EXPIRADO CON ADEUDO)
            if (rawCurrentLoanWeek > baseTerm + 1) {
                let totalPaidInBase = 0;
                let missedCount = 0;
                for (let i = 1; i <= baseTerm; i++) {
                    const p = loan.payments.find(pay => pay.weekNumber === i);
                    if (p) {
                        const pAmount = (p.amount === null || p.amount === undefined || isNaN(p.amount)) ? 0 : p.amount;
                        totalPaidInBase += pAmount;
                        if (pAmount < weeklyPayment) missedCount++;
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
                    const pAmount = (p.amount === null || p.amount === undefined || isNaN(p.amount)) ? 0 : p.amount;
                    effectivePaidForStats += pAmount;
                } else if (i === rawCurrentLoanWeek - 1) {
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
                statsByPlaza[plazaId].totalColocadoConInteres += totalExpected;
                statsByPlaza[plazaId].totalCobradoActivo += effectivePaidForStats;
                statsByPlaza[plazaId].totalColocadoActive += loan.amount;
            }

            globalTotalPrestado += capitalPendiente;
            globalDineroEnCalle += balanceRemainingVigente;
            globalTotalColocadoConInteres += totalExpected;
            globalTotalCobradoActivo += effectivePaidForStats;
            globalTotalColocadoActive += loan.amount;
        });

        return {
            byPlaza: Object.values(statsByPlaza),
            global: {
                totalPrestado: globalTotalPrestado,
                dineroEnCalle: globalDineroEnCalle,
                totalColocadoConInteres: globalTotalColocadoConInteres,
                totalCobradoActivo: globalTotalCobradoActivo,
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
    const globalTotalColocadoConInteres = stats.global.totalColocadoConInteres;
    const globalCobradoPercent = globalTotalColocadoConInteres > 0
        ? Math.round((stats.global.totalCobradoActivo / globalTotalColocadoConInteres) * 100)
        : 0;
    const globalCallePercent = globalTotalColocadoConInteres > 0
        ? Math.round((stats.global.dineroEnCalle / globalTotalColocadoConInteres) * 100)
        : 0;

    if (dataLoading) {
        return <Loading />;
    }

    return (
        <div className="relative space-y-6 animate-in fade-in duration-300">
            {/* Ambient Apple Liquid Glass Refraction Glows */}
            <div className="pointer-events-none absolute -top-16 -left-16 w-80 h-80 rounded-full bg-blue-500/10 dark:bg-blue-600/15 blur-3xl -z-10" />
            <div className="pointer-events-none absolute top-1/4 right-0 w-80 h-80 rounded-full bg-purple-500/10 dark:bg-purple-600/15 blur-3xl -z-10" />
            <div className="pointer-events-none absolute top-2/3 left-1/4 w-72 h-72 rounded-full bg-emerald-500/10 dark:bg-emerald-600/15 blur-3xl -z-10" />

            {/* Nav Tabs & Date Picker Row (Apple Liquid Glass Toolbar) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 rounded-2xl apple-glass">
                <div className="relative flex bg-zinc-200/50 dark:bg-zinc-800/60 backdrop-blur-md p-1 rounded-full border border-black/5 dark:border-white/5 w-full sm:max-w-md justify-between items-center h-10 shadow-inner">
                    <div 
                        className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out bg-white dark:bg-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.12)] border border-black/5 dark:border-white/10"
                        style={{
                            left: activeTab === 'resumen' ? '4px' : activeTab === 'plazas' ? 'calc(33.333% + 2px)' : 'calc(66.666% - 2px)',
                            width: 'calc(33.333% - 4px)',
                        }}
                    />
                    <button
                        onClick={() => setActiveTab('resumen')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-all relative z-10",
                            activeTab === 'resumen' 
                                ? "text-zinc-900 dark:text-white font-bold" 
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                            "flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-all relative z-10",
                            activeTab === 'plazas' 
                                ? "text-zinc-900 dark:text-white font-bold" 
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
                            "flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-all relative z-10",
                            activeTab === 'informes' 
                                ? "text-zinc-900 dark:text-white font-bold" 
                                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                        )}
                    >
                        <span className="flex items-center justify-center gap-1.5">
                            <FileBarChart2 className="h-3.5 w-3.5" />
                            Informes
                        </span>
                    </button>
                </div>

                <div className="flex items-center apple-glass-pill rounded-xl h-10 w-full sm:w-auto px-1 shadow-xs">
                    <DatePicker date={dateRange} onDateChange={setDateRange} variant="ghost" className="w-full sm:w-[260px] text-xs font-medium" />
                    {dateRange && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={clearFilters}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                        >
                            <X className="h-3.5 w-3.5" />
                            <span className="sr-only">Quitar filtros</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* TAB CONTENT: RESUMEN */}
            {activeTab === 'resumen' && (
                <div className="space-y-3.5 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Mobile Status Capsule (Apple Liquid Glass) */}
                    <div className="sm:hidden flex items-center justify-between px-3.5 py-2.5 rounded-2xl apple-glass shadow-xs">
                        <div className="flex items-center gap-2.5">
                            <div className="relative flex items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-400/30 animate-ping" />
                            </div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {filteredLoans.length}
                                </span>
                                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                    préstamos activos
                                </span>
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            100% al corriente
                        </div>
                    </div>

                    {/* Mobile High-Density Metrics Grid (Apple Liquid Glass) */}
                    <div className="grid grid-cols-2 gap-2.5 sm:hidden">
                        {/* Mobile Card 1: Capital Colocado */}
                        <div className="apple-glass-card p-3 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cap. Colocado</span>
                                <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                                    <Banknote className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {formatCurrency(stats.global.totalColocadoActive)}
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 block leading-tight">Total prestado real</span>
                            </div>
                            <div className="pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] text-[8px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                                Prom: <span className="font-bold text-zinc-800 dark:text-zinc-200">{filteredLoans.length > 0 ? formatCurrency(Math.round(stats.global.totalColocadoActive / filteredLoans.length)) : '$0'}</span>
                            </div>
                        </div>

                        {/* Mobile Card 2: Capital Pendiente */}
                        <div className="apple-glass-card p-3 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cap. Pendiente</span>
                                <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                                    <Landmark className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {formatCurrency(Math.round(stats.global.totalPrestado))}
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 block leading-tight">Por recuperar neto</span>
                            </div>
                            <div className="pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] text-[8px] font-medium text-blue-600 dark:text-blue-400 truncate">
                                Recup: <span className="font-bold">{globalRecuperadoPercent}%</span>
                            </div>
                        </div>

                        {/* Mobile Card 3: Total Colocado (con Interés) */}
                        <div className="apple-glass-card p-3 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Colocado</span>
                                <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                                    <TrendingUp className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {formatCurrency(stats.global.totalColocadoConInteres)}
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 block leading-tight">Colocado con interés</span>
                            </div>
                            <div className="pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] text-[8px] font-medium text-purple-600 dark:text-purple-400 truncate">
                                Cobrado: <span className="font-bold">{globalCobradoPercent}%</span>
                            </div>
                        </div>

                        {/* Mobile Card 4: Dinero en Calle */}
                        <div className="apple-glass-card p-3 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Dinero en Calle</span>
                                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                    <Calculator className="h-3 w-3" />
                                </div>
                            </div>
                            <div className="my-1.5">
                                <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {formatCurrency(stats.global.dineroEnCalle)}
                                </div>
                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 block leading-tight">Saldo vivo por cobrar</span>
                            </div>
                            <div className="pt-1.5 border-t border-black/[0.04] dark:border-white/[0.06] text-[8px] font-medium text-emerald-600 dark:text-emerald-400 truncate">
                                Resta: <span className="font-bold">{globalCallePercent}%</span>
                            </div>
                        </div>

                        {/* Mobile Card 5: Cartera Vencida (Horizontal Full Width Apple Liquid Glass) */}
                        <div className="col-span-2 apple-glass-card p-3 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">Cartera Vencida</span>
                                    <div className="text-sm font-bold tracking-tight text-rose-600 dark:text-rose-400">
                                        {formatCurrency(stats.global.carteraVencida)}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    0 mora • 100% al corriente
                                </span>
                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 block mt-0.5">Sin adeudos en mora</span>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Metrics Grid (Apple Liquid Glass Cards) */}
                    <div className="hidden sm:grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        {/* Capital Colocado Card */}
                        <div className="apple-glass-card p-4 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Capital Colocado</span>
                                <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                                    <Banknote className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {formatCurrency(stats.global.totalColocadoActive)}
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                    Capital real entregado en préstamos vigentes.
                                </p>
                                <div className="pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium">
                                    <span className="text-zinc-500 dark:text-zinc-400">Préstamos: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{filteredLoans.length}</strong></span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">Prom: {filteredLoans.length > 0 ? formatCurrency(Math.round(stats.global.totalColocadoActive / filteredLoans.length)) : '$0.00'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Capital Pendiente Card */}
                        <div className="apple-glass-card p-4 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Capital Pendiente</span>
                                <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-500/20 shrink-0">
                                    <Landmark className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {formatCurrency(Math.round(stats.global.totalPrestado))}
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                    Capital neto por recuperar de préstamos vigentes.
                                </p>
                                <div className="pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium">
                                    <span className="text-zinc-500 dark:text-zinc-400">Recuperado: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{formatCurrency(Math.round(globalCapitalRecuperado))}</strong></span>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">({globalRecuperadoPercent}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* Total Colocado (con Interés) Card */}
                        <div className="apple-glass-card p-4 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Colocado</span>
                                <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl border border-purple-500/20 shrink-0">
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {formatCurrency(stats.global.totalColocadoConInteres)}
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                    Total contratado a cobrar con intereses incluidos.
                                </p>
                                <div className="pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium">
                                    <span className="text-zinc-500 dark:text-zinc-400">Cobrado: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{formatCurrency(stats.global.totalCobradoActivo)}</strong></span>
                                    <span className="text-purple-600 dark:text-purple-400 font-bold">({globalCobradoPercent}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* Dinero en Calle Card */}
                        <div className="apple-glass-card p-4 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Dinero en Calle</span>
                                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0">
                                    <Calculator className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                                    {formatCurrency(stats.global.dineroEnCalle)}
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                    Saldo vivo pendiente de cobro en préstamos activos.
                                </p>
                                <div className="pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium">
                                    <span className="text-zinc-500 dark:text-zinc-400">Por cobrar: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">{formatCurrency(stats.global.dineroEnCalle)}</strong></span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">({globalCallePercent}%)</span>
                                </div>
                            </div>
                        </div>

                        {/* Cartera Vencida Card */}
                        <div className="apple-glass-card p-4 rounded-2xl flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Cartera Vencida</span>
                                <div className="p-1.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-500/20 shrink-0">
                                    <AlertCircle className="h-4 w-4" />
                                </div>
                            </div>
                            <div className="mt-2 space-y-1">
                                <div className="text-xl lg:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                                    {formatCurrency(stats.global.carteraVencida)}
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                                    Adeudo acumulado de préstamos expirados en mora.
                                </p>
                                <div className="pt-2 mt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] font-medium">
                                    <span className="text-zinc-500 dark:text-zinc-400">Préstamos Vencidos: <strong className="text-zinc-800 dark:text-zinc-200 font-bold">0</strong></span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Al corriente</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Visual Health Indicator / Progress Bar (Apple Liquid Glass) */}
                    <div className="apple-glass-card rounded-2xl p-4 shadow-xs">
                        <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-black/[0.04] dark:border-white/[0.06]">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Rendimiento de Colocación</span>
                            <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                Colocado Activo: <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(stats.global.totalColocadoActive)}</span>
                            </div>
                        </div>
                        
                        <div className="mt-3 space-y-3">
                            {/* Segmented Liquid Glass Progress Bar */}
                            <div className="h-2.5 w-full bg-zinc-200/50 dark:bg-zinc-800/60 rounded-full p-0.5 backdrop-blur-md border border-black/5 dark:border-white/5 flex overflow-hidden shadow-inner">
                                <div 
                                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                                    style={{ width: `${globalRecuperadoPercent}%` }}
                                    title={`Recuperado: ${globalRecuperadoPercent}%`}
                                />
                                <div 
                                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${globalPendientePercent}%` }}
                                    title={`Pendiente: ${globalPendientePercent}%`}
                                />
                            </div>

                            {/* Legend Bar */}
                            <div className="flex flex-col sm:flex-row gap-3 justify-between text-[10px] font-medium">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-zinc-500 dark:text-zinc-400 uppercase">Recuperado:</span>
                                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{formatCurrency(Math.round(globalCapitalRecuperado))}</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">({globalRecuperadoPercent}%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    <span className="text-zinc-500 dark:text-zinc-400 uppercase">Pendiente:</span>
                                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{formatCurrency(Math.round(stats.global.totalPrestado))}</span>
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">({globalPendientePercent}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PLAZAS */}
            {activeTab === 'plazas' && (
                <div className="space-y-3 md:space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
                    {/* Mobile Plazas View (sm:hidden Apple Liquid Glass) */}
                    <div className="sm:hidden space-y-2.5">
                        {stats.byPlaza.map(stat => {
                            const plazaCapitalRecuperado = Math.max(0, stat.totalColocadoActive - stat.totalPrestado);
                            const recPercent = stat.totalColocadoActive > 0 
                                ? Math.round((plazaCapitalRecuperado / stat.totalColocadoActive) * 100) 
                                : 0;

                            return (
                                <div 
                                    key={`mobile-${stat.plazaName}`} 
                                    className="apple-glass-card rounded-2xl overflow-hidden shadow-xs border-l-[4px]"
                                    style={{ borderLeftColor: stat.color }}
                                >
                                    <div className="p-3">
                                        {/* Header */}
                                        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full animate-pulse shrink-0" style={{ backgroundColor: stat.color }} />
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                                    {stat.plazaName}
                                                </h4>
                                            </div>
                                            <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border border-black/5 dark:border-white/10" style={{ color: stat.color, backgroundColor: `${stat.color}15` }}>
                                                Activa
                                            </span>
                                        </div>

                                        {/* 2x2 Mini Metrics (Frosted Pills) */}
                                        <div className="grid grid-cols-2 gap-2 my-2.5">
                                            <div className="apple-glass-pill p-2 rounded-xl">
                                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 uppercase block">Cap. Colocado</span>
                                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stat.totalColocadoActive)}</span>
                                            </div>
                                            <div className="apple-glass-pill p-2 rounded-xl">
                                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 uppercase block">Cap. Pendiente</span>
                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{formatCurrency(Math.round(stat.totalPrestado))}</span>
                                            </div>
                                            <div className="apple-glass-pill p-2 rounded-xl">
                                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 uppercase block">Total Colocado</span>
                                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stat.totalColocadoConInteres)}</span>
                                            </div>
                                            <div className="apple-glass-pill p-2 rounded-xl">
                                                <span className="text-[8px] font-medium text-zinc-400 dark:text-zinc-500 uppercase block">Dinero en Calle</span>
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stat.dineroEnCalle)}</span>
                                            </div>
                                        </div>

                                        {/* Plazas Mobile Sub-bar */}
                                        <div className="flex items-center justify-between text-[8px] font-medium pb-1.5 text-zinc-500 dark:text-zinc-400 uppercase">
                                            <span>Cartera Vencida:</span>
                                            <span className={stat.carteraVencida > 0 ? "text-rose-600 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                                                {stat.carteraVencida > 0 ? formatCurrency(stat.carteraVencida) : '$0.00 (Al corriente)'}
                                            </span>
                                        </div>

                                        {/* Liquid Recovery Bar */}
                                        <div className="space-y-1 pt-1">
                                            <div className="flex justify-between text-[8px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                                <span>Recuperación de Capital</span>
                                                <span className="font-bold" style={{ color: stat.color }}>{recPercent}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-zinc-200/60 dark:bg-zinc-800/60 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                                                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${recPercent}%`, backgroundColor: stat.color }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Plazas Grid (Apple Liquid Glass Cards) */}
                    <div className="hidden sm:grid gap-4 md:gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                                <div 
                                    key={stat.plazaName} 
                                    className="apple-glass-card rounded-3xl overflow-hidden shadow-xs flex flex-col justify-between"
                                    id={`plaza-card-${(stat.plazaName || '').toLowerCase().replace(/\s+/g, '-')}`}
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <Building2 className="h-20 w-20 md:h-24 md:w-24" style={{ color: stat.color }} />
                                    </div>
                                    
                                    <div>
                                        <div className="p-4 md:p-5 border-b border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between" style={{ backgroundColor: `${stat.color}08` }}>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: stat.color }} />
                                                <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                                                    {stat.plazaName}
                                                </h3>
                                            </div>
                                            <span className="text-[9px] font-semibold uppercase px-2.5 py-0.5 md:py-1 rounded-full border border-black/5 dark:border-white/10" style={{ color: stat.color, backgroundColor: `${stat.color}15` }}>
                                                Activa
                                            </span>
                                        </div>
                                        
                                        <div className="p-4 md:p-5 space-y-3">
                                            {/* Metrics list */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">Cap. Colocado:</span>
                                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stat.totalColocadoActive)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">Cap. Pendiente:</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(Math.round(stat.totalPrestado))}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">Total Colocado:</span>
                                                    <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stat.totalColocadoConInteres)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">Dinero en Calle:</span>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(stat.dineroEnCalle)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] text-zinc-400 dark:text-zinc-500 pt-1">
                                                    <span>Cobrado: <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{formatCurrency(stat.totalCobradoActivo)}</strong></span>
                                                    <span>Recup: <strong className="text-blue-600 dark:text-blue-400 font-bold">{recPercent}%</strong></span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                                                    <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Cartera Vencida:</span>
                                                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{formatCurrency(stat.carteraVencida)}</span>
                                                </div>
                                            </div>

                                            {/* Micro Progress bars */}
                                            <div className="space-y-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                                        <span>Recuperación de Capital</span>
                                                        <span className="font-bold" style={{ color: stat.color }}>{recPercent}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-200/50 dark:bg-zinc-800/60 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                                                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${recPercent}%`, backgroundColor: stat.color }} />
                                                    </div>
                                                </div>
                                                
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-[9px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                                        <span>Tasa de Morosidad</span>
                                                        <span className="font-bold text-rose-600">{cvRatio}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-zinc-200/50 dark:bg-zinc-800/60 rounded-full overflow-hidden p-0.5 border border-black/5 dark:border-white/5">
                                                        <div className="h-full bg-rose-500 rounded-full transition-all duration-300" style={{ width: `${cvRatio}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3.5 md:p-4 border-t border-black/[0.04] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] flex justify-between items-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase">
                                        <span>Colocación Activa:</span>
                                        <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatCurrency(stat.totalColocadoActive)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {stats.byPlaza.length === 0 && (
                        <div className="apple-glass-card rounded-3xl p-12 text-center text-zinc-500 dark:text-zinc-400">
                            <ShieldAlert className="h-12 w-12 mx-auto text-zinc-400/50 mb-4" />
                            <p className="font-medium text-sm">No hay plazas definidas o no hay datos de préstamos activos.</p>
                        </div>
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