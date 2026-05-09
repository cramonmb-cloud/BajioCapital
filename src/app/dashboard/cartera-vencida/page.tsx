import { getClients, getLoanPlans, getLoans, getPlazas, getLocalidades, getPromotoras, getAppConfig } from '@/lib/firestore-data';
import type { Client, Loan, LoanPlan, Plaza, Localidad, Promotora } from '@/lib/types';
import { OverduePortfolioClientPage } from '@/components/overdue-portfolio-client-page';

export type OverdueLoanDetails = {
    loan: Loan;
    client: Client;
    loanPlan: LoanPlan;
    amountDue: number; // TOTAL FINAL (Fallos + S. Extra)
    baseArrears: number; // Solo Fallos
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
            
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
            
            // REGLA CARTERA VENCIDA: Si la semana actual supera el plazo base, está vencido
            const isExpired = rawCurrentLoanWeek > baseTerm;

            if (!isExpired) return null;

            let missedCount = 0;
            let baseArrears = 0;

            // 1. Calcular deuda de semanas base (1 a baseTerm)
            for (let i = 1; i <= baseTerm; i++) {
                const p = (loan.payments || []).find(pay => pay.weekNumber === i);
                const amountPaid = p ? p.amount : 0;
                
                if (amountPaid < weeklyPayment) {
                    missedCount++;
                    baseArrears += (weeklyPayment - amountPaid);
                }
            }

            // REGLA CARTERA VENCIDA: La semana extra es OBLIGATORIA al 100%
            const hasPenalty = true; 
            const penaltyWeekNum = baseTerm + 1;
            const pExtra = (loan.payments || []).find(pay => pay.weekNumber === penaltyWeekNum);
            const penaltyArrear = weeklyPayment - (pExtra?.amount || 0);

            // EL TOTAL ES LA SUMA MATEMÁTICA REAL DE AMBOS
            const calculatedTotalDue = baseArrears + penaltyArrear;

            // Mostrar solo si tiene deuda real pendiente
            if (calculatedTotalDue > 0) {
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
                <h1 className="text-3xl font-bold tracking-tight text-red-700 uppercase">Cartera Vencida</h1>
                <p className="text-muted-foreground font-bold">
                    Préstamos expirados. Cobro OBLIGATORIO de semana extra por vencimiento.
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
