
import { getClients, getLoanPlans, getLoans } from '@/lib/firestore-data';
import type { Client, Loan, LoanPlan } from '@/lib/types';
import { OverduePortfolioClientPage } from '@/components/overdue-portfolio-client-page';

export type OverdueLoanDetails = {
    loan: Loan;
    client: Client;
    loanPlan: LoanPlan;
    amountDue: number;
    missedPayments: number;
};

// Helper function to check if a loan has a penalty
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


export default async function OverduePortfolioPage() {
    const [loans, clients, loanPlans] = await Promise.all([
        getLoans(),
        getClients(),
        getLoanPlans(),
    ]);

    const overdueLoansDetails: OverdueLoanDetails[] = loans
        .filter(loan => loan.status === 'Overdue')
        .map(loan => {
            const client = clients.find(c => c.id === loan.clientId);
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);

            if (!client || !loanPlan) {
                return null;
            }

            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            let calculatedAmountDue = 0;
            let missedPaymentsCount = 0;
            
            const loanHasPenalty = hasPenalty(loan, currentLoanWeek, weeklyPayment);
            const termInWeeks = loanPlan.termInWeeks + (loanHasPenalty ? 1 : 0);
            
            // Now, calculate amount due with the correct term
            for(let i = 1; i <= currentLoanWeek; i++) {
                if (i > termInWeeks) break; // Don't calculate past the adjusted loan term

                const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
                const paidForWeek = paymentForWeek?.amount || 0;

                if (paidForWeek < weeklyPayment) {
                    calculatedAmountDue += (weeklyPayment - paidForWeek);
                    // We count a week as "missed" if a payment was expected but not made (or made partially)
                    if (!paymentForWeek || paidForWeek < weeklyPayment) {
                       missedPaymentsCount++;
                    }
                }
            }

            return {
                loan,
                client,
                loanPlan,
                amountDue: calculatedAmountDue,
                missedPayments: missedPaymentsCount,
            };
        })
        .filter((details): details is OverdueLoanDetails => details !== null && details.amountDue > 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Cartera Vencida</h1>
                <p className="text-muted-foreground">
                    Clientes con préstamos en estado vencido que requieren atención.
                </p>
            </div>
            <OverduePortfolioClientPage 
                initialOverdueLoans={overdueLoansDetails}
                clients={clients}
                loanPlans={loanPlans}
            />
        </div>
    );
}
