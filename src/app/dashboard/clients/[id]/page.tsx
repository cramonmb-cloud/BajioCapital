import { notFound } from 'next/navigation';
import { getClient, getLoansByClientId, getLoanPlans } from '@/lib/firestore-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Phone, Home, Shield, UserCheck } from 'lucide-react';
import type { Loan } from '@/lib/types';


export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const client = await getClient(params.id);
  
  if (!client) {
    notFound();
  }

  const [clientLoans, loanPlans] = await Promise.all([
      getLoansByClientId(client.id),
      getLoanPlans()
  ]);

  const getPlanName = (planId: string) => {
    return loanPlans.find(p => p.id === planId)?.name || 'N/A';
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      // Adjust for timezone offset to show the correct local date
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  };

  const translateStatus = (status: Loan['status']) => {
    switch (status) {
      case 'Active':
        return 'Activo';
      case 'Overdue':
        return 'Vencido';
      case 'Paid Off':
        return 'Pagado';
      case 'Pagado desde CV':
        return 'Pagado desde CV';
      default:
        return status;
    }
  };
  
  const getStatusVariant = (status: Loan['status']): 'destructive' | 'success' | 'default' | 'purple' => {
    switch (status) {
        case 'Overdue':
            return 'destructive';
        case 'Paid Off':
            return 'success';
        case 'Pagado desde CV':
            return 'purple';
        default:
            return 'default';
    }
  };
  
  const fullAddress = `${client.street}, ${client.neighborhood}, C.P. ${client.postalCode}, ${client.city}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Avatar className="h-20 w-20 border">
          <AvatarImage src={client.avatarUrl} alt={client.name} />
          <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-muted-foreground">ID de Cliente: {client.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Préstamos del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Monto</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Fecha del Préstamo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientLoans.length > 0 ? (
                    clientLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>{formatCurrency(loan.amount)}</TableCell>
                      <TableCell>{getPlanName(loan.loanPlanId)}</TableCell>
                      <TableCell>{formatDate(loan.startDate)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(loan.status)}>{translateStatus(loan.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))) : (
                    <TableRow>
                        <TableCell colSpan={4} className="text-center">No hay préstamos para este cliente.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          
        </div>

        <div className="space-y-6">
           <Card>
            <CardHeader>
              <CardTitle>Información de Contacto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
               <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Email</span>
                    <p className="text-muted-foreground">{client.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Teléfono</span>
                    <p className="text-muted-foreground">{client.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Home className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Dirección</span>
                    <p className="text-muted-foreground">{fullAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Garantías y Avales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
               <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Garantía</span>
                    <p className="text-muted-foreground">{client.guarantee}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UserCheck className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                    <span className="font-medium">Aval</span>
                    <p className="text-muted-foreground">{client.endorsement}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
