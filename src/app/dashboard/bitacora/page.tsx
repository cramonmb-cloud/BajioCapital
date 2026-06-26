import { getClients, getWallet, getWalletTransactions, getUsers, getOldestLoan, getLoanPlans } from "@/lib/firestore-data";
import { BitacoraClientPage } from "@/components/bitacora-client-page";

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
    const [oldestLoan, plans, wallet, clients, users] = await Promise.all([
        getOldestLoan(),
        getLoanPlans(),
        getWallet(),
        getClients(),
        getUsers(),
    ]);

    let cutoffDate: Date | undefined = undefined;
    if (oldestLoan && oldestLoan.startDate) {
        const minTime = new Date(oldestLoan.startDate).getTime();
        if (!isNaN(minTime)) {
            const plan = plans.find(p => p.id === oldestLoan.loanPlanId);
            const termWeeks = plan ? plan.termInWeeks : 14;
            const maxMaturityTime = minTime + termWeeks * 7 * 24 * 60 * 60 * 1000;
            cutoffDate = new Date(maxMaturityTime);
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

