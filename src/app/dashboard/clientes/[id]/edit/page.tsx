import { notFound } from 'next/navigation';
import { getClient } from '@/lib/firestore-data';
import { ClientForm } from '@/components/client-form';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getClient(id);

  if (!client) {
    notFound();
  }

  return (
    <div className="space-y-6">
       <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Cliente</h1>
          <p className="text-muted-foreground">
            Modifica la información de {client.name}.
          </p>
        </div>
      <ClientForm client={client} />
    </div>
  );
}
