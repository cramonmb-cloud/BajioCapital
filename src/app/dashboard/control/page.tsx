import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getLoans, getLoanPlans } from '@/lib/firestore-data';
import type { Loan, LoanPlan } from '@/lib/types';
import { Banknote, TrendingDown } from 'lucide-react';

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


export default async function ControlPage() {
    const [loans, loanPlans] = await Promise.all([
        getLoans(),
        getLoanPlans()
    ]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    // Calculate "Total Prestado"
    const totalPrestado = loans.reduce((acc, loan) => acc + loan.amount, 0);

    // Calculate "Dinero en Calle"
    const dineroEnCalle = loans
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


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Control y Estadísticas</h1>
                <p className="text-muted-foreground">
                    Métricas clave sobre la salud financiera de tus préstamos.
                </p>
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
                        <div className="text-2xl font-bold">{formatCurrency(totalPrestado)}</div>
                        <p className="text-xs text-muted-foreground">
                            Suma total del capital inicial de todos los préstamos.
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
                        <div className="text-2xl font-bold">{formatCurrency(dineroEnCalle)}</div>
                        <p className="text-xs text-muted-foreground">
                            Monto total pendiente de cobrar de préstamos activos.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
