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
        // If only 'from' is selected, use it as a single day filter. 
        // If 'to' is also selected, use the full range.
        const toDate = dateRange.to ? dateRange.to : fromDate;

        return loans.filter(loan => {
            const loanStartDate = new Date(loan.startDate);
            return loanStartDate >= fromDate && loanStartDate <= toDate;
        });
    }, [loans, dateRange]);


    const stats = useMemo(() => {
        // Calculate "Total Prestado"
        const totalPrestado = filteredLoans.reduce((acc, loan) => acc + loan.amount, 0);

        // Calculate "Dinero en Calle"
        const dineroEnCalle = filteredLoans
            .filter(loan => loan.status === 'Active' || loan.status === 'Overdue')
            .reduce((totalDue, loan) => {
                const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                if (!loanPlan) return totalDue;
                
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

                return totalDue + (amountDueForLoan > 0 ? amountDueForLoan : 0);
            }, 0);

            return { totalPrestado, dineroEnCalle };
    }, [filteredLoans, loanPlans]);

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
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Prestado
                        </CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalPrestado)}</div>
                        <p className="text-xs text-muted-foreground">
                            Suma de capital inicial de préstamos en el rango.
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Dinero en Calle
                        </CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.dineroEnCalle)}</div>
                        <p className="text-xs text-muted-foreground">
                            Monto pendiente de cobrar de préstamos filtrados.
                        </p>
                    </CardContent>
                </Card>
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
