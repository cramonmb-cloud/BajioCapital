import { getClients, getLoanPlans, getActiveLoans, getPlazas, getLocalidades, getPromotoras, getAppConfig } from '@/lib/firestore-data';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { OverduePortfolioClientPage } from '@/components/overdue-portfolio-client-page';
import type { OverdueLoanDetails } from '../cartera-vencida/page';

export default async function OverduePortfolioPage() {
    const [loans, clients, loanPlans, plazas, localidades, promotoras, config] = await Promise.all([
        getActiveLoans(),
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

            // Normalización UTC para el cálculo de semanas
            const startDayUTC = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
            const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
            const rawCurrentLoanWeek = Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);
            
            let missedCount = 0;
            let totalPaidInBaseTerm = 0;
            let baseArrears = 0;

            // Calcular fallos reales y monto pagado en contrato base
            for (let i = 1; i <= baseTerm; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p && !p.isReverted) {
                    totalPaidInBaseTerm += p.amount;
                    if (p.amount < weeklyPayment) {
                        missedCount++;
                        baseArrears += (weeklyPayment - p.amount);
                    }
                } else if (i < rawCurrentLoanWeek - 1) {
                    missedCount++;
                    baseArrears += weeklyPayment;
                }
            }

            const isExpired = rawCurrentLoanWeek > baseTerm + 1;
            // REGLA DINÁMICA: Penalización solo si tiene 2+ fallos o venció debiendo del base
            const hasPenalty = (missedCount >= 2) || (isExpired && totalPaidInBaseTerm < (baseTerm * weeklyPayment));

            let penaltyArrear = 0;
            if (hasPenalty) {
                const penaltyWeekNum = baseTerm + 1;
                const pExtra = loan.payments.find(pay => pay.weekNumber === penaltyWeekNum);
                penaltyArrear = weeklyPayment - (pExtra?.amount || 0);
            }

            const calculatedTotalDue = baseArrears + penaltyArrear;

            // IMPORTANTE: En "Pagos Pendientes" mostramos préstamos vigentes o que requieren gestión activa
            // pero si ya se pusieron al corriente (missedCount < 2) y no han expirado, ya no salen aquí.
            if (!isExpired && missedCount >= 2 && calculatedTotalDue > 0) {
                return {
                    loan,
                    client,
                    loanPlan,
                    amountDue: calculatedTotalDue,
                    baseArrears,
                    penaltyArrear,
                    missedPayments: missedCount,
                    hasPenalty: true,
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
                <h1 className="text-3xl font-bold tracking-tight uppercase">Pagos Pendientes</h1>
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