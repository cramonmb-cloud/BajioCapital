import { getClients, getLoanPlans, getLoans } from '@/lib/firestore-data';
import { LoansClientPage } from '@/components/loans-client-page';

export default async function LoansPageContainer() {
  const [loans, clients, loanPlans] = await Promise.all([
    getLoans(),
    getClients(),
    getLoanPlans(),
  ]);

  return <LoansClientPage loans={loans} clients={clients} loanPlans={loanPlans} />;
}
