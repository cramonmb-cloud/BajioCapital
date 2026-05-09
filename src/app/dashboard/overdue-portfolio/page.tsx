import { getClients, getLoanPlans, getLoans, getPlazas, getLocalidades, getPromotoras, getAppConfig } from '@/lib/firestore-data';
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
    const [loans, clients, loanPlans, plazas, localidades, promotoras, config] = await Promise.all([
        getLoans(),
        getClients(),
        getLoanPlans(),
        getPlazas(),
        getLocalidades(),
        getPromotoras(),
        getAppConfig(),
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
            const baseTerm = loanPlan.termInWeeks;
            
            let missedCount = 0;
            let totalArrears = 0;

            // Calcular fallos reales en semanas base
            for (let i = 1; i <= baseTerm; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                const amountPaid = p ? p.amount : 0;
                
                if (amountPaid < weeklyPayment) {
                    const dueDate = new Date(loanStartDate);
                    dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
                    
                    if (p || today > dueDate) {
                        missedCount++;
                        totalArrears += (weeklyPayment - amountPaid);
                    }
                }
            }

            // REGLA: Si tiene 2 o más fallos se activa la penalización
            const hasPenalty = missedCount >= 2;
            let penaltyArrear = 0;
            if (hasPenalty) {
                const penaltyWeekNum = baseTerm + 1;
                const pExtra = loan.payments.find(pay => pay.weekNumber === penaltyWeekNum);
                penaltyArrear = weeklyPayment - (pExtra?.amount || 0);
            }

            // Saldo Final = Arrears base + Arrear de penalización
            const calculatedAmountDue = totalArrears + penaltyArrear;

            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            const termWithPenalty = baseTerm + (hasPenalty ? 1 : 0);
            const isExpired = rawCurrentLoanWeek > termWithPenalty;

            // REGLA DE FILTRO: Solo vigente con 2+ fallos y saldo pendiente
            if (!isExpired && missedCount >= 2 && calculatedAmountDue > 0) {
                return {
                    loan,
                    client,
                    loanPlan,
                    amountDue: calculatedAmountDue,
                    missedPayments: missedCount,
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
                    Préstamos vigentes con 2 o más fallos. Se incluye cobro de semana extra.
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
