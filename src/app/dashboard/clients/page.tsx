import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getClients, getLoans } from '@/lib/firestore-data';
import Link from 'next/link';

export default async function ClientsPage() {
  const clients = await getClients();
  const loans = await getLoans();

  const getClientLoanCount = (clientId: string) => {
    return loans.filter(loan => loan.clientId === clientId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Administra tus clientes y su información.
          </p>
        </div>
        <Button disabled>
          <PlusCircle className="mr-2 h-4 w-4" />
          Registrar Cliente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            Un total de {clients.length} clientes registrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Teléfono</TableHead>
                <TableHead>Préstamos</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={client.avatarUrl} alt={client.name} />
                        <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <Link href={`/dashboard/clients/${client.id}`} className="hover:underline">
                        {client.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.email}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{client.phone}</TableCell>
                  <TableCell>{getClientLoanCount(client.id)}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/clients/${client.id}`}>Ver detalles</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
