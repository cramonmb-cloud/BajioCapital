'use client';

import { useState } from 'react';
import { MoreHorizontal, Calendar as CalendarIcon, CheckCircle2, XCircle, Circle } from 'lucide-react';
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
import { clients, loans, loanPlans } from '@/lib/data';
import Link from 'next/link';
import { CreateLoanDialog } from '@/components/create-loan-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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


export default function LoansPage() {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

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

  const getWeekPaymentStatus = (loan: typeof loans[0], weekNumber: number) => {
    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!loanPlan) return { status: 'pending', date: '' };

    const loanStartDate = new Date(loan.startDate);
    const weekStartDate = new Date(loanStartDate);
    weekStartDate.setDate(loanStartDate.getDate() + (weekNumber - 1) * 7);
    
    // Payments can be made any day of the week, check for a payment within the week
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    const paymentForWeek = loan.payments.find(p => {
        const paymentDate = new Date(p.date);
        return paymentDate >= weekStartDate && paymentDate <= weekEndDate;
    });

    const isPaid = !!paymentForWeek;
    const isFuture = new Date() < weekStartDate;
    
    if (isFuture) {
      return { status: 'pending', date: weekStartDate };
    }

    if (isPaid) {
        return { status: 'paid', date: weekStartDate };
    } else {
        return { status: 'missed', date: weekStartDate };
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Préstamos</h1>
          <p className="text-muted-foreground">
            Visualiza y administra todos los préstamos por semana.
          </p>
        </div>
        <CreateLoanDialog />
      </div>

      <div className="grid gap-6 md:grid-cols-[180px_1fr]">
        {/* Weeks List */}
        <Card className="md:h-fit">
            <CardHeader>
                <CardTitle className="text-lg">Semanas</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {loanWeeks.map((week) => (
                        <Button 
                            key={week}
                            variant={selectedWeek === week ? 'secondary' : 'ghost'}
                            className="w-full justify-start"
                            onClick={() => setSelectedWeek(week)}
                        >
                            {formatDate(week)}
                        </Button>
                    ))}
                    {loanWeeks.length === 0 && <p className="text-sm text-muted-foreground text-center">No hay préstamos registrados.</p>}
                </div>
            </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardHeader>
            <CardTitle>Préstamos de la Semana</CardTitle>
            <CardDescription>
              {`Mostrando ${filteredLoans.length} préstamos para la semana del ${selectedWeek ? formatDate(selectedWeek) : 'N/A'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <ScrollArea className="w-full whitespace-nowrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 w-[200px]">Cliente</TableHead>
                      <TableHead>Abono Semanal</TableHead>
                      <TableHead>Estado</TableHead>
                      {Array.from({ length: 14 }, (_, i) => (
                        <TableHead key={i} className="text-center">{`S${i + 1}`}</TableHead>
                      ))}
                      <TableHead className="text-right sticky right-0 bg-card z-10">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.length > 0 ? (
                      filteredLoans.map((loan) => (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium sticky left-0 bg-card z-10 w-[200px]">
                            <Link href={`/dashboard/clients/${loan.clientId}`} className="hover:underline">
                              {getClientName(loan.clientId)}
                            </Link>
                          </TableCell>
                          <TableCell>{formatCurrency(getWeeklyPayment(loan.loanPlanId))}</TableCell>
                          <TableCell>
                            <Badge variant={loan.status === 'Paid Off' ? 'secondary' : loan.status === 'Overdue' ? 'destructive' : 'default'}>{loan.status}</Badge>
                          </TableCell>
                          {Array.from({ length: 14 }, (_, i) => {
                            const weekStatus = getWeekPaymentStatus(loan, i + 1);
                            return (
                                <TableCell key={i} className="text-center">
                                     <Tooltip>
                                        <TooltipTrigger>
                                            {weekStatus.status === 'paid' && <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />}
                                            {weekStatus.status === 'missed' && <XCircle className="h-4 w-4 text-red-500 mx-auto" />}
                                            {weekStatus.status === 'pending' && <Circle className="h-4 w-4 text-muted-foreground mx-auto" />}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Semana {i + 1} ({formatDate(weekStatus.date.toISOString())})</p>
                                            <p>Estado: {
                                                weekStatus.status === 'paid' ? 'Pagado' : 
                                                weekStatus.status === 'missed' ? 'Atrasado' : 'Pendiente'
                                            }</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TableCell>
                            );
                          })}
                          <TableCell className="text-right sticky right-0 bg-card z-10">
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
                                <DropdownMenuItem>Registrar Pago</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={18} className="text-center h-24">
                               No hay préstamos para la semana seleccionada.
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
  );
}
