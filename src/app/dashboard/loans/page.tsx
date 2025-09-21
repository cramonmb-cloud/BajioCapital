import { getClients, getLoanPlans, getLoans, getGroups, getSupervisors } from '@/lib/firestore-data';
import { LoansClientPage } from '@/components/loans-client-page';

export default async function LoansPageContainer() {
  const [loans, clients, loanPlans, groups, supervisors] = await Promise.all([
    getLoans(),
    getClients(),
    getLoanPlans(),
    getGroups(),
    getSupervisors(),
  ]);

  return <LoansClientPage loans={loans} clients={clients} loanPlans={loanPlans} groups={groups} supervisors={supervisors} />;
}
