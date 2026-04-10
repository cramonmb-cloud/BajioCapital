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
import { Banknote, TrendingDown, X, Calculator, Landmark } from 'lucide-react';
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

// Función centralizada para detectar penalización
const checkPenalty = (loan: Loan, loanPlan: LoanPlan) => {
    const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
    let missedWeeksCount = 0;
    
    // Solo contamos fallos registrados explícitamente
    loan.payments.forEach(p => {
        if (p.weekNumber > 0 && p.amount < weeklyPayment) {
            missedWeeksCount++;
        }
    });
    
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
        const statsByPlaza: Record<string, { plazaName: string; totalPrestado: number; dineroEnCalle: number; color: string; }> = {};
        const colorPalette = generateColorPalette(plazas.length);

        plazas.forEach((plaza, index) => {
            statsByPlaza[plaza.id] = {
                plazaName: plaza.name,
                totalPrestado: 0,
                dineroEnCalle: 0,
                color: colorPalette[index],
            };
        });

        let globalTotalPrestado = 0;
        let globalDineroEnCalle = 0;

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
            const hasPenalty = checkPenalty(loan, loanPlan);
            const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);

            const totalExpected = weeklyPayment * termInWeeks;
            const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
            
            // Lógica de "Abonos Asumidos" para no inflar la deuda en el control de cartera
            // Si no se ha corrido la sincronización, los pagos asumidos cuentan como "cobrados" para fines de métricas de capital
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            const currentWeek = Math.min(rawCurrentLoanWeek, termInWeeks);

            let effectivePaid = 0;
            for (let i = 1; i <= termInWeeks; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p) {
                    effectivePaid += p.amount;
                } else if (i < currentWeek) {
                    // Semanas pasadas sin registro se consideran cobradas (asumidas)
                    effectivePaid += weeklyPayment;
                }
            }

            // Dinero en Calle Real (lo que realmente falta por cobrar según registros + futuro)
            const balanceRemaining = Math.max(0, totalExpected - effectivePaid);
            
            // Capital Pendiente (proporcional)
            const principalRatio = totalExpected > 0 ? (loan.amount / totalExpected) : 0;
            const capitalRecuperado = effectivePaid * principalRatio;
            const capitalPendiente = Math.max(0, loan.amount - capitalRecuperado);

            if (statsByPlaza[plazaId]) {
                statsByPlaza[plazaId].totalPrestado += capitalPendiente;
                statsByPlaza[plazaId].dineroEnCalle += balanceRemaining;
            }

            globalTotalPrestado += capitalPendiente;
            globalDineroEnCalle += balanceRemaining;
        });

        return {
            byPlaza: Object.values(statsByPlaza),
            global: {
                totalPrestado: globalTotalPrestado,
                dineroEnCalle: globalDineroEnCalle
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
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Capital Pendiente (Global)</CardTitle>
                        <Landmark className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCurrency(stats.global.totalPrestado)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Capital neto que falta por recuperar (estimación proporcional).</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dinero en Calle (Global)</CardTitle>
                        <Calculator className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(stats.global.dineroEnCalle)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Saldo total pendiente de cobro (Capital + Interés).</p>
                    </CardContent>
                </Card>
            </div>
            
            <Separator />

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 {stats.byPlaza.map(stat => (
                    <Card key={stat.plazaName} className="col-span-1 grid grid-cols-2 gap-px overflow-hidden rounded-lg border-2">
                        <div className="p-4" style={{ backgroundColor: `${stat.color}1A`}}>
                             <CardHeader className="p-0">
                                <CardTitle className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: stat.color }}>
                                    Cap. Pendiente ({stat.plazaName})
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 pt-2">
                                <div className="text-xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.totalPrestado)}</div>
                             </CardContent>
                        </div>
                        <div className="p-4" style={{ backgroundColor: `${stat.color}1A`}}>
                             <CardHeader className="p-0">
                                <CardTitle className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: stat.color }}>
                                    En Calle ({stat.plazaName})
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 pt-2">
                                <div className="text-xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.dineroEnCalle)}</div>
                             </CardContent>
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
