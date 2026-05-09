'use client';

import { useState, useMemo } from 'react';
import type { Loan, LoanPlan, Client, Plaza, Localidad, Promotora } from '@/lib/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Banknote, TrendingDown, X, Calculator, Landmark, AlertCircle } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { ReportsSection } from './reports-section';
import { Separator } from './ui/separator';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import Loading from '@/app/dashboard/loading';
import { generateColorPalette } from '@/lib/utils';


interface ControlClientPageProps {
    initialClients: Client[];
    initialLoanPlans: LoanPlan[];
    initialPlazas: Plaza[];
    initialLocalidades: Localidad[];
    initialPromotoras: Promotora[];
}

// Función centralizada para detectar penalización por fallos (VIGENTES)
const checkPenalty = (loan: Loan, loanPlan: LoanPlan) => {
    const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
    let missedWeeksCount = 0;
    
    // Calculate current week to know how many past weeks to check
    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

    // Count missed payments (including non-registered past weeks)
    for (let i = 1; i < currentLoanWeek; i++) {
        const p = loan.payments.find(pay => pay.weekNumber === i);
        const amountPaid = p ? p.amount : 0;
        if (amountPaid < weeklyPayment) {
            missedWeeksCount++;
        }
    }
    
    return missedWeeksCount >= 2;
};

export function ControlClientPage({ initialClients, initialLoanPlans, initialPlazas, initialLocalidades, initialPromotoras }: ControlClientPageProps) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
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
        const statsByPlaza: Record<string, { plazaName: string; totalPrestado: number; dineroEnCalle: number; carteraVencida: number; color: string; }> = {};
        const colorPalette = generateColorPalette(plazas.length);

        plazas.forEach((plaza, index) => {
            statsByPlaza[plaza.id] = {
                plazaName: plaza.name,
                totalPrestado: 0,
                dineroEnCalle: 0,
                carteraVencida: 0,
                color: colorPalette[index],
            };
        });

        let globalTotalPrestado = 0;
        let globalDineroEnCalle = 0;
        let globalCarteraVencida = 0;

        filteredLoans.forEach(loan => {
            // Solo préstamos que no estén liquidados
            if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return;

            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            if (!localidad) return;

            const plazaId = localidad.plazaId;
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan) return;

            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const baseTerm = loanPlan.termInWeeks;

            // Calcular semana actual para detectar expiración
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            const actualTotalPaid = (loan.payments || []).reduce((sum, p) => sum + p.amount, 0);

            // DETECCIÓN DE CARTERA VENCIDA (PRÉSTAMO EXPIRADO)
            if (rawCurrentLoanWeek > baseTerm) {
                // REGLA DE ORO: En Cartera Vencida la penalización es SIEMPRE obligatoria (+1 semana)
                const totalExpectedWithPenalty = weeklyPayment * (baseTerm + 1);
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
            // Para vigentes, usamos la regla de 2+ fallos para la penalización
            const hasPenalty = checkPenalty(loan, loanPlan);
            const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
            const totalExpected = weeklyPayment * termInWeeks;

            // Para préstamos activos, calculamos lo que debería estar pagado según la semana actual
            let effectivePaidForStats = 0;
            for (let i = 1; i <= termInWeeks; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p) {
                    effectivePaidForStats += p.amount;
                } else if (i < rawCurrentLoanWeek) {
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
            }

            globalTotalPrestado += capitalPendiente;
            globalDineroEnCalle += balanceRemainingVigente;
        });

        return {
            byPlaza: Object.values(statsByPlaza),
            global: {
                totalPrestado: globalTotalPrestado,
                dineroEnCalle: globalDineroEnCalle,
                carteraVencida: globalCarteraVencida
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

    if (dataLoading) {
        return <Loading />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">Control de Cartera</h1>
                <div className="flex items-center gap-2">
                    <DatePicker date={dateRange} onDateChange={setDateRange} />
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={clearFilters}
                        disabled={!dateRange}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Quitar filtros</span>
                    </Button>
                </div>
            </div>

            {/* Global Totals */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cap. Pendiente (Vigente)</CardTitle>
                        <Landmark className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCurrency(stats.global.totalPrestado)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Capital por recuperar de préstamos en plazo.</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dinero en Calle (Vigente)</CardTitle>
                        <Calculator className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(stats.global.dineroEnCalle)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Saldo total a cobrar de préstamos activos.</p>
                    </CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cartera Vencida</CardTitle>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-destructive">{formatCurrency(stats.global.carteraVencida)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Saldo total de deuda de préstamos expirados (incl. penalización).</p>
                    </CardContent>
                </Card>
            </div>
            
            <Separator />

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 {stats.byPlaza.map(stat => (
                    <Card key={stat.plazaName} className="col-span-1 overflow-hidden rounded-lg border-2">
                        <div className="p-4 bg-muted/30 border-b">
                            <CardTitle className="text-sm font-extrabold uppercase tracking-widest text-center" style={{ color: stat.color }}>
                                {stat.plazaName}
                            </CardTitle>
                        </div>
                        <div className="grid grid-cols-1 divide-y">
                            <div className="p-4" style={{ backgroundColor: `${stat.color}08`}}>
                                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Cap. Pendiente Vigente</p>
                                <div className="text-xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.totalPrestado)}</div>
                            </div>
                            <div className="p-4" style={{ backgroundColor: `${stat.color}08`}}>
                                <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">En Calle Vigente</p>
                                <div className="text-xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.dineroEnCalle)}</div>
                            </div>
                            <div className="p-4 bg-destructive/5">
                                <p className="text-[9px] font-bold uppercase text-destructive/70 mb-1">Cartera Vencida (Plaza)</p>
                                <div className="text-xl font-bold text-destructive">{formatCurrency(stat.carteraVencida)}</div>
                            </div>
                        </div>
                    </Card>
                 ))}
                 {stats.byPlaza.length === 0 && (
                    <Card className="col-span-full">
                        <CardContent className="p-6 text-center text-muted-foreground">
                            No hay plazas definidas o no hay datos de préstamos activos.
                        </CardContent>
                    </Card>
                 )}
            </div>
            
            <Separator />

            <ReportsSection 
                loans={loans} 
                clients={clients} 
                loanPlans={loanPlans} 
                plazas={plazas} 
                localidades={localidades} 
                promotoras={promotoras} 
            />
        </div>
    );
}