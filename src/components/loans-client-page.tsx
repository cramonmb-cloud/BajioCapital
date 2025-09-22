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
import { useAuth } from '@/hooks/use-auth';

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
  const { appUser } = useAuth();
  const [paymentDialogData, setPaymentDialogData] = useState<{
    weekNumber: number;
    weekDate: Date;
    initialAmount: number;
  } | null>(null);
  const router = useRouter();
  const today = new Date();

  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  const getClientName = (clientId: string) => getClient(clientId)?.name || 'N/A';
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
    const formatCurrencySimplePDF = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'decimal',
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
   const formatDateForPDF = (date: Date) => {
      const dateUTC = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      return dateUTC.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
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

  const getWeekPaymentStatus = (loan: Loan, weekNumber: number, currentLoanWeek: number) => {
    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
    
    const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);

    // If the loan is fully paid, all weeks within its term are considered paid.
    if (loan.status === 'Paid Off' && weekNumber <= loanPlan.termInWeeks) {
        return { status: 'paid' as const, date: new Date(), amountPaid: weeklyPaymentAmount, isAssumedPaid: false };
    }

    const loanStartDate = new Date(loan.startDate);
    
    const weekStartDate = new Date(loanStartDate);
    weekStartDate.setUTCDate(loanStartDate.getUTCDate() + ((weekNumber - 1) * 7));
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 7);

    const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
    const totalPaidForWeek = paymentForWeek?.amount || 0;

    const isFuture = today < weekStartDate;
    if (isFuture) {
      return { status: 'pending' as const, date: weekStartDate, amountPaid: 0, isAssumedPaid: false };
    }
    
    if (weekNumber === currentLoanWeek && !paymentForWeek) {
        return { status: 'paid' as const, date: weekStartDate, amountPaid: 0, isAssumedPaid: true };
    }

    if (totalPaidForWeek > 0) {
        if(totalPaidForWeek >= weeklyPaymentAmount) {
            return { status: 'paid' as const, date: weekStartDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
        } else {
            return { status: 'partial' as const, date: weekStartDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
        }
    } else {
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
    } else if (weekStatus.status === 'paid' && !weekStatus.isAssumedPaid) {
        initialAmount = 0; // Already paid
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
    if (filteredLoans.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWeeksToShow = 10; 

    // --- Header ---
    const today = new Date();
    const firstLoan = filteredLoans[0];
    const groupName = getGroupName(firstLoan.groupId);
    const supervisorName = getSupervisorName(firstLoan.groupId);
    const loanPlan = loanPlans.find(p => p.id === firstLoan.loanPlanId);
    const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.amount, 0);

    const loanStartDate = new Date(firstLoan.startDate);
    const vencimientoDate = new Date(loanStartDate);
    if(loanPlan) {
        vencimientoDate.setUTCDate(loanStartDate.getUTCDate() + (loanPlan.termInWeeks * 7));
    }


    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha', margin, 30);
    doc.text('Ejecutivo', margin, 42);
    doc.text('Supervisor', margin, 54);
    doc.text('Grupo', margin, 66);
    
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(today.toISOString()), margin + 50, 30);
    doc.text(appUser?.username.toUpperCase() || 'N/A', margin + 50, 42);
    doc.text(supervisorName.toUpperCase(), margin + 50, 54);
    doc.text(groupName.toUpperCase(), margin + 50, 66);

    const rightColumnX = pageWidth - margin - 100;
    doc.setFont('helvetica', 'bold');
    doc.text('Vence', rightColumnX, 30);
    doc.text('Plaza', rightColumnX, 42);
    doc.text('Cantidad', rightColumnX, 54);

    doc.setFont('helvetica', 'normal');
    doc.text(loanPlan ? formatDate(vencimientoDate.toISOString()) : 'N/A', rightColumnX + 50, 30);
    doc.text('N/A'.toUpperCase(), rightColumnX + 50, 42);
    doc.text(formatCurrency(totalAmount), rightColumnX + 50, 54);

    // --- Table ---
    const tableHeaders: any[] = [
        { content: 'CLIENTE' },
        { content: 'ABONA' },
    ];
    
    for (let i = 0; i < maxWeeksToShow; i++) {
        const weekDate = new Date(loanStartDate);
        weekDate.setUTCDate(loanStartDate.getUTCDate() + (i * 7));
        tableHeaders.push({ 
            content: `${formatDateForPDF(weekDate)}\n${i + 1}`,
        });
    }
     tableHeaders.push({ content: 'AVAL' });


    const tableData = filteredLoans.map(loan => {
        const client = getClient(loan.clientId);
        const weeklyPayment = getWeeklyPaymentAmount(loan);

        const clientInfo = [
            client?.name || '',
            `${client?.street || ''}, ${client?.neighborhood || ''}`,
            client?.phone || '',
        ].join('\n');
        
        let avalInfo = '';
        if(client?.endorsement) {
            const match = client.endorsement.match(/(.*) \((.*)\)/);
            if (match) {
                const [, avalName, avalDetails] = match;
                const detailsArray = avalDetails.split(',').map(s => s.trim());
                const telIndex = detailsArray.findIndex(d => d.toUpperCase().startsWith('TEL:'));
                const tel = telIndex > -1 ? detailsArray[telIndex] : '';
                const addressParts = telIndex > -1 ? detailsArray.slice(0, telIndex) : detailsArray;
                
                avalInfo = `${avalName}\n${addressParts.join(', ')}\n${tel}`;
            } else {
                avalInfo = client.endorsement;
            }
        }
        
        const rowData: any[] = [
            { content: clientInfo },
            { content: formatCurrency(weeklyPayment) },
        ];
        
        for (let i = 0; i < maxWeeksToShow; i++) {
            rowData.push(''); // Placeholder, content will be drawn in didDrawCell
        }
        
        rowData.push({ content: avalInfo });

        return rowData;
    });

    const weeklyFailures = Array.from({ length: maxWeeksToShow }).map((_, i) => {
        const weekNumber = i + 1;
        return filteredLoans.reduce((total, loan) => {
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;

            const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
            const weeklyPayment = getWeeklyPaymentAmount(loan);
            if (weekStatus.status === 'missed') return total + weeklyPayment;
            if (weekStatus.status === 'partial') return total + (weeklyPayment - weekStatus.amountPaid);
            return total;
        }, 0);
    });

    const weeklyCollected = Array.from({ length: maxWeeksToShow }).map((_, i) => {
        const weekNumber = i + 1;
        return filteredLoans.reduce((total, loan) => {
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
            if (weekStatus.status === 'paid' || weekStatus.status === 'partial') {
                 if (!weekStatus.isAssumedPaid) {
                     return total + weekStatus.amountPaid;
                 }
            }
            return total;
        }, 0);
    });
    
    // --- Footer Rows ---
    const totalAbonos = filteredLoans.reduce((sum, loan) => sum + getWeeklyPaymentAmount(loan), 0);
    
    const footerRow1 = [
        { content: `TOT. CLIENTES: ${filteredLoans.length}`, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: `TOTALES: ${formatCurrencySimple(totalAbonos)}`, styles: { fontStyle: 'bold', halign: 'right' } },
    ];
    const footerRow2 = [{content: 'FALLA', colSpan: 2, styles: {halign: 'right', fontStyle: 'bold', fillColor: '#e0e0e0'}}];
    const footerRow3 = [{content: 'COBRADO', colSpan: 2, styles: {halign: 'right', fontStyle: 'bold'}}];

    Array.from({ length: maxWeeksToShow }).forEach((_, i) => {
        const weeklyTotal = filteredLoans.reduce((total, loan) => {
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if(loanPlan && i + 1 <= loanPlan.termInWeeks) {
                return total + getWeeklyPaymentAmount(loan);
            }
            return total;
        }, 0);
        footerRow1.push({ content: weeklyTotal > 0 ? formatCurrencySimple(weeklyTotal) : '', styles: { fontStyle: 'bold', halign: 'right' } });
        footerRow2.push({ content: weeklyFailures[i] > 0 ? formatCurrencySimplePDF(weeklyFailures[i]) : '', styles: { fontStyle: 'bold', halign: 'right', fillColor: '#e0e0e0' } });
        footerRow3.push({ content: weeklyCollected[i] > 0 ? formatCurrencySimplePDF(weeklyCollected[i]) : '', styles: { fontStyle: 'bold', halign: 'right' } });
    });
    footerRow1.push({ content: '', styles: { fontStyle: 'bold', halign: 'right' } });
    footerRow2.push({ content: '', colSpan: 1 });
    footerRow3.push({ content: '', colSpan: 1 });
    
    const footerRows = [footerRow1, footerRow2, footerRow3];
    
    doc.autoTable({
        startY: 80,
        head: [tableHeaders],
        body: tableData,
        foot: footerRows,
        theme: 'grid',
        styles: {
            lineWidth: 0.5,
            lineColor: [0, 0, 0],
            fontSize: 5.5,
            cellPadding: 2,
            valign: 'middle',
        },
        headStyles: {
            fillColor: [220, 220, 220],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            fontSize: 5,
        },
        footStyles: {
             fillColor: [220, 220, 220],
             textColor: [0, 0, 0],
             fontStyle: 'bold',
             valign: 'middle',
             fontSize: 7,
        },
        columnStyles: {
          0: { cellWidth: 80 }, 
          1: { cellWidth: 35, halign: 'right' }, 
          ...Object.fromEntries(Array.from({ length: maxWeeksToShow }).map((_, i) => [i + 2, { cellWidth: 28 }])),
          [maxWeeksToShow + 2]: { cellWidth: 80 },
        },
        didDrawCell: (data) => {
            const loan = filteredLoans[data.row.index];
            if (!loan || data.row.section !== 'body') return;

            const timeDiff = new Date().getTime() - new Date(loan.startDate).getTime();
            const currentWeekForLoan = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            if (data.column.index === (currentWeekForLoan + 1)) {
                 doc.setFillColor(240, 248, 255);
                 doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            }
            
            if (data.column.index >= 2 && data.column.index < (2 + maxWeeksToShow)) {
                const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                const weekNumber = data.column.index - 1;
                if (!loanPlan || weekNumber > loanPlan.termInWeeks) return;
                
                const weeklyPayment = getWeeklyPaymentAmount(loan);
                const status = getWeekPaymentStatus(loan, weekNumber, currentWeekForLoan);

                let text = '';
                let subtext = '';

                if (status.status === 'paid' && !status.isAssumedPaid) {
                    text = 'Abono';
                    subtext = formatCurrencySimplePDF(status.amountPaid);
                } else if (status.status === 'paid' && status.isAssumedPaid) {
                     text = 'Abono';
                    subtext = formatCurrencySimplePDF(weeklyPayment);
                } else if (status.status === 'partial' || status.status === 'missed') {
                    const fallo = weeklyPayment - status.amountPaid;
                    if(fallo > 0) {
                        text = 'Falla';
                        subtext = formatCurrencySimplePDF(fallo);
                        doc.setFillColor(224, 224, 224);
                        doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                    }
                }

                if (text) {
                    const centerX = data.cell.x + data.cell.width / 2;
                    const centerY = data.cell.y + data.cell.height / 2;
                    doc.setFontSize(5);
                    doc.setTextColor(0, 0, 0);
                    doc.text(text, centerX, centerY - 2, { align: 'center' });
                    if(subtext) {
                        doc.text(subtext, centerX, centerY + 5, { align: 'center' });
                    }
                }
            }
        }
    });

    doc.save('reporte_cobranza.pdf');
};

  
  const weeklyFailures = Array.from({ length: 14 }).map((_, i) => {
    const weekNumber = i + 1;
    return filteredLoans.reduce((total, loan) => {
        const loanStartDate = new Date(loan.startDate);
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
      const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
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
        const loanStartDate = new Date(loan.startDate);
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
      const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
      const weeklyPayment = getWeeklyPaymentAmount(loan);
      
      if (weekStatus.status === 'paid' || weekStatus.status === 'partial') {
          if(!weekStatus.isAssumedPaid) {
            return total + weekStatus.amountPaid;
          }
      }
      if (weekStatus.isAssumedPaid) {
          return total + weeklyPayment;
      }
      return total;
    }, 0);
  });

  // Find the current week for the selected group of loans (assuming they all start on the same week)
  
  let currentGroupWeek = 0;
  if(filteredLoans.length > 0) {
      const firstLoanStartDate = new Date(filteredLoans[0].startDate);
      const timeDiff = today.getTime() - firstLoanStartDate.getTime();
      currentGroupWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
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
                      <TableHead className="sticky left-0 bg-card z-10 w-[200px] p-2">Cliente</TableHead>
                      <TableHead className="p-2">Grupo</TableHead>
                      <TableHead className="p-2">Supervisor</TableHead>
                      <TableHead className="p-2">Abono</TableHead>
                      <TableHead className="p-2">Estado</TableHead>
                      {Array.from({ length: 14 }, (_, i) => {
                          const weekNumber = i + 1;
                          const isCurrentWeek = weekNumber === currentGroupWeek;
                          return (
                            <TableHead key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")}>{`S${i + 1}`}</TableHead>
                          );
                      })}
                      <TableHead className="text-right sticky right-0 bg-card z-10 p-2">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.length > 0 ? (
                      filteredLoans.map((loan) => {
                        const weeklyPayment = getWeeklyPaymentAmount(loan);
                        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                        const timeDiff = today.getTime() - new Date(loan.startDate).getTime();
                        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
                        
                        return (
                        <TableRow key={loan.id} className="bg-card">
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
                                const isCurrentWeek = weekNumber === currentLoanWeek;
                                
                                if (!loanPlan || weekNumber > loanPlan.termInWeeks) {
                                    return <TableCell key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")} />;
                                }
                                
                                const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
                                const canRegisterPayment = (loan.status !== 'Paid Off') && (weekStatus.status !== 'pending');

                                let statusInfo;
                                switch(weekStatus.status) {
                                    case 'paid':
                                        const paidAmountText = weekStatus.isAssumedPaid ? `Asumido` : `Abono: ${formatCurrency(weekStatus.amountPaid)}`;
                                        statusInfo = { icon: <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />, text: `Pagado`, paid: paidAmountText };
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
                                    <TableCell key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")}>
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
                                                {statusInfo.paid && <p>{statusInfo.paid}</p>}
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
                            {Array.from({ length: 14 }).map((_, i) => {
                                const weekNumber = i + 1;
                                const isCurrentWeek = weekNumber === currentGroupWeek;
                                const weeklyTotal = filteredLoans.reduce((total, loan) => {
                                    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                                    if(loanPlan && i + 1 <= loanPlan.termInWeeks) {
                                        return total + getWeeklyPaymentAmount(loan);
                                    }
                                    return total;
                                }, 0);
                                return (
                                    <TableCell key={i} className={cn("p-1 text-center font-semibold border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")}>
                                        {weeklyTotal > 0 ? formatCurrencySimple(weeklyTotal) : ''}
                                    </TableCell>
                                )
                            })}
                            <TableCell className="sticky right-0 bg-inherit p-1"></TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                          <TableCell colSpan={5} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-destructive">Falla</TableCell>
                            {weeklyFailures.map((total, i) => {
                                const weekNumber = i + 1;
                                const isCurrentWeek = weekNumber === currentGroupWeek;
                                return (
                                <TableCell key={i} className={cn("p-1 text-center font-semibold text-destructive border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")}>
                                    {total > 0 ? formatCurrencySimple(total) : ''}
                                </TableCell>
                            )})}
                           <TableCell className="sticky right-0 bg-inherit p-1"></TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                            <TableCell colSpan={5} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-blue-600">Cobrado</TableCell>
                            {weeklyCollected.map((total, i) => {
                                const weekNumber = i + 1;
                                const isCurrentWeek = weekNumber === currentGroupWeek;
                                return (
                                <TableCell key={i} className={cn("p-1 text-center font-semibold text-blue-600 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")}>
                                    {total > 0 ? formatCurrencySimple(total) : ''}
                                </TableCell>
                            )})}
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
