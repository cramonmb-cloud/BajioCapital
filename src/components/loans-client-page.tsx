'use client';

import { useState } from 'react';
import { MoreHorizontal, CheckCircle2, XCircle, Circle, AlertCircle, TrendingUp, Receipt } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { CreateLoanDialog } from '@/components/create-loan-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client, Loan, LoanPlan, Payment } from '@/lib/types';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { useRouter } from 'next/navigation';


// Helper to get the Saturday of the week for a given date
// A week runs from Sunday to Saturday. Any day in that range belongs to that Saturday's week.
const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0); // Normalize time
  const day = date.getUTCDay(); // Sunday = 0, Saturday = 6
  // If it's Sunday, we want the previous saturday. Otherwise, find the upcoming one.
  const diff = day === 0 ? -1 : 6 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
};

interface LoansClientPageProps {
    loans: Loan[];
    clients: Client[];
    loanPlans: LoanPlan[];
}

export function LoansClientPage({ loans, clients, loanPlans }: LoansClientPageProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<Loan | null>(null);
  const [selectedWeekForPayment, setSelectedWeekForPayment] = useState<{ weekNumber: number; weekDate: Date} | null>(null);
  const router = useRouter();

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'N/A';
  const getWeeklyPayment = (loanPlanId: string) => loanPlans.find(p => p.id === loanPlanId)?.weeklyPayment || 0;
  
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

  // Get unique weeks (represented by Saturday's date string) from all loans
  const loanWeeks = Array.from(
    new Set(loans.map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString()))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort descending

  // Set the most recent week as the default selected week if none is selected
  if (!selectedWeek && loanWeeks.length > 0) {
      setSelectedWeek(loanWeeks[0]);
  }
  
  const filteredLoans = selectedWeek 
    ? loans.filter(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString() === selectedWeek)
    : [];

  const getWeekPaymentStatus = (loan: Loan, weekNumber: number) => {
    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0 };

    // The loan's official start date is a Saturday.
    const loanStartDate = new Date(loan.startDate);
    
    // The first payment is due on the *next* Saturday.
    const firstPaymentDueDate = new Date(loanStartDate);
    firstPaymentDueDate.setUTCDate(loanStartDate.getUTCDate() + 7);

    // Calculate the start and end of the specific payment week
    const weekStartDate = new Date(firstPaymentDueDate);
    weekStartDate.setUTCDate(firstPaymentDueDate.getUTCDate() + (weekNumber - 1) * 7 - 6); // Week starts on Sunday
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6); // Week ends on Saturday

    const paymentsForWeek = loan.payments.filter(p => {
        const paymentDate = new Date(p.date);
        return paymentDate >= weekStartDate && paymentDate <= weekEndDate;
    });

    const totalPaidForWeek = paymentsForWeek.reduce((sum, p) => sum + p.amount, 0);

    const isFuture = new Date() < weekStartDate;
    
    if (isFuture) {
      return { status: 'pending' as const, date: weekStartDate, amountPaid: 0 };
    }

    if (totalPaidForWeek > 0) {
        if(totalPaidForWeek >= loanPlan.weeklyPayment) {
            return { status: 'paid' as const, date: weekStartDate, amountPaid: totalPaidForWeek };
        } else {
            return { status: 'partial' as const, date: weekStartDate, amountPaid: totalPaidForWeek };
        }
    } else {
        return { status: 'missed' as const, date: weekStartDate, amountPaid: 0 };
    }
  };
  
  const handleRegisterPaymentClick = (loan: Loan, weekNumber: number, weekDate: Date) => {
      setSelectedLoanForPayment(loan);
      setSelectedWeekForPayment({ weekNumber, weekDate });
      setPaymentDialogOpen(true);
  }

  // Report calculations for the selected week
  let totalCollectedThisWeek = 0;
  let totalPaymentsThisWeek = 0;
  if(selectedWeek) {
    const selectedSaturday = new Date(selectedWeek);
    const weekStart = new Date(selectedSaturday);
    weekStart.setUTCDate(selectedSaturday.getUTCDate() - 6);

    loans.forEach(loan => {
        loan.payments.forEach(payment => {
            const paymentDate = new Date(payment.date);
            if (paymentDate >= weekStart && paymentDate <= selectedSaturday) {
                totalCollectedThisWeek += payment.amount;
                totalPaymentsThisWeek += 1;
            }
        })
    })
  }


  return (
    <>
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Préstamos</h1>
          <p className="text-muted-foreground">
            Visualiza y administra todos los préstamos por semana.
          </p>
        </div>
        <CreateLoanDialog clients={clients} loanPlans={loanPlans} loans={loans}/>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              Total cobrado en la semana seleccionada
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Abonos Registrados
            </CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{totalPaymentsThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Pagos registrados en la semana seleccionada
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {/* Weeks List */}
        <Card>
            <CardHeader className="p-2 pt-4">
                <CardTitle className="text-base">Semanas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="space-y-1 px-2 pb-2">
                    {loanWeeks.map((week) => (
                        <Button 
                            key={week}
                            variant={selectedWeek === week ? 'secondary' : 'ghost'}
                            className="w-full justify-start h-8 px-2 text-xs"
                            onClick={() => setSelectedWeek(week)}
                        >
                            {formatDate(week)}
                        </Button>
                    ))}
                    {loanWeeks.length === 0 && <p className="text-sm text-muted-foreground text-center p-4">No hay préstamos.</p>}
                </div>
            </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardHeader className="p-2 pt-4">
            <CardTitle>Préstamos de la Semana</CardTitle>
            <CardDescription>
              {`Mostrando ${filteredLoans.length} préstamos para la semana del ${selectedWeek ? formatDate(selectedWeek) : 'N/A'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TooltipProvider>
              <ScrollArea className="w-full whitespace-nowrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 w-[200px] p-2">Cliente</TableHead>
                      <TableHead className="p-2">Abono Semanal</TableHead>
                      <TableHead className="p-2">Estado</TableHead>
                      {Array.from({ length: 14 }, (_, i) => (
                        <TableHead key={i} className="text-center p-2">{`S${i + 1}`}</TableHead>
                      ))}
                      <TableHead className="text-right sticky right-0 bg-card z-10 p-2">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.length > 0 ? (
                      filteredLoans.map((loan) => {
                        const weeklyPayment = getWeeklyPayment(loan.loanPlanId);
                        
                        // Determine the current week number to pay
                        let currentPaymentWeekNumber = -1;
                        if (loan.status !== 'Paid Off') {
                            const statuses = Array.from({length: 14}, (_, i) => getWeekPaymentStatus(loan, i + 1));
                            const firstUnpaidIndex = statuses.findIndex(s => s.status === 'missed' || s.status === 'partial');
                            
                            if (firstUnpaidIndex !== -1) {
                                currentPaymentWeekNumber = firstUnpaidIndex + 1;
                            } else {
                                const firstPendingIndex = statuses.findIndex(s => s.status === 'pending');
                                if (firstPendingIndex !== -1) {
                                    const firstPendingStatus = statuses[firstPendingIndex];
                                    // Check if the pending week has started
                                    if(new Date() >= firstPendingStatus.date) {
                                        currentPaymentWeekNumber = firstPendingIndex + 1;
                                    }
                                }
                            }
                        }

                        return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium sticky left-0 bg-card z-10 w-[200px] p-2">
                            <Link href={`/dashboard/clients/${loan.clientId}`} className="hover:underline">
                              {getClientName(loan.clientId)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-2">{formatCurrency(weeklyPayment)}</TableCell>
                          <TableCell className="p-2">
                            <Badge variant={loan.status === 'Paid Off' ? 'secondary' : loan.status === 'Overdue' ? 'destructive' : 'default'}>{loan.status}</Badge>
                          </TableCell>
                          {Array.from({ length: 14 }, (_, i) => {
                            const weekStatus = getWeekPaymentStatus(loan, i + 1);
                            // Allow registering payment if the week is not fully paid and not in the future (unless it's the very first pending week)
                            const isPastOrPresent = new Date() >= weekStatus.date;
                            const canRegisterPayment = loan.status !== 'Paid Off' && isPastOrPresent && weekStatus.status !== 'paid';

                            let statusInfo;
                            switch(weekStatus.status) {
                                case 'paid':
                                    statusInfo = { icon: <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />, text: 'Pagado', paid: `Abono: ${formatCurrency(weekStatus.amountPaid)}` };
                                    break;
                                case 'partial':
                                    statusInfo = { icon: <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />, text: 'Pago Parcial', paid: `Abono: ${formatCurrency(weekStatus.amountPaid)}` };
                                    break;
                                case 'missed':
                                    statusInfo = { icon: <XCircle className="h-4 w-4 text-red-500 mx-auto" />, text: 'Atrasado' };
                                    break;
                                default:
                                    statusInfo = { icon: <Circle className="h-4 w-4 text-muted-foreground mx-auto" />, text: 'Pendiente' };
                            }
                            
                            return (
                                <TableCell key={i} className="text-center p-2">
                                     <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button 
                                                className="w-full disabled:cursor-not-allowed"
                                                disabled={!canRegisterPayment}
                                                onClick={(e) => {
                                                  if(canRegisterPayment) {
                                                    e.stopPropagation();
                                                    handleRegisterPaymentClick(loan, i + 1, weekStatus.date);
                                                  }
                                                }}
                                            >
                                                {statusInfo.icon}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Semana {i + 1} ({formatDate(weekStatus.date.toISOString())})</p>
                                            <p>Estado: {statusInfo.text}</p>
                                            {statusInfo.paid && <p>{statusInfo.paid}</p>}
                                            {canRegisterPayment ? <p className="text-xs text-primary">Clic para registrar abono</p> : weekStatus.status !== 'paid' && <p className="text-xs text-muted-foreground">No se puede registrar pago.</p>}
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            );
                          })}
                          <TableCell className="text-right sticky right-0 bg-card z-10 p-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                 <DropdownMenuItem asChild>
                                    <Link href={`/dashboard/clients/${loan.clientId}`}>Ver Detalles del Cliente</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                    if(currentPaymentWeekNumber !== -1) {
                                        const weekStatus = getWeekPaymentStatus(loan, currentPaymentWeekNumber);
                                        handleRegisterPaymentClick(loan, currentPaymentWeekNumber, weekStatus.date);
                                    }
                                }}
                                disabled={currentPaymentWeekNumber === -1 || loan.status === 'Paid Off'}
                                >
                                    Registrar Pago
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={18} className="text-center h-24 p-2">
                               No hay préstamos para la semana seleccionada. O presiona "Cargar Datos de Ejemplo".
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
    {selectedLoanForPayment && selectedWeekForPayment &&
        <RegisterPaymentDialog 
            isOpen={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            loan={selectedLoanForPayment}
            clients={clients}
            loanPlans={loanPlans}
            weekNumber={selectedWeekForPayment.weekNumber}
            weekDate={selectedWeekForPayment.weekDate}
            onPaymentRegistered={() => router.refresh()}
        />
    }
    </>
  );
}
