import { getClients, getLoanPlans, getLoans, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { OverduePortfolioClientPage } from '@/components/overdue-portfolio-client-page';

export type OverdueLoanDetails = {
    loan: Loan;
    client: Client;
    loanPlan: LoanPlan;
    amountDue: number;
    missedPayments: number;
    hierarchy: {
        plazaId: string;
        plazaName: string;
        localidadId: string;
        localidadName: string;
        promotoraId: string;
        promotoraName: string;
    };
};

// Helper function to check if a loan has a penalty (only counting explicit failures)
const hasPenalty = (loan: Loan, currentLoanWeek: number, weeklyPayment: number) => {
    let missedWeeksCount = 0;
    for (let i = 1; i < currentLoanWeek; i++) {
        const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
        if (!paymentForWeek) continue; // Skip assumed payments

        const paidForWeek = paymentForWeek.amount;
        if (paidForWeek < weeklyPayment) {
            missedWeeksCount++;
        }
    }
    return missedWeeksCount >= 2;
};


export default async function OverduePortfolioPage() {
    const [loans, clients, loanPlans, plazas, localidades, promotoras] = await Promise.all([
        getLoans(),
        getClients(),
        getLoanPlans(),
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
    ]);

    const overdueLoansDetails: OverdueLoanDetails[] = loans
        // Check all active and overdue loans to see if they meet the criteria for being overdue now.
        .filter(loan => loan.status === 'Active' || loan.status === 'Overdue')
        .map(loan => {
            const client = clients.find(c => c.id === loan.clientId);
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            const plaza = plazas.find(p => p.id === localidad?.plazaId);

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
            
            // Calculate amount due and missed payments ONLY from explicit records
            for(let i = 1; i < currentLoanWeek; i++) { 
                if (i > termInWeeks) break;

                const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
                if (!paymentForWeek) continue; // SKIP assumed payments (not a registered failure)

                const paidForWeek = paymentForWeek.amount;

                if (paidForWeek < weeklyPayment) {
                    calculatedAmountDue += (weeklyPayment - paidForWeek);
                    missedPaymentsCount++;
                }
            }

            // Only return the loan if it actually has missed payments according to our logic
            if (missedPaymentsCount >= 2) {
                return {
                    loan,
                    client,
                    loanPlan,
                    amountDue: calculatedAmountDue,
                    missedPayments: missedPaymentsCount,
                    hierarchy: {
                        plazaId: plaza?.id || 'N/A',
                        plazaName: plaza?.name || 'N/A',
                        localidadId: localidad?.id || 'N/A',
                        localidadName: localidad?.name || 'N/A',
                        promotoraId: promotora?.id || 'N/A',
                        promotoraName: promotora?.name || 'N/A',
                    }
                };
            }
            
            return null; // This loan is not considered overdue right now
        })
        .filter((details): details is OverdueLoanDetails => details !== null && details.amountDue > 0);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Pagos Pendientes</h1>
                <p className="text-muted-foreground">
                    Clientes con préstamos que tienen 2 o más pagos fallidos registrados.
                </p>
            </div>
            <OverduePortfolioClientPage 
                initialOverdueLoans={overdueLoansDetails}
                clients={clients}
                loanPlans={loanPlans}
                plazas={plazas}
                localidades={localidades}
                promotoras={promotoras}
            />
        </div>
    );
}
