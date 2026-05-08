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

export default async function CarteraVencidaPage() {
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
            
            // Detect failures: A failure is any past week with amount < weeklyPayment (including NO record)
            let missedPaymentsCount = 0;
            for (let i = 1; i < currentLoanWeek; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                const amountPaid = p ? p.amount : 0;
                if (amountPaid < weeklyPayment) missedPaymentsCount++;
            }

            const hasPenalty = missedPaymentsCount >= 2;
            const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);
            
            // Is expired if we passed the base term AND any penalty week
            const isExpired = currentLoanWeek > termInWeeks;

            const totalToPay = weeklyPayment * termInWeeks;
            const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
            const balance = totalToPay - totalPaid;

            // 'Cartera Vencida': Loans that HAVE reached maturity and STILL have a balance > 0
            if (isExpired && balance > 0) {
                return {
                    loan,
                    client,
                    loanPlan,
                    amountDue: balance,
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
                <h1 className="text-3xl font-bold tracking-tight">Cartera Vencida</h1>
                <p className="text-muted-foreground">
                    Préstamos que han superado su fecha de vencimiento y aún tienen saldo pendiente.
                </p>
            </div>
            <OverduePortfolioClientPage 
                initialOverdueLoans={overdueLoansDetails}
                clients={clients}
                loanPlans={loanPlans}
                plazas={plazas}
                localidades={localidades}
                promotoras={promotoras}
                title="Cartera Vencida"
            />
        </div>
    );
}
