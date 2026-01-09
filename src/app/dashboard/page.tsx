
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
import { getClients, getLoans, getLoanPlans, getAppConfig } from '@/lib/firestore-data';
import { Users, Landmark, Banknote, ArrowRight, TrendingUp, Receipt, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { seedDatabaseAction } from './seed-actions';
import type { Loan } from '@/lib/types';
import Image from 'next/image';


export default async function DashboardPage() {
  const [clients, loans, loanPlans, config] = await Promise.all([
    getClients(),
    getLoans(),
    getLoanPlans(),
    getAppConfig()
  ]);

  const logoUrl = config?.logoUrl;

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
      case 'Pagado desde CV':
        return 'Pagado desde CV';
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

  // Logic for "Clientes con Fallos"
  const clientsWithFailures = loans
    .filter(loan => loan.status === 'Active' || loan.status === 'Overdue')
    .reduce((acc, loan) => {
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        if (!loanPlan) return acc;

        const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
        const today = new Date();
        const loanStartDate = new Date(loan.startDate);
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

        let totalFailures = 0;
        let totalFailureAmount = 0;

        for (let i = 1; i < currentLoanWeek; i++) {
            const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
            const paidAmount = paymentForWeek?.amount || 0;
            
            if (paidAmount < weeklyPayment) {
                totalFailures += 1;
                totalFailureAmount += (weeklyPayment - paidAmount);
            }
        }
        
        if (totalFailures > 0) {
            if (!acc[loan.clientId]) {
                acc[loan.clientId] = {
                    clientId: loan.clientId,
                    clientName: getClientName(loan.clientId),
                    totalFailures: 0,
                    totalFailureAmount: 0,
                };
            }
            acc[loan.clientId].totalFailures += totalFailures;
            acc[loan.clientId].totalFailureAmount += totalFailureAmount;
        }

        return acc;
    }, {} as Record<string, { clientId: string, clientName: string, totalFailures: number, totalFailureAmount: number }>);
    
    const failuresList = Object.values(clientsWithFailures);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {/* Title removed to save space */}
      </div>

      {logoUrl && (
        <div className="flex justify-center">
            <div className="w-48 h-48 flex items-center justify-center p-4">
                <div className="relative w-full h-full">
                    <Image 
                        src={logoUrl} 
                        alt="Logo de la aplicación" 
                        layout="fill"
                        objectFit="contain"
                        className="rounded-lg border"
                    />
                </div>
            </div>
        </div>
      )}
      
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
          <CardTitle>Clientes con Fallos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Semanas con Fallo</TableHead>
                <TableHead>Monto del Fallo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {failuresList.length > 0 ? (
                failuresList.map((item) => (
                  <TableRow key={item.clientId}>
                    <TableCell className="font-medium">{item.clientName}</TableCell>
                    <TableCell className="text-center">
                        <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3"/> 
                            {item.totalFailures}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-destructive">{formatCurrency(item.totalFailureAmount)}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="ghost" size="icon">
                        <Link href={`/dashboard/clients/${item.clientId}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No hay clientes con fallos en sus pagos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                        <Link href="/dashboard/overdue-portfolio">
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
