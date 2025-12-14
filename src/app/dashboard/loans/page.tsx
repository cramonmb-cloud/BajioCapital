import { getClients, getLoanPlans, getLoans, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import { LoansClientPage } from '@/components/loans-client-page';

export default async function LoansPageContainer() {
  const [loans, clients, loanPlans, plazas, localidades, promotoras] = await Promise.all([
    getLoans(),
    getClients(),
    getLoanPlans(),
    getPlazas(),
    getLocalidades(),
    getPromotoras(),
  ]);

  return <LoansClientPage 
            loans={loans} 
            clients={clients} 
            loanPlans={loanPlans} 
            plazas={plazas} 
            localidades={localidades} 
            promotoras={promotoras} 
        />;
}
