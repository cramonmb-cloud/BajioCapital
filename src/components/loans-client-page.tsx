'use client';

import { useState } from 'react';
import { MoreHorizontal, CheckCircle2, XCircle, Circle, AlertCircle, FileDown } from 'lucide-react';
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
  TableFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { CreateLoanDialog } from '@/components/create-loan-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client, Loan, LoanPlan, Payment, Group, Supervisor } from '@/lib/types';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}


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
    groups: Group[];
    supervisors: Supervisor[];
}

export function LoansClientPage({ loans, clients, loanPlans, groups, supervisors }: LoansClientPageProps) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<Loan | null>(null);
  const [paymentDialogData, setPaymentDialogData] = useState<{
    weekNumber: number;
    weekDate: Date;
    initialAmount: number;
  } | null>(null);
  const router = useRouter();

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'N/A';
  const getGroupName = (groupId?: string) => groups.find(g => g.id === groupId)?.name || 'N/A';

  const getSupervisorName = (groupId?: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return 'N/A';
    return supervisors.find(s => s.id === group.supervisorId)?.name || 'N/A';
  };
  
  const getWeeklyPaymentAmount = (loan: Loan) => {
    const plan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!plan) return 0;
    return (loan.amount / 1000) * plan.weeklyPaymentRate;
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };
   const formatCurrencySimple = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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
      default:
        return status;
    }
  };

  const getStatusVariant = (status: Loan['status']): 'destructive' | 'success' | 'default' => {
    switch (status) {
        case 'Overdue':
            return 'destructive';
        case 'Paid Off':
            return 'success';
        default:
            return 'default';
    }
  };

  // Get unique weeks (represented by Saturday's date string) from all loans
  const loanWeeks = Array.from(
    new Set(loans.map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString()))
  ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort descending

  // Set the most recent week as the default selected week if none is selected
  if (!selectedWeek && loanWeeks.length > 0) {
      setSelectedWeek(loanWeeks[0]);
  }
  
  const filteredLoans = loans.filter(loan => {
    const isCorrectWeek = selectedWeek ? getSaturdayOfWeek(new Date(loan.startDate)).toISOString() === selectedWeek : false;
    const isCorrectGroup = selectedGroup === 'all' ? true : loan.groupId === selectedGroup;
    return isCorrectWeek && isCorrectGroup;
  });

  const getWeekPaymentStatus = (loan: Loan, weekNumber: number) => {
    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
    
    if (loan.status === 'Paid Off' && weekNumber <= loanPlan.termInWeeks) {
        return { status: 'paid' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
    }

    const loanStartDate = new Date(loan.startDate);
    
    const weekStartDate = new Date(loanStartDate);
    weekStartDate.setUTCDate(loanStartDate.getUTCDate() + ((weekNumber - 1) * 7));
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 7);

    const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);

    const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
    const totalPaidForWeek = paymentForWeek?.amount || 0;

    const today = new Date();
    const isFuture = today < weekStartDate;
    
    if (isFuture) {
      return { status: 'pending' as const, date: weekStartDate, amountPaid: 0, isAssumedPaid: false };
    }
    
    // Logic for current week automatic payment
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentWeekForLoan = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
    const isCurrentWeek = weekNumber === currentWeekForLoan;

    if (totalPaidForWeek > 0) {
        if(totalPaidForWeek >= weeklyPaymentAmount) {
            return { status: 'paid' as const, date: weekStartDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
        } else {
            return { status: 'partial' as const, date: weekStartDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
        }
    } else {
        if (isCurrentWeek && loan.status === 'Active') {
            return { status: 'paid' as const, date: weekStartDate, amountPaid: 0, isAssumedPaid: true };
        }
        return { status: 'missed' as const, date: weekStartDate, amountPaid: 0, isAssumedPaid: false };
    }
  };
  
 const handleRegisterPaymentClick = (loan: Loan, weekNumber: number, weekStatus: ReturnType<typeof getWeekPaymentStatus>) => {
    const weeklyPayment = getWeeklyPaymentAmount(loan);
    let initialAmount = weeklyPayment;

    if (weekStatus.status === 'partial') {
        initialAmount = weeklyPayment - weekStatus.amountPaid;
    } else if (weekStatus.status === 'missed') {
        initialAmount = weeklyPayment;
    }

    setSelectedLoanForPayment(loan);
    setPaymentDialogData({ 
      weekNumber, 
      weekDate: weekStatus.date,
      initialAmount: initialAmount > 0 ? initialAmount : 0
    });
    setPaymentDialogOpen(true);
};

const handleExportPDF = () => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const tableData = [];
    const tableHeaders = ['Cliente', 'Abono', ...Array.from({ length: 14 }, (_, i) => `S${i + 1}`)];

    const today = new Date();

    for (const loan of filteredLoans) {
        const weeklyPayment = getWeeklyPaymentAmount(loan);
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        const loanStartDate = new Date(loan.startDate);
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const currentWeekForLoan = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;

        const row = [
            getClientName(loan.clientId),
            formatCurrency(weeklyPayment),
        ];

        for (let i = 1; i <= 14; i++) {
            if (loanPlan && i <= loanPlan.termInWeeks) {
                 const weekStatus = getWeekPaymentStatus(loan, i);
                 let content = '';
                 if (weekStatus.status === 'paid' && !weekStatus.isAssumedPaid) content = 'P';
                 if (weekStatus.status === 'partial') content = `A: ${formatCurrencySimple(weekStatus.amountPaid)}`;
                 if (weekStatus.status === 'missed') content = 'F';
                 row.push(content);
            } else {
                 row.push('');
            }
        }
        tableData.push(row);
    }
    
    const groupName = selectedGroup === 'all' ? 'Todos los Grupos' : getGroupName(filteredLoans[0]?.groupId);

    doc.setFontSize(16);
    doc.text('Reporte de Cobranza', 14, 15);
    doc.setFontSize(10);
    doc.text(`Grupo: ${groupName}`, 14, 22);
    doc.text(`Semana de Préstamo: ${selectedWeek ? formatDate(selectedWeek) : 'N/A'}`, 14, 27);

    doc.autoTable({
        startY: 32,
        head: [tableHeaders],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [22, 160, 133], // Dark green
            textColor: 255,
            fontSize: 8,
        },
        bodyStyles: {
            fontSize: 8,
            cellPadding: 1.5,
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240],
        },
        willDrawCell: (data) => {
            const loan = filteredLoans[data.row.index];
            if (!loan) return;

            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentWeekForLoan = Math.ceil(timeDiff / (1000 * 3600 * 24 * 7));
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);

            // S1 is at column index 2
            const weekNumber = data.column.index - 1;
            
            if (weekNumber > 0 && loanPlan && weekNumber <= loanPlan.termInWeeks) {
              const weekStatus = getWeekPaymentStatus(loan, weekNumber);

              if (weekStatus.status === 'paid' && !weekStatus.isAssumedPaid) {
                  doc.setFillColor(213, 245, 227); // Light green for paid
              }
              if (weekStatus.status === 'partial') {
                  doc.setTextColor(231, 76, 60); // Red text for failure amount
                  doc.setFillColor(252, 243, 207); // Yellow for partial
              }
              if (weekStatus.status === 'missed') {
                   doc.setFillColor(250, 219, 216); // Light red for missed
              }

              // Highlight current week
              if (loan.status === 'Active' && weekNumber === currentWeekForLoan) {
                  doc.setFillColor(133, 193, 233, 0.5); // Light blue for current collection week
              }
            }
        },
    });

    doc.save('reporte_cobranza.pdf');
};


  const weeklyTotals = Array.from({ length: 14 }).map((_, i) => {
    const weekNumber = i + 1;
    return filteredLoans.reduce((total, loan) => {
      const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
      if (loanPlan && weekNumber <= loanPlan.termInWeeks) {
        return total + getWeeklyPaymentAmount(loan);
      }
      return total;
    }, 0);
  });
  
  const weeklyFailures = Array.from({ length: 14 }).map((_, i) => {
    const weekNumber = i + 1;
    return filteredLoans.reduce((total, loan) => {
      const weekStatus = getWeekPaymentStatus(loan, weekNumber);
      const weeklyPayment = getWeeklyPaymentAmount(loan);
      if (weekStatus.status === 'missed') {
        return total + weeklyPayment;
      }
      if (weekStatus.status === 'partial') {
        return total + (weeklyPayment - weekStatus.amountPaid);
      }
      return total;
    }, 0);
  });

  const weeklyCollected = Array.from({ length: 14 }).map((_, i) => {
    const weekNumber = i + 1;
    return filteredLoans.reduce((total, loan) => {
      const weekStatus = getWeekPaymentStatus(loan, weekNumber);
      const weeklyPayment = getWeeklyPaymentAmount(loan);
      
      if (weekStatus.status === 'paid') {
        // If it's assumed paid, we add the full weekly amount. If it's explicitly paid, we use the recorded amount if it's higher (e.g. overpayment).
        return total + (weekStatus.isAssumedPaid ? weeklyPayment : Math.max(weeklyPayment, weekStatus.amountPaid));
      }
      if (weekStatus.status === 'partial') {
        return total + weekStatus.amountPaid;
      }
      return total;
    }, 0);
  });

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
        <div className="flex items-center gap-2">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por grupo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los Grupos</SelectItem>
                    {groups.map(group => (
                        <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExportPDF} disabled={filteredLoans.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar a PDF
            </Button>
            <CreateLoanDialog clients={clients} loanPlans={loanPlans} loans={loans} groups={groups} />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
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
                      <TableHead className="sticky left-0 bg-inherit z-10 w-[200px] p-2">Cliente</TableHead>
                      <TableHead className="p-2">Grupo</TableHead>
                      <TableHead className="p-2">Supervisor</TableHead>
                      <TableHead className="p-2">Abono</TableHead>
                      <TableHead className="p-2">Estado</TableHead>
                      {Array.from({ length: 14 }, (_, i) => (
                        <TableHead key={i} className="text-center p-2 border-r">{`S${i + 1}`}</TableHead>
                      ))}
                      <TableHead className="text-right sticky right-0 bg-inherit z-10 p-2">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.length > 0 ? (
                      filteredLoans.map((loan, index) => {
                        const weeklyPayment = getWeeklyPaymentAmount(loan);
                        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                        
                        return (
                        <TableRow key={loan.id} className={cn(index % 2 !== 0 && 'bg-muted/50')}>
                          <TableCell className="font-medium sticky left-0 z-10 w-[200px] p-2 bg-inherit">
                            <Link href={`/dashboard/clients/${loan.clientId}`} className="hover:underline">
                              {getClientName(loan.clientId)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-2">{getGroupName(loan.groupId)}</TableCell>
                          <TableCell className="p-2">{getSupervisorName(loan.groupId)}</TableCell>
                          <TableCell className="p-2">{formatCurrency(weeklyPayment)}</TableCell>
                          <TableCell className="p-2">
                            <Badge variant={getStatusVariant(loan.status)}>{translateStatus(loan.status)}</Badge>
                          </TableCell>
                           {Array.from({ length: 14 }).map((_, i) => {
                                const weekNumber = i + 1;
                                
                                if (!loanPlan || weekNumber > loanPlan.termInWeeks) {
                                    return <TableCell key={i} className="text-center p-2 border-r" />;
                                }
                                
                                const weekStatus = getWeekPaymentStatus(loan, weekNumber);
                                const canRegisterPayment = (loan.status !== 'Paid Off') && (weekStatus.status !== 'pending');

                                let statusInfo;
                                switch(weekStatus.status) {
                                    case 'paid':
                                        statusInfo = { icon: <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />, text: weekStatus.isAssumedPaid ? 'Semana Actual (Asumido Pagado)' : 'Pagado', paid: `Abono: ${formatCurrency(weekStatus.amountPaid)}` };
                                        break;
                                    case 'partial':
                                        const fallo = weeklyPayment - weekStatus.amountPaid;
                                        statusInfo = { 
                                            icon: <AlertCircle className="h-4 w-4 text-yellow-500 mx-auto" />, 
                                            text: 'Pago Parcial', 
                                            paid: `Abono: ${formatCurrency(weekStatus.amountPaid)}`,
                                            pending: `Fallo: ${formatCurrency(fallo)}`
                                        };
                                        break;
                                    case 'missed':
                                        statusInfo = { icon: <XCircle className="h-4 w-4 text-red-500 mx-auto" />, text: 'Atrasado' };
                                        break;
                                    default:
                                        statusInfo = { icon: <Circle className="h-4 w-4 text-muted-foreground mx-auto" />, text: 'Pendiente' };
                                }
                                
                                return (
                                    <TableCell key={i} className="text-center p-2 border-r">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button 
                                                    className="w-full disabled:cursor-not-allowed"
                                                    disabled={!canRegisterPayment}
                                                    onClick={(e) => {
                                                    if(canRegisterPayment) {
                                                        e.stopPropagation();
                                                        handleRegisterPaymentClick(loan, weekNumber, weekStatus);
                                                    }
                                                    }}
                                                >
                                                    {statusInfo.icon}
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Semana {weekNumber} (Inicia: {formatDate(weekStatus.date.toISOString())})</p>
                                                <p>Estado: {statusInfo.text}</p>
                                                {statusInfo.paid && weekStatus.amountPaid > 0 && <p>{statusInfo.paid}</p>}
                                                {statusInfo.pending && <p className="text-destructive">{statusInfo.pending}</p>}
                                                {canRegisterPayment ? <p className="text-xs text-primary">Clic para registrar abono</p> : loan.status === 'Paid Off' ? <p className="text-xs text-muted-foreground">Préstamo liquidado</p> : <p className="text-xs text-muted-foreground">No se puede registrar pago.</p>}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                );
                            })}
                          <TableCell className="text-right sticky right-0 z-10 p-2 bg-inherit">
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
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={20} className="text-center h-24 p-2">
                               No hay préstamos para la semana seleccionada. O presiona "Cargar Datos de Ejemplo".
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                  {filteredLoans.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={5} className="sticky left-0 bg-inherit p-1 font-semibold text-right">Total a Cobrar</TableCell>
                            {weeklyTotals.map((total, i) => (
                                <TableCell key={i} className="h-auto p-1 text-center align-bottom font-semibold border-r" >
                                    {total > 0 ? (
                                      <div className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap">
                                        {formatCurrencySimple(total)}
                                      </div>
                                    ) : ''}
                                </TableCell>
                            ))}
                            <TableCell className="sticky right-0 bg-inherit p-1"></TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                          <TableCell colSpan={5} className="sticky left-0 bg-inherit p-1 font-semibold text-right">Falla</TableCell>
                            {weeklyFailures.map((total, i) => (
                                <TableCell key={i} className="h-auto p-1 text-center align-bottom font-semibold text-destructive border-r" >
                                    {total > 0 ? (
                                      <div className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap">
                                        {formatCurrencySimple(total)}
                                      </div>
                                    ) : ''}
                                </TableCell>
                            ))}
                           <TableCell className="sticky right-0 bg-inherit p-1"></TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                            <TableCell colSpan={5} className="sticky left-0 bg-inherit p-1 font-semibold text-right">Cobrado</TableCell>
                            {weeklyCollected.map((total, i) => (
                                <TableCell key={i} className="h-auto p-1 text-center align-bottom font-semibold text-blue-600 border-r" >
                                    {total > 0 ? (
                                      <div className="[writing-mode:vertical-rl] transform rotate-180 whitespace-nowrap">
                                        {formatCurrencySimple(total)}
                                      </div>
                                    ) : ''}
                                </TableCell>
                            ))}
                           <TableCell className="sticky right-0 bg-inherit p-1"></TableCell>
                        </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </ScrollArea>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
    {selectedLoanForPayment && paymentDialogData &&
        <RegisterPaymentDialog 
            isOpen={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            loan={selectedLoanForPayment}
            clients={clients}
            loanPlans={loanPlans}
            weekNumber={paymentDialogData.weekNumber}
            weekDate={paymentDialogData.weekDate}
            initialAmount={paymentDialogData.initialAmount}
            onPaymentRegistered={() => router.refresh()}
        />
    }
    </>
  );
}
