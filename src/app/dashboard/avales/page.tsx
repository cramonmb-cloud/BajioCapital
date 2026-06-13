import { getClients, getLoans, getLoanPlans } from '@/lib/firestore-data';
import { AvalesClientPage } from '@/components/avales-client-page';

export default async function AvalesPage() {
  const [clients, loans, plans] = await Promise.all([
    getClients(),
    getLoans(),
    getLoanPlans()
  ]);

  return <AvalesClientPage initialClients={clients} initialLoans={loans} initialPlans={plans} />;
}
