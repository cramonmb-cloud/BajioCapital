'use client';

import { useState, useEffect, useMemo } from 'react';
import { MoreHorizontal, CheckCircle2, XCircle, Circle, AlertCircle, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client, Loan, LoanPlan, Payment, Plaza, Localidad, Promotora } from '@/lib/types';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { accumulateAssumedPaymentsAction } from '@/app/dashboard/actions';
import { format as formatDateFns } from 'date-fns';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import Loading from '../app/dashboard/loading';


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
    initialClients: Client[];
    initialLoanPlans: LoanPlan[];
    initialPlazas: Plaza[];
    initialLocalidades: Localidad[];
    initialPromotoras: Promotora[];
}

export function LoansClientPage({ initialClients, initialLoanPlans, initialPlazas, initialLocalidades, initialPromotoras }: LoansClientPageProps) {
  const { data, loading: dataLoading } = useRealtimeData();
  const { loans, clients, loanPlans, plazas, localidades, promotoras } = data || { 
      loans: [], 
      clients: initialClients, 
      loanPlans: initialLoanPlans, 
      plazas: initialPlazas, 
      localidades: initialLocalidades, 
      promotoras: initialPromotoras 
  };
    
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedPlaza, setSelectedPlaza] = useState<string>('');
  const [selectedLocalidad, setSelectedLocalidad] = useState<string>('');
  const [selectedPromotora, setSelectedPromotora] = useState<string>('');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedLoanForPayment, setSelectedLoanForPayment] = useState<Loan | null>(null);
  const { appUser } = useAuth();
  const [isAccumulating, setIsAccumulating] = useState(false);
  const { toast } = useToast();
  const [paymentDialogData, setPaymentDialogData] = useState<{
    weekNumber: number;
    weekDate: Date;
    initialAmount: number;
  } | null>(null);
  const router = useRouter();

  const filteredLocalidades = useMemo(() => localidades.filter(l => l.plazaId === selectedPlaza), [localidades, selectedPlaza]);
  const filteredPromotoras = useMemo(() => promotoras.filter(p => p.localidadId === selectedLocalidad), [promotoras, selectedLocalidad]);
  
  const loanWeeks = useMemo(() => 
    Array.from(
      new Set(loans.filter(l => l.promotoraId === selectedPromotora).map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString()))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  , [loans, selectedPromotora]);

  const filteredLoans = useMemo(() => loans.filter(loan => {
    const isCorrectWeek = selectedWeek ? getSaturdayOfWeek(new Date(loan.startDate)).toISOString() === selectedWeek : false;
    const isCorrectPromotora = selectedPromotora ? loan.promotoraId === selectedPromotora : false;
    return isCorrectWeek && isCorrectPromotora;
  }), [loans, selectedWeek, selectedPromotora]);


  useEffect(() => {
    if (!selectedWeek && loanWeeks.length > 0) {
        setSelectedWeek(loanWeeks[0]);
    }
    if (selectedWeek && !loanWeeks.includes(selectedWeek)) {
        setSelectedWeek(loanWeeks[0] || null);
    }
  }, [loanWeeks, selectedWeek]);


  const getClient = (clientId: string) => clients.find(c => c.id === clientId);
  const getClientName = (clientId: string) => getClient(clientId)?.name || 'N/A';
  
  const getHierarchy = (promotoraId?: string) => {
    const promotora = promotoras.find(p => p.id === promotoraId);
    const localidad = localidades.find(l => l.id === promotora?.localidadId);
    const plaza = plazas.find(p => p.id === localidad?.plazaId);
    return {
      promotoraName: promotora?.name || 'N/A',
      localidadName: localidad?.name || 'N/A',
      plazaName: plaza?.name || 'N/A',
    };
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
      const dateUTC = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      return dateUTC.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'UTC' });
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

    const {
        currentGroupWeek,
        weeklyFailures,
        weeklyCollected,
        hasAssumedPayments,
        loansWithPenalty
    } = useMemo(() => {
        if (dataLoading || filteredLoans.length === 0) {
            return {
                currentGroupWeek: 0,
                weeklyFailures: [],
                weeklyCollected: [],
                hasAssumedPayments: false,
                loansWithPenalty: {}
            };
        }
        
        const todayDate = new Date();
        const firstLoanStartDate = new Date(filteredLoans[0].startDate);
        const timeDiff = todayDate.getTime() - firstLoanStartDate.getTime();
        const currentGroupWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
        
        const newLoansWithPenalty: Record<string, boolean> = {};

        // Helper function for payment status calculation that can be reused
        const getWeekPaymentStatus = (loan: Loan, weekNumber: number, currentLoanWeek: number, penalty: boolean) => {
          const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
          if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
          
          const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);
          const termInWeeks = loanPlan.termInWeeks + (penalty ? 1 : 0);
          
          if ((loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') && weekNumber <= termInWeeks) {
              return { status: 'paid' as const, date: new Date(), amountPaid: weeklyPaymentAmount, isAssumedPaid: false };
          }
          
          const loanStartDate = new Date(loan.startDate);
          // Payment is expected the following week
          const weekDate = new Date(loanStartDate.getTime());
          weekDate.setUTCDate(weekDate.getUTCDate() + (weekNumber * 7));

          
          const isFuture = new Date() < weekDate;
          if (isFuture) {
            return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
          }
          
          const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
          const totalPaidForWeek = paymentForWeek?.amount || 0;

          if (weekNumber === currentLoanWeek && !paymentForWeek) {
              return { status: 'paid' as const, date: weekDate, amountPaid: 0, isAssumedPaid: true };
          }

          if (totalPaidForWeek > 0) {
              if (totalPaidForWeek >= weeklyPaymentAmount) {
                  return { status: 'paid' as const, date: weekDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
              } else {
                  return { status: 'partial' as const, date: weekDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
              }
          } else {
              if (weekNumber < currentLoanWeek) {
                  return { status: 'missed' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
              }
              return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
          }
        };

        filteredLoans.forEach(loan => {
            const loanTimeDiff = todayDate.getTime() - new Date(loan.startDate).getTime();
            const currentLoanWeek = Math.floor(loanTimeDiff / (1000 * 3600 * 24 * 7)) + 1;
            let missedWeeksCount = 0;
            for (let i = 1; i < currentLoanWeek; i++) {
                const weekStatus = getWeekPaymentStatus(loan, i, currentLoanWeek, false);
                if (weekStatus.status === 'missed' || weekStatus.status === 'partial') {
                    missedWeeksCount++;
                }
            }
            if (missedWeeksCount >= 2) {
                newLoansWithPenalty[loan.id] = true;
            }
        });

        const maxWeeks = filteredLoans.reduce((max, loan) => {
            const plan = loanPlans.find(p => p.id === loan.loanPlanId);
            const penalty = newLoansWithPenalty[loan.id] ? 1 : 0;
            return Math.max(max, plan ? plan.termInWeeks + penalty : 0);
        }, 0);


        const calculateTotals = (length: number, type: 'failures' | 'collected') => {
            return Array.from({ length }).map((_, i) => {
                const weekNumber = i + 1;
                return filteredLoans.reduce((total, loan) => {
                    const loanTimeDiff = todayDate.getTime() - new Date(loan.startDate).getTime();
                    const currentLoanWeek = Math.floor(loanTimeDiff / (1000 * 3600 * 24 * 7)) + 1;
                    const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek, newLoansWithPenalty[loan.id] || false);
                    const weeklyPayment = getWeeklyPaymentAmount(loan);

                    if (type === 'failures') {
                        if (weekStatus.status === 'missed') return total + weeklyPayment;
                        if (weekStatus.status === 'partial') return total + (weeklyPayment - weekStatus.amountPaid);
                    } else { // collected
                        if (weekStatus.status === 'paid' || weekStatus.status === 'partial') {
                           if (!weekStatus.isAssumedPaid) return total + weekStatus.amountPaid;
                        }
                        if (weekStatus.isAssumedPaid) return total + weeklyPayment;
                    }
                    return total;
                }, 0);
            });
        };

        const failures = calculateTotals(maxWeeks, 'failures');
        const collected = calculateTotals(maxWeeks, 'collected');

        const hasAssumed = filteredLoans.some(loan => {
            if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return false;
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!loanPlan) return false;
            const loanTimeDiff = todayDate.getTime() - new Date(loan.startDate).getTime();
            const currentLoanWeek = Math.floor(loanTimeDiff / (1000 * 3600 * 24 * 7)) + 1;
            if (currentLoanWeek <= 0 || currentLoanWeek > loanPlan.termInWeeks) return false;
            const paymentExists = loan.payments.some(p => p.weekNumber === currentLoanWeek);
            return !paymentExists;
        });

        return { currentGroupWeek, weeklyFailures: failures, weeklyCollected: collected, hasAssumedPayments: hasAssumed, loansWithPenalty: newLoansWithPenalty };

    }, [dataLoading, filteredLoans, loanPlans, clients]);


    const getWeekPaymentStatus = (loan: Loan, weekNumber: number, currentLoanWeek: number): { status: 'paid' | 'partial' | 'missed' | 'pending'; date: Date; amountPaid: number; isAssumedPaid: boolean; } => {
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
        
        const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);
        const hasPenalty = loansWithPenalty[loan.id] || false;
        const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);
        
        if ((loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') && weekNumber <= termInWeeks) {
            return { status: 'paid' as const, date: new Date(), amountPaid: weeklyPaymentAmount, isAssumedPaid: false };
        }
    
        const loanStartDate = new Date(loan.startDate);
        
        // Payment is expected the following week
        const weekDate = new Date(loanStartDate.getTime());
        weekDate.setUTCDate(weekDate.getUTCDate() + (weekNumber * 7));

        
        const isFuture = new Date() < weekDate;
        if (isFuture) {
          return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
        }
        
        const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
        const totalPaidForWeek = paymentForWeek?.amount || 0;
    
        if (weekNumber === currentLoanWeek && !paymentForWeek) {
            return { status: 'paid' as const, date: weekDate, amountPaid: 0, isAssumedPaid: true };
        }
    
        if (totalPaidForWeek > 0) {
            if(totalPaidForWeek >= weeklyPaymentAmount) {
                return { status: 'paid' as const, date: weekDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
            } else {
                return { status: 'partial' as const, date: weekDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
            }
        } else {
            if (weekNumber < currentLoanWeek) {
                return { status: 'missed' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
            }
            return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
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

    const handleAccumulatePayments = async () => {
        setIsAccumulating(true);
        try {
            const result = await accumulateAssumedPaymentsAction(filteredLoans, loanPlans, clients);
            if (result.success) {
                toast({
                    title: 'Proceso Completado',
                    description: result.message,
                });
                // router.refresh() is not needed, real-time updates will handle it
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Acumular',
                description: error.message,
            });
        } finally {
            setIsAccumulating(false);
        }
    };

    const handleExportPDF = () => {
        if (filteredLoans.length === 0 || !selectedWeek) return;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;

        const maxWeeksToShow = filteredLoans.reduce((max, loan) => {
            const plan = loanPlans.find(p => p.id === loan.loanPlanId);
            const penalty = loansWithPenalty[loan.id] ? 1 : 0;
            const term = plan ? plan.termInWeeks + penalty : 0;
            return Math.max(max, term);
        }, 0);


        // --- Header ---
        const { promotoraName, localidadName, plazaName } = getHierarchy(selectedPromotora);
        
        const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.amount, 0);

        const groupStartDate = new Date(selectedWeek);

        let latestVencimientoDate = new Date(0);
        filteredLoans.forEach(loan => {
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (loanPlan) {
                const loanGroupStartDate = new Date(loan.startDate);
                const termInWeeks = loanPlan.termInWeeks + (loansWithPenalty[loan.id] ? 1 : 0);
                
                // Vence date should be the date of the last payment, not after
                const lastPaymentDay = new Date(loanGroupStartDate);
                lastPaymentDay.setUTCDate(loanGroupStartDate.getUTCDate() + (termInWeeks * 7));

                if (lastPaymentDay > latestVencimientoDate) {
                    latestVencimientoDate = lastPaymentDay;
                }
            }
        });


        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, 30);
        doc.text('Promotora', margin, 42);
        doc.text('Localidad', margin, 54);
        doc.text('Plaza', margin, 66);
        
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(groupStartDate.toISOString()), margin + 50, 30);
        doc.text(promotoraName.toUpperCase(), margin + 50, 42);
        doc.text(localidadName.toUpperCase(), margin + 50, 54);
        doc.text(plazaName.toUpperCase(), margin + 50, 66);

        const rightColumnX = pageWidth - margin - 100;
        doc.setFont('helvetica', 'bold');
        doc.text('Vence', rightColumnX, 30);
        doc.text('Plaza', rightColumnX, 42);
        doc.text('Cantidad', rightColumnX, 54);

        doc.setFont('helvetica', 'normal');
        doc.text(latestVencimientoDate > new Date(0) ? formatDate(latestVencimientoDate.toISOString()) : 'N/A', rightColumnX + 50, 30);
        doc.text(plazaName.toUpperCase(), rightColumnX + 50, 42);
        doc.text(formatCurrency(totalAmount), rightColumnX + 50, 54);

        // --- Table ---
        const tableHeaders: any[] = [
            { content: 'CLIENTE' },
            { content: 'ABONA' },
        ];
        
        for (let i = 0; i < maxWeeksToShow; i++) {
            tableHeaders.push({ content: '' }); // Placeholder for custom drawing
        }
        tableHeaders.push({ content: 'AVAL' });

        const tableData = filteredLoans.map(loan => {
            const client = getClient(loan.clientId);
            const weeklyPayment = getWeeklyPaymentAmount(loan);
            
            const clientInfo = client ? `${client.name}\n${client.street || ''}, ${client.neighborhood || ''}\n${client.phone || ''}` : '';

            let avalInfo = '';
            if (client?.endorsement) {
                const match = client.endorsement.match(/(.*) \((.*)\)/);
                if (match) {
                    const avalName = match[1];
                    const avalDetails = match[2];
                    avalInfo = `${avalName}\n${avalDetails}`;
                } else {
                    avalInfo = client.endorsement;
                }
            }
            
            const rowData: any[] = [
                { content: clientInfo, styles: { fontSize: 6.5 } },
                { content: formatCurrencySimple(weeklyPayment), styles: { fontSize: 6.5, fontStyle: 'bold' } },
            ];
            
            for (let i = 0; i < maxWeeksToShow; i++) {
                rowData.push(''); // Placeholder, content will be drawn in didDrawCell
            }
            
            rowData.push({ content: avalInfo, styles: { fontSize: 6.5 } });

            return rowData;
        });

        const weeklyFailuresPDF = Array.from({ length: maxWeeksToShow }).map((_, i) => {
            const weekNumber = i + 1;
            return filteredLoans.reduce((total, loan) => {
                const pdfToday = new Date();
                const loanStartDate = new Date(loan.startDate);
                const timeDiff = pdfToday.getTime() - loanStartDate.getTime();
                const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;

                const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
                const weeklyPayment = getWeeklyPaymentAmount(loan);
                if (weekStatus.status === 'missed') return total + weeklyPayment;
                if (weekStatus.status === 'partial') return total + (weeklyPayment - weekStatus.amountPaid);
                return total;
            }, 0);
        });

        const weeklyCollectedPDF = Array.from({ length: maxWeeksToShow }).map((_, i) => {
            const weekNumber = i + 1;
            return filteredLoans.reduce((total, loan) => {
                 const pdfToday = new Date();
                const loanStartDate = new Date(loan.startDate);
                const timeDiff = pdfToday.getTime() - loanStartDate.getTime();
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
                if(loanPlan && i + 1 <= (loanPlan.termInWeeks + (loansWithPenalty[loan.id] ? 1 : 0))) {
                    return total + getWeeklyPaymentAmount(loan);
                }
                return total;
            }, 0);
            footerRow1.push({ content: weeklyTotal > 0 ? formatCurrencySimple(weeklyTotal) : '', styles: { fontStyle: 'bold', halign: 'right' } });
            footerRow2.push({ content: weeklyFailuresPDF[i] > 0 ? formatCurrencySimplePDF(weeklyFailuresPDF[i]) : '', styles: { fontStyle: 'bold', halign: 'right', fillColor: '#e0e0e0' } });
            footerRow3.push({ content: weeklyCollectedPDF[i] > 0 ? formatCurrencySimplePDF(weeklyCollectedPDF[i]) : '', styles: { fontStyle: 'bold', halign: 'right' } });
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
                fontSize: 6.5,
                cellPadding: 1,
                valign: 'middle',
            },
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'top',
                minCellHeight: 50,
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                valign: 'middle',
                fontSize: 6.5,
            },
            columnStyles: {
                0: { cellWidth: 100, fontSize: 6.5 },
                1: { cellWidth: 40, halign: 'right', fontStyle: 'bold', fontSize: 8, textColor: [0, 0, 0] },
                ...Object.fromEntries(Array.from({ length: maxWeeksToShow }).map((_, i) => [i + 2, { cellWidth: 'auto' }])),
                [maxWeeksToShow + 2]: { cellWidth: 100, fontSize: 6.5 },
            },
            didDrawCell: (data) => {
                if (data.row.section === 'head' && data.column.index >= 2 && data.column.index < (2 + maxWeeksToShow)) {
                    data.cell.text = []; // Clear original text to prevent duplication

                    const weekNumber = data.column.index - 1;
                    
                    const groupStartDate = new Date(selectedWeek!);

                    // Logic: Find Saturday of the loan start week, then add 7 days to get the first payment Saturday.
                    const groupStartDayUTC = groupStartDate.getUTCDay(); // 0=Sun, 6=Sat
                    const daysToFirstPaymentSaturday = 7 + (6 - groupStartDayUTC);
                    
                    const firstPaymentSaturday = new Date(groupStartDate);
                    firstPaymentSaturday.setUTCDate(groupStartDate.getUTCDate() + daysToFirstPaymentSaturday);
                    
                    // Now, find the date for the current column's week
                    const headerDate = new Date(firstPaymentSaturday);
                    headerDate.setUTCDate(firstPaymentSaturday.getUTCDate() + (weekNumber - 1) * 7);

                    const pad = (num: number) => num.toString().padStart(2, '0');
                    const day = pad(headerDate.getUTCDate());
                    const month = pad(headerDate.getUTCMonth() + 1);
                    const year = headerDate.getUTCFullYear().toString().slice(-2);
                    const formattedDate = `${day}/${month}/${year}`;
                    
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(0, 0, 0);
                    const title = `S${weekNumber}`;
                    const titleWidth = doc.getTextWidth(title);
                    const titleX = data.cell.x + (data.cell.width - titleWidth) / 2;
                    doc.text(title, titleX, data.cell.y + 12);
            
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'normal');
                    const dateX = data.cell.x + data.cell.width / 2; 
                    const dateY = data.cell.y + data.cell.height - 5; 
                    doc.text(formattedDate, dateX, dateY, { angle: 90, align: 'center' });
                }
                
                const loan = filteredLoans[data.row.index];
                if (!loan || data.row.section !== 'body') return;

                const timeDiff = new Date().getTime() - new Date(loan.startDate).getTime();
                const currentWeekForLoan = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
                
                if (data.column.index >= 2 && data.column.index < (2 + maxWeeksToShow)) {
                    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                    const weekNumber = data.column.index - 1;
                    const hasPenalty = loansWithPenalty[loan.id] || false;
                    const termInWeeks = loanPlan ? loanPlan.termInWeeks + (hasPenalty ? 1 : 0) : 0;
                    
                    if (!loanPlan || weekNumber > termInWeeks) return;
                    
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
                            doc.setFontSize(6);
                            doc.text(subtext, centerX, centerY + 5, { align: 'center' });
                        }
                    }
                }
            }
        });

        const weekDate = new Date(selectedWeek);
        const formattedDate = formatDateFns(weekDate, 'dd-MM-yyyy');
        
        const fileName = `${plazaName} - ${localidadName} - ${promotoraName} - ${formattedDate}.pdf`;

        doc.save(fileName);
    };

    if (dataLoading) {
        return <Loading />;
    }

    const handlePlazaChange = (plazaId: string) => {
        setSelectedPlaza(plazaId);
        setSelectedLocalidad('');
        setSelectedPromotora('');
        setSelectedWeek(null);
    };

    const handleLocalidadChange = (localidadId: string) => {
        setSelectedLocalidad(localidadId);
        setSelectedPromotora('');
        setSelectedWeek(null);
        setSelectedWeek(null);
    };

    const handlePromotoraChange = (promotoraId: string) => {
        setSelectedPromotora(promotoraId);
        setSelectedWeek(null); // Reset week selection
    };

  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedPlaza} onValueChange={handlePlazaChange}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecciona Plaza" /></SelectTrigger>
              <SelectContent>
                  {plazas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
          </Select>
          <Select value={selectedLocalidad} onValueChange={handleLocalidadChange} disabled={!selectedPlaza}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecciona Localidad" /></SelectTrigger>
              <SelectContent>
                  {filteredLocalidades.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
          </Select>
          <Select value={selectedPromotora} onValueChange={handlePromotoraChange} disabled={!selectedLocalidad}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Selecciona Promotora" /></SelectTrigger>
              <SelectContent>
                  {filteredPromotoras.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportPDF} disabled={filteredLoans.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar a PDF
            </Button>
            <CreateLoanDialog
              clients={clients}
              loanPlans={loanPlans}
              loans={loans}
              plazas={plazas}
              localidades={localidades}
              promotoras={promotoras}
              initialSelection={{
                plazaId: selectedPlaza,
                localidadId: selectedLocalidad,
                promotoraId: selectedPromotora,
              }}
             />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
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
                            disabled={!selectedPromotora}
                        >
                            {formatDate(week)}
                        </Button>
                    ))}
                    {selectedPromotora && loanWeeks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center p-4">No hay préstamos para esta promotora.</p>
                    )}
                    {!selectedPromotora && <p className="text-sm text-muted-foreground text-center p-4">Selecciona una promotora para ver las semanas.</p>}
                </div>
            </CardContent>
        </Card>

        {/* Loans Table */}
        <Card>
          <CardHeader className="flex flex-row justify-between items-start p-4">
            <div>
                <CardTitle>Préstamos de la Semana</CardTitle>
                <CardDescription>
                {selectedWeek
                    ? `Mostrando ${filteredLoans.length} préstamos para la semana del ${formatDate(selectedWeek)}.`
                    : 'Selecciona una promotora y una semana para ver los préstamos.'
                }
                </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TooltipProvider>
              <ScrollArea className="w-full whitespace-nowrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 w-[200px] p-2">Cliente</TableHead>
                      <TableHead className="p-2">Abono</TableHead>
                      <TableHead className="p-2">Estado</TableHead>
                      {Array.from({ length: 16 }, (_, i) => {
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
                        const originalLoanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                        
                        if (!originalLoanPlan) return null;

                        const today = new Date();
                        const timeDiff = today.getTime() - new Date(loan.startDate).getTime();
                        const currentLoanWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;

                        const hasPenalty = loansWithPenalty[loan.id] || false;
                        const termInWeeks = originalLoanPlan.termInWeeks + (hasPenalty ? 1 : 0);
                        const weeklyPayment = getWeeklyPaymentAmount(loan);
                        
                        return (
                        <TableRow key={loan.id} className="bg-card">
                          <TableCell className="font-medium sticky left-0 z-10 w-[200px] p-2 bg-inherit">
                            <Link href={`/dashboard/clients/${loan.clientId}`} className="hover:underline">
                              {getClientName(loan.clientId)}
                            </Link>
                          </TableCell>
                          <TableCell className="p-2">{formatCurrency(weeklyPayment)}</TableCell>
                          <TableCell className="p-2">
                            <Badge variant={getStatusVariant(loan.status)}>{translateStatus(loan.status)}</Badge>
                          </TableCell>
                           {Array.from({ length: 16 }).map((_, i) => {
                                const weekNumber = i + 1;
                                const isCurrentWeek = weekNumber === currentLoanWeek;
                                const isPenaltyWeek = hasPenalty && weekNumber === termInWeeks;

                                if (weekNumber > termInWeeks) {
                                    return <TableCell key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")} />;
                                }
                                
                                const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
                                const canRegisterPayment = (loan.status !== 'Paid Off' && loan.status !== 'Pagado desde CV') && (weekStatus.status !== 'pending');

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
                                    <TableCell key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30", isPenaltyWeek && "bg-orange-100 dark:bg-orange-900/30")}>
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
                                                <p>Semana {weekNumber} {isPenaltyWeek && <span className='font-bold text-orange-500'>(Semana Extra)</span>}</p>
                                                <p>(Inicia: {formatDate(weekStatus.date.toISOString())})</p>
                                                <p>Estado: {statusInfo.text}</p>
                                                {statusInfo.paid && <p>{statusInfo.paid}</p>}
                                                {statusInfo.pending && <p className="text-destructive">{statusInfo.pending}</p>}
                                                {canRegisterPayment ? <p className="text-xs text-primary">Clic para registrar abono</p> : loan.status === 'Paid Off' || loan.status === 'Pagado desde CV' ? <p className="text-xs text-muted-foreground">Préstamo liquidado</p> : <p className="text-xs text-muted-foreground">No se puede registrar pago.</p>}
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
                               {selectedPromotora ? "No hay préstamos para la semana y promotora seleccionada." : "Selecciona una promotora para comenzar."}
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                  {filteredLoans.length > 0 && weeklyFailures.length > 0 && weeklyCollected.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="sticky left-0 bg-inherit p-1 font-semibold text-right">Total a Cobrar</TableCell>
                            {Array.from({ length: 16 }).map((_, i) => {
                                const weekNumber = i + 1;
                                const isCurrentWeek = weekNumber === currentGroupWeek;
                                const weeklyTotal = filteredLoans.reduce((total, loan) => {
                                    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                                    if(loanPlan && i + 1 <= (loanPlan.termInWeeks + (loansWithPenalty[loan.id] ? 1 : 0))) {
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
                          <TableCell colSpan={3} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-destructive">Falla</TableCell>
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
                            <TableCell colSpan={3} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-blue-600">Cobrado</TableCell>
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
           {filteredLoans.length > 0 && (
                <CardFooter className="justify-end p-2 border-t">
                    <Button 
                        onClick={handleAccumulatePayments} 
                        disabled={!hasAssumedPayments || isAccumulating}
                    >
                        {isAccumulating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {isAccumulating ? 'Acumulando...' : 'Acumular Pagos de la Semana'}
                    </Button>
                </CardFooter>
            )}
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
            onPaymentRegistered={() => {
                // No need to call router.refresh(), real-time updates handle it.
            }}
        />
    }
    </>
  );
}
