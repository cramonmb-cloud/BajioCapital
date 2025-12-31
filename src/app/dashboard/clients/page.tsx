import { getClients, getLoans } from '@/lib/firestore-data';
import { ClientsClientPage } from '@/components/clients-client-page';

export default async function ClientsPage() {
  const [clients, loans] = await Promise.all([
    getClients(),
    getLoans()
  ]);

  return <ClientsClientPage initialClients={clients} initialLoans={loans} />;
}
