import { getClients, getActiveLoans } from '@/lib/firestore-data';
import { ClientsClientPage } from '@/components/clients-client-page';

export default async function ClientsPage() {
  const [clients, loans] = await Promise.all([
    getClients(),
    getActiveLoans()
  ]);

  return <ClientsClientPage initialClients={clients} initialLoans={loans} />;
}
