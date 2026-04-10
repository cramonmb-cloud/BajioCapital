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
        .filter(loan => loan.status !== 'Paid Off' && loan.status !== 'Pagado desde CV')
        .map(loan => {
            const client = clients.find(c => c.id === loan.clientId);
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            const promotora = promotoras.find(p => p.id === loan.promotoraId);
            const localidad = localidades.find(l => l.id === promotora?.localidadId);
            const plaza = plazas.find(p => p.id === localidad?.plazaId);

            if (!client || !loanPlan) return null;

            const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            let missedPaymentsCount = 0;
            let totalFailureAmount = 0;
            
            // Iterate through past weeks to find registered failures
            for (let i = 1; i < currentLoanWeek; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                // Only registered records with amount < weeklyPayment count as failure
                if (p && p.amount < weeklyPayment) {
                    missedPaymentsCount++;
                    totalFailureAmount += (weeklyPayment - p.amount);
                }
            }

            const termInWeeks = loanPlan.termInWeeks + (missedPaymentsCount >= 2 ? 1 : 0);
            const isExpired = currentLoanWeek > termInWeeks;

            // 'Pagos Pendientes': Active loans (NOT expired) WITH 2 or more registered failures.
            // The amountDue shown is specifically the sum of the missing amounts from those failures.
            if (!isExpired && missedPaymentsCount >= 2) {
                return {
                    loan,
                    client,
                    loanPlan,
                    amountDue: totalFailureAmount,
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
            
            return null;
        })
        .filter((details): details is OverdueLoanDetails => details !== null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Pagos Pendientes</h1>
                <p className="text-muted-foreground">
                    Préstamos vigentes que tienen 2 o más fallos registrados. El saldo mostrado es la suma de los abonos incompletos.
                </p>
            </div>
            <OverduePortfolioClientPage 
                initialOverdueLoans={overdueLoansDetails}
                clients={clients}
                loanPlans={loanPlans}
                plazas={plazas}
                localidades={localidades}
                promotoras={promotoras}
                title="Pagos Pendientes"
            />
        </div>
    );
}
