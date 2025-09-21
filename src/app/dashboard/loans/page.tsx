import { getClients, getLoanPlans, getLoans, getGroups } from '@/lib/firestore-data';
import { LoansClientPage } from '@/components/loans-client-page';

export default async function LoansPageContainer() {
  const [loans, clients, loanPlans, groups] = await Promise.all([
    getLoans(),
    getClients(),
    getLoanPlans(),
    getGroups(),
  ]);

  return <LoansClientPage loans={loans} clients={clients} loanPlans={loanPlans} groups={groups} />;
}
