import { getClients, getWallet, getWalletTransactions, getUsers, getLoans, getLoanPlans } from "@/lib/firestore-data";
import { BitacoraClientPage } from "@/components/bitacora-client-page";

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
    const [loans, plans, wallet, clients, users] = await Promise.all([
        getLoans(),
        getLoanPlans(),
        getWallet(),
        getClients(),
        getUsers(),
    ]);

    let cutoffDate: Date | undefined = undefined;
    if (loans.length > 0) {
        let minTime = Infinity;
        loans.forEach(loan => {
            if (loan.startDate) {
                const time = new Date(loan.startDate).getTime();
                if (!isNaN(time) && time < minTime) {
                    minTime = time;
                }
            }
        });

        if (minTime !== Infinity) {
            const oldestLoans = loans.filter(loan => {
                if (!loan.startDate) return false;
                return new Date(loan.startDate).getTime() === minTime;
            });

            let maxMaturityTime = 0;
            const plansMap = new Map(plans.map(p => [p.id, p]));

            oldestLoans.forEach(loan => {
                const plan = plansMap.get(loan.loanPlanId);
                const termWeeks = plan ? plan.termInWeeks : 14;
                const startTime = new Date(loan.startDate).getTime();
                const maturityTime = startTime + termWeeks * 7 * 24 * 60 * 60 * 1000;
                if (maturityTime > maxMaturityTime) {
                    maxMaturityTime = maturityTime;
                }
            });

            if (maxMaturityTime > 0) {
                cutoffDate = new Date(maxMaturityTime);
            }
        }
    }

    const transactions = await getWalletTransactions(cutoffDate);

    return (
        <BitacoraClientPage 
            wallet={wallet} 
            transactions={transactions} 
            clients={clients} 
            users={users} 
        />
    );
}

