
import { getClients, getLoanPlans, getLoans, getPlazas, getLocalidades, getPromotoras, getAppConfig } from '@/lib/firestore-data';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { OverduePortfolioClientPage } from '@/components/overdue-portfolio-client-page';

export type OverdueLoanDetails = {
    loan: Loan;
    client: Client;
    loanPlan: LoanPlan;
    amountDue: number; // TOTAL FINAL
    baseArrears: number; // Solo Fallos base
    penaltyArrear: number; // Solo S. Extra
    missedPayments: number;
    hasPenalty: boolean;
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
            const baseTerm = loanPlan.termInWeeks;
            
            // Normalización UTC para el cálculo de expiración
            const startDayUTC = new Date(Date.UTC(loanStartDate.getUTCFullYear(), loanStartDate.getUTCMonth(), loanStartDate.getUTCDate()));
            const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
            const daysDiff = Math.round((todayUTC.getTime() - startDayUTC.getTime()) / (1000 * 3600 * 24));
            
            const rawCurrentLoanWeek = Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);
            
            // CARTERA VENCIDA: Préstamo expirado (supera plazo base)
            if (rawCurrentLoanWeek <= baseTerm) return null;

            const totalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);
            
            // REGLA DE ORO: En Cartera Vencida la penalización es SIEMPRE obligatoria
            const hasPenalty = true;
            const totalExpected = (baseTerm + 1) * weeklyPayment;
            const totalDue = Math.max(0, totalExpected - totalPaid);

            if (totalDue <= 0) return null;

            // Cálculo en cascada para el desglose visual
            const baseArrears = Math.max(0, (baseTerm * weeklyPayment) - totalPaid);
            const penaltyArrear = totalDue - baseArrears;

            // Conteo de fallos reales para el reporte
            let missedCount = 0;
            for (let i = 1; i <= baseTerm; i++) {
                const p = (loan.payments || []).find(pay => pay.weekNumber === i);
                if (!p || p.amount < weeklyPayment) missedCount++;
            }

            return {
                loan,
                client,
                loanPlan,
                amountDue: totalDue,
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
        })
        .filter((details): details is OverdueLoanDetails => details !== null);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-red-700 uppercase">Cartera Vencida</h1>
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
