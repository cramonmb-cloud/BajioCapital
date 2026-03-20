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

// This function calculates if a loan has a penalty (only counting explicit failures)
const hasPenalty = (loan: Loan, currentLoanWeek: number, weeklyPayment: number) => {
    let missedWeeksCount = 0;
    for (let i = 1; i < currentLoanWeek; i++) {
        const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
        if (!paymentForWeek) continue; // SKIP assumed payments

        const paidForWeek = paymentForWeek.amount;
        if (paidForWeek < weeklyPayment) {
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
            // ONLY consider Active or Overdue loans for these metrics
            if (loan.status !== 'Active' && loan.status !== 'Overdue') return;

            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            if (!localidad) return;

            const plazaId = localidad.plazaId;
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan) return;

            // Revised logic for meaningful comparison:
            // "Cap. Activo" should represent the REMAINING principal to be recovered.
            // "En Calle" represents the total REMAINING balance (principal + interest).
            
            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            const loanHasPenalty = hasPenalty(loan, currentLoanWeek, weeklyPayment);
            const termInWeeks = loanPlan.termInWeeks + (loanHasPenalty ? 1 : 0);

            const totalAmountToBePaid = weeklyPayment * termInWeeks;
            const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
            
            // Calculate how much of the paid amount is "Capital" vs "Interest"
            // based on the ratio of the original loan to the total expected payout.
            const principalRatio = totalAmountToBePaid > 0 ? (loan.amount / totalAmountToBePaid) : 0;
            const capitalRecuperado = totalPaid * principalRatio;
            const capitalPendiente = loan.amount - capitalRecuperado;
            
            const balanceRemaining = totalAmountToBePaid - totalPaid;

            if (statsByPlaza[plazaId]) {
                statsByPlaza[plazaId].totalPrestado += (capitalPendiente > 0 ? capitalPendiente : 0);
                statsByPlaza[plazaId].dineroEnCalle += (balanceRemaining > 0 ? balanceRemaining : 0);
            }

            globalTotalPrestado += (capitalPendiente > 0 ? capitalPendiente : 0);
            globalDineroEnCalle += (balanceRemaining > 0 ? balanceRemaining : 0);
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
                        <p className="text-xs text-muted-foreground mt-1">Capital que falta por recuperar de los préstamos vigentes.</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Dinero en Calle (Global)</CardTitle>
                        <Calculator className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(stats.global.dineroEnCalle)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Suma de abonos restantes por cobrar (incluye intereses).</p>
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
                            No hay plazas definidas o no hay datos de préstamos activos en el rango de fechas seleccionado.
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
