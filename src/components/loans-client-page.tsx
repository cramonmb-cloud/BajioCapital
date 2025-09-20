'use client';

import { useState } from 'react';
import { MoreHorizontal, CheckCircle2, XCircle, Circle, AlertCircle } from 'lucide-react';
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
    if (!loanPlan) return { status: 'pending' as const, date: new Date(), payment: null };

    const loanStartDate = new Date(loan.startDate);
    
    // First payment week starts on the Sunday *after* the loan's start Saturday.
    const firstPaymentWeekStartDate = new Date(loanStartDate);
    firstPaymentWeekStartDate.setUTCDate(loanStartDate.getUTCDate() + 1); 

    const weekStartDate = new Date(firstPaymentWeekStartDate);
    weekStartDate.setUTCDate(firstPaymentWeekStartDate.getUTCDate() + (weekNumber - 1) * 7);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    const paymentForWeek = loan.payments.find(p => {
        const paymentDate = new Date(p.date);
        return paymentDate >= weekStartDate && paymentDate <= weekEndDate;
    });

    const isFuture = new Date() < weekStartDate;
    
    if (isFuture) {
      return { status: 'pending' as const, date: weekStartDate, payment: null };
    }

    if (paymentForWeek) {
        if(paymentForWeek.amount >= loanPlan.weeklyPayment) {
            return { status: 'paid' as const, date: weekStartDate, payment: paymentForWeek };
        } else {
            return { status: 'partial' as const, date: weekStartDate, payment: paymentForWeek };
        }
    } else {
        return { status: 'missed' as const, date: weekStartDate, payment: null };
    }
  };
  
  const handleRegisterPaymentClick = (loan: Loan, weekNumber: number, weekDate: Date) => {
      setSelectedLoanForPayment(loan);
      setSelectedWeekForPayment({ weekNumber, weekDate });
      setPaymentDialogOpen(true);
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
      
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {/* Weeks List */}
        <Card className="p-2">
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
                        let currentPaymentWeekNumber = -1;

                        for (let i = 1; i <= 14; i++) {
                            const status = getWeekPaymentStatus(loan, i);
                            if (status.status === 'missed') {
                                currentPaymentWeekNumber = i;
                                break;
                            }
                        }
                        if (currentPaymentWeekNumber === -1) { // All paid or pending
                            const firstPending = Array.from({length: 14}, (_, i) => getWeekPaymentStatus(loan, i+1)).findIndex(s => s.status === 'pending');
                            if(firstPending !== -1) currentPaymentWeekNumber = firstPending + 1;
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
                            const canRegisterPayment = (i + 1) === currentPaymentWeekNumber && loan.status !== 'Paid Off';

                            let statusInfo;
                            switch(weekStatus.status) {
                                case 'paid':
                                    statusInfo = { icon: <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />, text: 'Pagado', paid: `Abono: ${formatCurrency(weekStatus.payment!.amount)}` };
                                    break;
                                case 'partial':
                                    statusInfo = { icon: <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />, text: 'Pago Parcial', paid: `Abono: ${formatCurrency(weekStatus.payment!.amount)}` };
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
                                            {canRegisterPayment ? <p className="text-xs text-primary">Clic para registrar pago</p> : weekStatus.status !== 'paid' && weekStatus.status !== 'partial' && <p className="text-xs text-muted-foreground">No se puede registrar pago aún.</p>}
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
        />
    }
    </>
  );
}
