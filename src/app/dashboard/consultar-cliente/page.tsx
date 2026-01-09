import { getClients, getLoans, getLoanPlans } from '@/lib/firestore-data';
import { ConsultarClientePage } from '@/components/consultar-cliente-page';

export default async function ConsultarClienteContainer() {
  const [clients, loans, loanPlans] = await Promise.all([
    getClients(),
    getLoans(),
    getLoanPlans(),
  ]);

  return <ConsultarClientePage clients={clients} loans={loans} loanPlans={loanPlans} />;
}
