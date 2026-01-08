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
import { Banknote, TrendingDown, X } from 'lucide-react';
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

// This function calculates if a loan has a penalty
const hasPenalty = (loan: Loan, currentLoanWeek: number, weeklyPayment: number) => {
    let missedWeeksCount = 0;
    for (let i = 1; i < currentLoanWeek; i++) {
        const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
        const paidForWeek = paymentForWeek?.amount || 0;
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


    const plazaStats = useMemo(() => {
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

        filteredLoans.forEach(loan => {
            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            if (!localidad) return;

            const plazaId = localidad.plazaId;
            if (statsByPlaza[plazaId]) {
                // Add to Total Prestado
                statsByPlaza[plazaId].totalPrestado += loan.amount;

                // Calculate and add to Dinero en Calle
                if (loan.status === 'Active' || loan.status === 'Overdue') {
                    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                    if (!loanPlan) return;
                    
                    const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
                    const today = new Date();
                    const loanStartDate = new Date(loan.startDate);
                    const timeDiff = today.getTime() - loanStartDate.getTime();
                    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
                    const loanHasPenalty = hasPenalty(loan, currentLoanWeek, weeklyPayment);
                    const termInWeeks = loanPlan.termInWeeks + (loanHasPenalty ? 1 : 0);

                    const totalAmountToBePaid = weeklyPayment * termInWeeks;
                    const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
                    const amountDueForLoan = totalAmountToBePaid - totalPaid;

                    if (amountDueForLoan > 0) {
                        statsByPlaza[plazaId].dineroEnCalle += amountDueForLoan;
                    }
                }
            }
        });

        return Object.values(statsByPlaza);

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
            <div className="flex justify-end gap-4">
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
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 {plazaStats.map(stat => (
                    <Card key={stat.plazaName} className="col-span-1 grid grid-cols-2 gap-px overflow-hidden rounded-lg">
                        <div className="p-4" style={{ backgroundColor: `${stat.color}1A`}}>
                             <CardHeader className="p-0">
                                <CardTitle className="text-sm font-medium" style={{ color: stat.color }}>
                                    Total Prestado ({stat.plazaName})
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 pt-2">
                                <div className="text-2xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.totalPrestado)}</div>
                             </CardContent>
                        </div>
                        <div className="p-4" style={{ backgroundColor: `${stat.color}1A`}}>
                             <CardHeader className="p-0">
                                <CardTitle className="text-sm font-medium" style={{ color: stat.color }}>
                                    Dinero en Calle ({stat.plazaName})
                                </CardTitle>
                             </CardHeader>
                             <CardContent className="p-0 pt-2">
                                <div className="text-2xl font-bold" style={{ color: stat.color }}>{formatCurrency(stat.dineroEnCalle)}</div>
                             </CardContent>
                        </div>
                    </Card>
                 ))}
                 {plazaStats.length === 0 && (
                    <Card className="col-span-full">
                        <CardContent className="p-6 text-center text-muted-foreground">
                            No hay plazas definidas o no hay datos de préstamos en el rango de fechas seleccionado.
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
