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
            const totalLoanAmount = weeklyPayment * loanPlan.termInWeeks;
            const totalPaid = loan.payments.reduce((acc, p) => acc + p.amount, 0);
            const amountDue = Math.max(0, totalLoanAmount - totalPaid);

            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            let missedPaymentsCount = 0;
            for(let i = 1; i < currentLoanWeek; i++) {
                const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
                if(!paymentForWeek || paymentForWeek.amount < weeklyPayment) {
                    missedPaymentsCount++;
                }
            }


            return {
                loan,
                client,
                loanPlan,
                amountDue,
                missedPayments: missedPaymentsCount,
            };
        })
        .filter((details): details is OverdueLoanDetails => details !== null);

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
