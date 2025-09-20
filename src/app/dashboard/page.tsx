import {
  Card,
  CardContent,
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
import { Badge } from '@/components/ui/badge';
import { getClients, getLoans, getLoanPlans } from '@/lib/firestore-data';
import { Users, Landmark, Banknote, ArrowRight, Database, TrendingUp, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { seedDatabaseAction } from './seed-actions';
import type { Loan } from '@/lib/types';


export default async function DashboardPage() {
  const [clients, loans, loanPlans] = await Promise.all([
    getClients(),
    getLoans(),
    getLoanPlans()
  ]);

  const totalClients = clients.length;
  const activeLoans = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
  const totalLoaned = loans.reduce((acc, loan) => acc + loan.amount, 0);

  const overdueLoans = loans.filter((loan) => loan.status === 'Overdue');

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || 'N/A';
  }

  const getPlanName = (planId: string) => {
    return loanPlans.find(p => p.id === planId)?.name || 'N/A';
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const translateStatus = (status: Loan['status']) => {
    switch (status) {
      case 'Active':
        return 'Activo';
      case 'Overdue':
        return 'Vencido';
      case 'Paid Off':
        return 'Pagado';
      default:
        return status;
    }
  };
  
  // Weekly report logic
  const getSaturdayOfWeek = (d: Date) => {
    const date = new Date(d);
    date.setUTCHours(0, 0, 0, 0);
    const day = date.getUTCDay();
    const diff = day === 0 ? -1 : 6 - day;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  };
  
  const currentSaturday = getSaturdayOfWeek(new Date());
  const weekStart = new Date(currentSaturday);
  weekStart.setUTCDate(currentSaturday.getUTCDate() - 6);

  let totalCollectedThisWeek = 0;
  let totalPaymentsThisWeek = 0;

  loans.forEach(loan => {
    loan.payments.forEach(payment => {
      const paymentDate = new Date(payment.date);
      if (paymentDate >= weekStart && paymentDate <= currentSaturday) {
        totalCollectedThisWeek += payment.amount;
        totalPaymentsThisWeek += 1;
      }
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <form action={seedDatabaseAction}>
            <Button variant="outline" type="submit">
                <Database className="mr-2 h-4 w-4" />
                Cargar Datos de Ejemplo
            </Button>
        </form>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cobranza de la Semana
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCollectedThisWeek)}</div>
            <p className="text-xs text-muted-foreground">
              Total recaudado en la semana actual
            </p>
          </CardContent>
        </Card>
         <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Abonos de la Semana
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalPaymentsThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Pagos registrados en la semana
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClients}</div>
            <p className="text-xs text-muted-foreground">
              Clientes registrados en el sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Préstamos Activos
            </CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeLoans}</div>
            <p className="text-xs text-muted-foreground">
              Préstamos actualmente en curso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prestado</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalLoaned)}</div>
            <p className="text-xs text-muted-foreground">
              Suma total de todos los préstamos
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Préstamos Vencidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdueLoans.length > 0 ? (
                overdueLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getClientName(loan.clientId)}</TableCell>
                    <TableCell>{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{getPlanName(loan.loanPlanId)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{translateStatus(loan.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/clients/${loan.clientId}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No hay préstamos vencidos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
