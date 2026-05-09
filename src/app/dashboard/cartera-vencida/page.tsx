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

export default async function CarteraVencidaPage() {
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
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            const baseTerm = loanPlan.termInWeeks;
            let missedCount = 0;
            let totalArrears = 0;

            // Calcular fallos reales en semanas base
            for (let i = 1; i <= baseTerm; i++) {
                const p = (loan.payments || []).find(pay => pay.weekNumber === i);
                const amountPaid = p ? p.amount : 0;
                
                if (amountPaid < weeklyPayment) {
                    const dueDate = new Date(loanStartDate);
                    dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
                    
                    // En Cartera Vencida, todas las semanas base ya pasaron
                    if (p || today > dueDate) {
                        missedCount++;
                        totalArrears += (weeklyPayment - amountPaid);
                    }
                }
            }

            const isExpired = rawCurrentLoanWeek > baseTerm;

            // REGLA DE NEGOCIO: En Cartera Vencida (Expirados), la penalización es SIEMPRE OBLIGATORIA
            const hasPenalty = true; 
            const penaltyWeekNum = baseTerm + 1;
            const pExtra = (loan.payments || []).find(pay => pay.weekNumber === penaltyWeekNum);
            const amountPaidExtra = pExtra ? pExtra.amount : 0;
            const penaltyArrear = weeklyPayment - amountPaidExtra;

            // Saldo = Suma de Arrears + Deuda Semana Extra
            const calculatedAmountDue = totalArrears + penaltyArrear;

            // 'Cartera Vencida': Préstamos EXPIRADOS con deuda
            if (isExpired && calculatedAmountDue > 0) {
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
                <h1 className="text-3xl font-bold tracking-tight">Cartera Vencida</h1>
                <p className="text-muted-foreground">
                    Préstamos expirados con saldo pendiente. La semana extra se aplica automáticamente a todos los registros.
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
