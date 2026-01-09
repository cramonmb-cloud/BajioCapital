import { getClients, getLoans, getLoanPlans, getPlazas, getLocalidades, getPromotoras } from '@/lib/firestore-data';
import { ConsultarClientePage } from '@/components/consultar-cliente-page';

export default async function ConsultarClienteContainer() {
  const [clients, loans, loanPlans, plazas, localidades, promotoras] = await Promise.all([
    getClients(),
    getLoans(),
    getLoanPlans(),
    getPlazas(),
    getLocalidades(),
    getPromotoras(),
  ]);

  return <ConsultarClientePage 
            clients={clients} 
            loans={loans} 
            loanPlans={loanPlans} 
            plazas={plazas}
            localidades={localidades}
            promotoras={promotoras}
        />;
}
