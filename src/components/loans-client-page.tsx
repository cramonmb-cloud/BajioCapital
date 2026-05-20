'use client';

import { useState, useEffect, useMemo } from 'react';
import { MoreHorizontal, CheckCircle2, XCircle, Circle, AlertCircle, FileDown, Loader2, CalendarCog, BadgeDollarSign, Filter, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Client, Loan, LoanPlan, Payment, Plaza, Localidad, Promotora, AppUser } from '@/lib/types';
import { RegisterPaymentDialog } from './register-payment-dialog';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { UserOptions } from 'jspdf-autotable';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { accumulateAssumedPaymentsAction, changeLoansDateAction, payOffLoanAction, revertPaymentsForWeekAction } from '@/app/dashboard/actions';
import { format as formatDateFns } from 'date-fns';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import Loading from '../app/dashboard/loading';
import { Checkbox } from './ui/checkbox';


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: UserOptions) => jsPDF;
}


// Helper to get the Saturday of the week for a given date
const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0); // Normalize time
  const day = date.getUTCDay(); // Sunday = 0, Saturday = 6
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
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<string>>(new Set());
  const { appUser } = useAuth();
  const [isAccumulating, setIsAccumulating] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isChangingDate, setIsChangingDate] = useState(false);
  const [isPayingOff, setIsPayingOff] = useState(false);
  const [loanToPayOff, setLoanToPayOff] = useState<Loan | null>(null);
  const [changeDateDialogOpen, setChangeDateDialogOpen] = useState(false);
  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [targetWeek, setTargetWeek] = useState<string>('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const { toast } = useToast();
  const [paymentDialogData, setPaymentDialogData] = useState<{
    weekNumber: number;
    weekDate: Date;
    initialAmount: number;
  } | null>(null);
  const router = useRouter();

  const sortedPlazas = useMemo(() => [...plazas].sort((a, b) => a.name.localeCompare(b.name)), [plazas]);
  const filteredLocalidades = useMemo(() => localidades.filter(l => l.plazaId === selectedPlaza).sort((a, b) => a.name.localeCompare(b.name)), [localidades, selectedPlaza]);
  const filteredPromotoras = useMemo(() => promotoras.filter(p => p.localidadId === selectedLocalidad).sort((a, b) => a.name.localeCompare(b.name)), [promotoras, selectedLocalidad]);
  
  // Logic to determine if a loan is ACTIVE (Not expired and not paid)
  const isLoanActive = (loan: Loan) => {
    if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return false;
    
    const plan = loanPlans.find(p => p.id === loan.loanPlanId);
    if (!plan) return false;

    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

    const weeklyPayment = (loan.amount / 1000) * plan.weeklyPaymentRate;
    let missedWeeksCount = 0;
    for (let i = 1; i < currentLoanWeek; i++) {
        const p = loan.payments.find(pay => pay.weekNumber === i);
        if (p && p.amount < weeklyPayment) missedWeeksCount++;
    }

    const term = plan.termInWeeks + (missedWeeksCount >= 2 ? 1 : 0);
    return currentLoanWeek <= term;
  };

  const loanWeeks = useMemo(() => 
    Array.from(
      new Set(
        loans
          .filter(l => l.promotoraId === selectedPromotora && isLoanActive(l))
          .map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString())
      )
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  , [loans, selectedPromotora, loanPlans]);
  
  const allLoanWeeksInSystem = useMemo(() =>
    Array.from(
      new Set(loans.filter(isLoanActive).map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString()))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  , [loans, loanPlans]);


  const filteredLoans = useMemo(() => loans.filter(loan => {
    const isCorrectWeek = selectedWeek ? getSaturdayOfWeek(new Date(loan.startDate)).toISOString() === selectedWeek : false;
    const isCorrectPromotora = selectedPromotora ? loan.promotoraId === selectedPromotora : false;
    return isCorrectWeek && isCorrectPromotora && isLoanActive(loan);
  }), [loans, selectedWeek, selectedPromotora, loanPlans]);

  
  useEffect(() => {
    setSelectedLoanIds(new Set());
  }, [selectedWeek, selectedPromotora]);

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

    const {
        currentGroupWeek,
        weeklyFailures,
        weeklyCollected,
        hasAssumedPayments,
        hasPaymentsToRevert,
        loansWithPenalty
    } = useMemo(() => {
        if (dataLoading || filteredLoans.length === 0) {
            return {
                currentGroupWeek: 0,
                weeklyFailures: [],
                weeklyCollected: [],
                hasAssumedPayments: false,
                hasPaymentsToRevert: false,
                loansWithPenalty: {}
            };
        }
        
        const todayDate = new Date();
        const firstLoanStartDate = new Date(filteredLoans[0].startDate);
        const timeDiff = todayDate.getTime() - firstLoanStartDate.getTime();
        const currentGroupWeek = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
        
        const newLoansWithPenalty: Record<string, boolean> = {};

        const getWeekPaymentStatusInternal = (loan: Loan, weekNumber: number, currentLoanWeek: number, penalty: boolean) => {
          const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
          if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
          
          const weeklyPaymentAmount = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
          const termInWeeks = loanPlan.termInWeeks + (penalty ? 1 : 0);
          
          if ((loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') && weekNumber <= termInWeeks) {
              const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
              const paidAmount = paymentForWeek ? paymentForWeek.amount : weeklyPaymentAmount;
              return { status: 'paid' as const, date: new Date(), amountPaid: paidAmount, isAssumedPaid: false };
          }
          
          const loanStartDate = new Date(loan.startDate);
          const weekDate = new Date(loanStartDate.getTime());
          weekDate.setUTCDate(weekDate.getUTCDate() + (weekNumber * 7));

          const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
          
          if (paymentForWeek) {
              const totalPaidForWeek = paymentForWeek.amount;
              if (totalPaidForWeek >= weeklyPaymentAmount) {
                  return { status: 'paid' as const, date: new Date(), amountPaid: totalPaidForWeek, isAssumedPaid: false };
              } else {
                  return { status: 'partial' as const, date: weekDate, amountPaid: totalPaidForWeek, isAssumedPaid: false };
              }
          }

          if (weekNumber <= currentLoanWeek) {
            return { status: 'paid' as const, date: weekDate, amountPaid: 0, isAssumedPaid: true };
          }

          return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
        };

        filteredLoans.forEach(loan => {
            const loanTimeDiff = todayDate.getTime() - new Date(loan.startDate).getTime();
            const currentLoanWeek = Math.floor(loanTimeDiff / (1000 * 3600 * 24 * 7)) + 1;
            let missedWeeksCount = 0;
            for (let i = 1; i < currentLoanWeek; i++) {
                const paymentForWeek = loan.payments.find(p => p.weekNumber === i);
                if (!paymentForWeek) continue;

                const weeklyPayment = getWeeklyPaymentAmount(loan);
                if (paymentForWeek.amount < weeklyPayment) {
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
                    
                    const weekStatus = getWeekPaymentStatusInternal(loan, weekNumber, currentLoanWeek, newLoansWithPenalty[loan.id] || false);
                    const weeklyPayment = getWeeklyPaymentAmount(loan);

                    if (type === 'failures') {
                        const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
                        if (paymentForWeek && paymentForWeek.amount < weeklyPayment) {
                            return total + (weeklyPayment - paymentForWeek.amount);
                        }
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
            const rawCurrentLoanWeek = Math.floor(loanTimeDiff / (1000 * 3600 * 24 * 7)) + 1;
            
            let missedCount = 0;
            const wp = getWeeklyPaymentAmount(loan);
            for (let i = 1; i < rawCurrentLoanWeek; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p && p.amount < wp) missedCount++;
            }
            const term = loanPlan.termInWeeks + (missedCount >= 2 ? 1 : 0);
            const currentWeek = Math.min(rawCurrentLoanWeek, term);

            for (let w = 1; w <= currentWeek; w++) {
                const exists = (loan.payments || []).some(p => p.weekNumber === w);
                if (!exists) return true;
            }
            return false;
        });

        // Detect if any loan in this sheet has a payment record for the currentGroupWeek
        const hasRevertible = filteredLoans.some(loan => 
            (loan.payments || []).some(p => p.weekNumber === currentGroupWeek)
        );

        return { currentGroupWeek, weeklyFailures: failures, weeklyCollected: collected, hasAssumedPayments: hasAssumed, hasPaymentsToRevert: hasRevertible, loansWithPenalty: newLoansWithPenalty };

    }, [dataLoading, filteredLoans, loanPlans, clients]);


    const getWeekPaymentStatus = (loan: Loan, weekNumber: number, currentLoanWeek: number): { status: 'paid' | 'partial' | 'missed' | 'pending'; date: Date; amountPaid: number; isAssumedPaid: boolean; } => {
        const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
        if (!loanPlan) return { status: 'pending' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
        
        const weeklyPaymentAmount = getWeeklyPaymentAmount(loan);
        const hasPenalty = loansWithPenalty[loan.id] || false;
        const termInWeeks = loanPlan.termInWeeks + (hasPenalty ? 1 : 0);
        
        const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
        
        if (paymentForWeek) {
            const totalPaidForWeek = paymentForWeek.amount;
            if(totalPaidForWeek >= weeklyPaymentAmount) {
                return { status: 'paid' as const, date: new Date(), amountPaid: totalPaidForWeek, isAssumedPaid: false };
            } else if (totalPaidForWeek > 0) {
                return { status: 'partial' as const, date: new Date(), amountPaid: totalPaidForWeek, isAssumedPaid: false };
            } else { // amount is 0
                return { status: 'missed' as const, date: new Date(), amountPaid: 0, isAssumedPaid: false };
            }
        }

        if ((loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') && weekNumber <= termInWeeks) {
            return { status: 'paid' as const, date: new Date(), amountPaid: weeklyPaymentAmount, isAssumedPaid: false };
        }
    
        const loanStartDate = new Date(loan.startDate);
        const weekDate = new Date(loanStartDate.getTime());
        weekDate.setUTCDate(weekDate.getUTCDate() + (weekNumber * 7));

        const isFuture = new Date() < weekDate;
        if (isFuture) {
          return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
        }
        
        if (weekNumber <= currentLoanWeek) {
            return { status: 'paid' as const, date: weekDate, amountPaid: 0, isAssumedPaid: true };
        }
        
        return { status: 'pending' as const, date: weekDate, amountPaid: 0, isAssumedPaid: false };
    };

    const handleRegisterPaymentClick = (loan: Loan, weekNumber: number, weekStatus: ReturnType<typeof getWeekPaymentStatus>) => {
        const weeklyPayment = getWeeklyPaymentAmount(loan);
        let initialAmount = weeklyPayment;

        if (weekStatus.status === 'partial') {
            initialAmount = weeklyPayment - weekStatus.amountPaid;
        } else if (weekStatus.status === 'missed') {
            initialAmount = weeklyPayment;
        } else if (weekStatus.status === 'paid' && weekStatus.isAssumedPaid) {
            initialAmount = weeklyPayment;
        } else if (weekStatus.status === 'paid' && !weekStatus.isAssumedPaid) {
            initialAmount = weekStatus.amountPaid;
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
        if (filteredLoans.length === 0) return;
        
        setIsAccumulating(true);
        try {
            const loanIds = filteredLoans.map(l => l.id);
            const result = await accumulateAssumedPaymentsAction(loanIds, appUser?.id);
            if (result && result.success) {
                toast({
                    title: 'Proceso Completado',
                    description: result.message,
                });
            } else {
                throw new Error(result?.message || 'Ocurrió un error inesperado al acumular pagos.');
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

    const handleRevertPayments = async () => {
        if (filteredLoans.length === 0 || currentGroupWeek <= 0) return;
        
        setIsReverting(true);
        try {
            const loanIds = filteredLoans.map(l => l.id);
            const result = await revertPaymentsForWeekAction(loanIds, currentGroupWeek, appUser?.id);
            if (result && result.success) {
                toast({
                    title: 'Reversión Completada',
                    description: result.message,
                });
                setRevertDialogOpen(false);
            } else {
                throw new Error(result?.message || 'Ocurrió un error al intentar pasar a pendiente.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Revertir',
                description: error.message,
            });
        } finally {
            setIsReverting(false);
        }
    };

    const handleChangeDate = async () => {
        if (!targetWeek || selectedLoanIds.size === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una semana de destino y al menos un préstamo.' });
            return;
        }
        setIsChangingDate(true);
        try {
            const loanIds = Array.from(selectedLoanIds);
            const result = await changeLoansDateAction(loanIds, targetWeek);
            if (result.success) {
                toast({ title: 'Éxito', description: result.message });
                setChangeDateDialogOpen(false);
                setSelectedWeek(targetWeek);
                setSelectedLoanIds(new Set());
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsChangingDate(false);
        }
    };

    const handlePayOffLoan = async () => {
        if (!loanToPayOff) return;
        setIsPayingOff(true);
        try {
            const result = await payOffLoanAction(loanToPayOff.id, appUser?.id);
            if (result.success) {
                toast({
                    title: 'Préstamo Liquidado',
                    description: result.message,
                });
                setLoanToPayOff(null);
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Error al Liquidar',
                description: error.message,
            });
        } finally {
            setIsPayingOff(false);
        }
    };


    const handleExportPDF = () => {
        if (filteredLoans.length === 0 || !selectedWeek) return;

        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const topMargin = 60;
        const margin = 30;

        const maxWeeksToShow = 16;

        const { promotoraName, localidadName, plazaName } = getHierarchy(selectedPromotora);
        
        const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.amount, 0);

        const groupStartDate = new Date(selectedWeek);

        let latestVencimientoDate = new Date(0);
        filteredLoans.forEach(loan => {
            const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (loanPlan) {
                const loanGroupStartDate = getSaturdayOfWeek(new Date(loan.startDate));
                loanGroupStartDate.setUTCDate(loanGroupStartDate.getUTCDate() + 7);
                const termInWeeks = loanPlan.termInWeeks + (loansWithPenalty[loan.id] ? 1 : 0);
                const lastPaymentDay = new Date(loanGroupStartDate);
                lastPaymentDay.setUTCDate(lastPaymentDay.getUTCDate() + (termInWeeks - 1) * 7);
                if (lastPaymentDay > latestVencimientoDate) {
                    latestVencimientoDate = lastPaymentDay;
                }
            }
        });


        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Fecha', margin, topMargin + 10);
        doc.text('Promotora', margin, topMargin + 22);
        doc.text('Localidad', margin, topMargin + 34);
        doc.text('Plaza', margin, topMargin + 46);
        
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(groupStartDate.toISOString()), margin + 50, topMargin + 10);
        doc.text(promotoraName.toUpperCase(), margin + 50, topMargin + 22);
        doc.text(localidadName.toUpperCase(), margin + 50, topMargin + 34);
        doc.text(plazaName.toUpperCase(), margin + 50, topMargin + 46);

        const rightColumnX = pageWidth - margin - 100;
        doc.setFont('helvetica', 'bold');
        doc.text('Vence', rightColumnX, topMargin + 10);
        doc.text('Plaza', rightColumnX, topMargin + 22);
        doc.text('Cantidad', rightColumnX, topMargin + 34);

        doc.setFont('helvetica', 'normal');
        doc.text(latestVencimientoDate > new Date(0) ? formatDate(latestVencimientoDate.toISOString()) : 'N/A', rightColumnX + 50, topMargin + 10);
        doc.text(plazaName.toUpperCase(), rightColumnX + 50, topMargin + 22);
        doc.text(formatCurrency(totalAmount), rightColumnX + 50, topMargin + 34);

        const weekDatesHeader = Array.from({ length: maxWeeksToShow }).map((_, i) => {
            const weekNumber = i + 1;
            const groupStartDate = getSaturdayOfWeek(new Date(selectedWeek!));
            const firstPaymentSaturday = new Date(groupStartDate);
            firstPaymentSaturday.setUTCDate(groupStartDate.getUTCDate() + 7);
            const headerDate = new Date(firstPaymentSaturday);
            headerDate.setUTCDate(firstPaymentSaturday.getUTCDate() + (weekNumber - 1) * 7);

            const day = String(headerDate.getUTCDate()).padStart(2, '0');
            const month = String(headerDate.getUTCMonth() + 1).padStart(2, '0');
            const year = headerDate.getUTCFullYear().toString().slice(-2);
            
            return `${day}\n${month}\n${year}`;
        });

        const tableHeaders: any[] = [
            [
                { content: '', colSpan: 3, styles: { fillColor: [220, 220, 220] } },
                ...Array.from({ length: maxWeeksToShow }).map((_, i) => ({ 
                    content: `S${i + 1}`, 
                    styles: { halign: 'center', valign: 'middle', fontSize: 9, minCellHeight: 20 } 
                })),
                { content: '', colSpan: 1, styles: { fillColor: [220, 220, 220] } },
            ],
            [
                { content: 'CLIENTE', styles: { valign: 'middle', halign: 'center', fontSize: 8 } },
                { content: 'PRESTAMO', styles: { valign: 'middle', halign: 'center', fontSize: 8 } },
                { content: 'A\nB\nO\nN\nA', styles: { valign: 'middle', halign: 'center', fontSize: 7, fontStyle: 'bold' } }, 
                ...weekDatesHeader.map(dateStr => ({ 
                    content: dateStr, 
                    styles: { minCellHeight: 50, halign: 'center', valign: 'middle', fontSize: 7, textColor: [0, 0, 0] } 
                })),
                { content: 'AVAL', styles: { valign: 'middle', halign: 'center', fontSize: 8 } },
            ]
        ];

        const tableData = filteredLoans.map(loan => {
            const client = getClient(loan.clientId);
            let clientText = '';
            if (client) {
                clientText = `${client.name.toUpperCase()}\n${client.street || ''}, ${client.neighborhood || ''}\n${client.phone || ''}`;
            }

            let avalText = '';
            if (client?.endorsement) {
                 const match = client.endorsement.match(/(.*) \((.*)\)/);
                if (match) {
                    avalText = `${match[1].toUpperCase()}\n${match[2]}`;
                } else {
                    avalText = client.endorsement.toUpperCase();
                }
            }

            return [
                clientText,
                { content: formatCurrencySimple(loan.amount), styles: { fontSize: 6.5, textColor: [0, 0, 0] } },
                { content: formatCurrencySimple(getWeeklyPaymentAmount(loan)), styles: { fontSize: 6.5, fontStyle: 'bold', textColor: [0, 0, 0] } },
                ...Array(maxWeeksToShow).fill(''),
                avalText,
            ];
        });

        const weeklyFailuresPDF = Array.from({ length: maxWeeksToShow }).map((_, i) => {
            const weekNumber = i + 1;
            return filteredLoans.reduce((total, loan) => {
                const weeklyPayment = getWeeklyPaymentAmount(loan);
                const paymentForWeek = loan.payments.find(p => p.weekNumber === weekNumber);
                if (paymentForWeek && paymentForWeek.amount < weeklyPayment) {
                    return total + (weeklyPayment - paymentForWeek.amount);
                }
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
        
        const totalAbonos = filteredLoans.reduce((sum, loan) => sum + getWeeklyPaymentAmount(loan), 0);
        
        const footerRow1 = [
            { content: `TOT. CLIENTES: ${filteredLoans.length}`, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: ``, styles: {} },
            { content: `TOTALES: ${formatCurrencySimple(totalAbonos)}`, styles: { fontStyle: 'bold', halign: 'right' } },
        ];
        const footerRow2 = [{content: 'FALLA', colSpan: 3, styles: {halign: 'right', fontStyle: 'bold', fillColor: '#e0e0e0'}}];
        const footerRow3 = [{content: 'COBRADO', colSpan: 3, styles: {halign: 'right', fontStyle: 'bold'}}];

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
        
        const clientColWidth = 100;
        const prestamoColWidth = 40;
        const abonaColWidth = 35;
        const avalColWidth = 100;
        const availableWidth = pageWidth - margin * 2 - clientColWidth - prestamoColWidth - abonaColWidth - avalColWidth;
        const weekColumnWidth = availableWidth / maxWeeksToShow;


        doc.autoTable({
            startY: topMargin + 60,
            head: tableHeaders,
            body: tableData,
            foot: footerRows,
            theme: 'grid',
            margin: { left: margin, right: margin },
            styles: {
                lineWidth: 0.5,
                lineColor: [0, 0, 0],
                fontSize: 6.5,
                cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
                valign: 'middle',
            },
            headStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                halign: 'center',
                valign: 'middle',
            },
            footStyles: {
                fillColor: [220, 220, 220],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                valign: 'middle',
                fontSize: 6.5,
            },
            columnStyles: {
                0: { cellWidth: clientColWidth, fontSize: 6.5 },
                1: { cellWidth: prestamoColWidth, halign: 'right', fontSize: 6.5 },
                2: { cellWidth: abonaColWidth, fontSize: 8, halign: 'center' },
                ...Object.fromEntries(Array.from({ length: maxWeeksToShow }).map((_, i) => [i + 3, { cellWidth: weekColumnWidth, halign: 'center' }])),
                [maxWeeksToShow + 3]: { cellWidth: avalColWidth, fontSize: 6.5 },
            },
            didDrawCell: (data) => {
                const loan = filteredLoans[data.row.index];
                if (!loan || data.row.section !== 'body') return;

                const timeDiff = new Date().getTime() - new Date(loan.startDate).getTime();
                const currentWeekForLoan = Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1;
                
                if (data.column.index >= 3 && data.column.index < (3 + maxWeeksToShow)) {
                    const loanPlan = loanPlans.find(p => p.id === loan.loanPlanId);
                    const weekNumber = data.column.index - 2;
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
    };

    const handlePromotoraChange = (promotoraId: string) => {
        setSelectedPromotora(promotoraId);
        setSelectedWeek(null);
    };

    const toggleAllLoansSelection = () => {
        if (selectedLoanIds.size === filteredLoans.length) {
            setSelectedLoanIds(new Set());
        } else {
            setSelectedLoanIds(new Set(filteredLoans.map(loan => loan.id)));
        }
    };

    const toggleLoanSelection = (loanId: string) => {
        const newSelection = new Set(selectedLoanIds);
        if (newSelection.has(loanId)) {
            newSelection.delete(loanId);
        } else {
            newSelection.add(loanId);
        }
        setSelectedLoanIds(newSelection);
    };


  return (
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
            {/* Mobile Filter Toggle */}
            <div className="md:hidden w-full">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                    className={cn(
                        "w-full flex justify-between items-center h-10 border-2 font-black uppercase text-[10px] tracking-widest",
                        isFiltersOpen ? "bg-zinc-100 border-zinc-300" : "bg-zinc-50"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-blue-600" />
                        Seleccionar Ubicación
                    </div>
                    {isFiltersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
            </div>

            <div className={cn(
                "flex flex-wrap items-center gap-2 w-full md:w-auto",
                !isFiltersOpen && "hidden md:flex"
            )}>
                <Select value={selectedPlaza} onValueChange={handlePlazaChange}>
                    <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Selecciona Plaza" /></SelectTrigger>
                    <SelectContent>
                        {sortedPlazas.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedLocalidad} onValueChange={handleLocalidadChange} disabled={!selectedPlaza}>
                    <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Selecciona Localidad" /></SelectTrigger>
                    <SelectContent>
                        {filteredLocalidades.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedPromotora} onValueChange={handlePromotoraChange} disabled={!selectedLocalidad}>
                    <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Selecciona Promotora" /></SelectTrigger>
                    <SelectContent>
                        {filteredPromotoras.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {appUser?.username === 'Cristobal' && (
                <Button variant="default" onClick={() => setChangeDateDialogOpen(true)} disabled={selectedLoanIds.size === 0} className='hidden sm:flex'>
                    <CalendarCog className="mr-2 h-4 w-4" />
                    Mover Fecha
                </Button>
            )}
            <Button variant="outline" onClick={handleExportPDF} disabled={filteredLoans.length === 0} className='flex-1 md:flex-none'>
                <FileDown className="mr-2 h-4 w-4" />
                PDF
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
                <CardTitle className="text-base uppercase font-black text-zinc-500 text-[10px] tracking-widest px-2">Semanas Activas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="px-2 pb-2">
                    <ScrollArea className={cn("md:h-auto", loanWeeks.length > 3 ? "h-64" : "h-auto")}>
                        <div className="flex flex-col gap-1.5 p-1.5 bg-muted/20 rounded-2xl border border-border/40 shadow-inner">
                            {loanWeeks.map((week) => {
                                const isSelected = selectedWeek === week;
                                return (
                                    <Button 
                                        key={week}
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start h-10 px-4 text-xs font-bold transition-all duration-300 rounded-full relative overflow-hidden active:scale-95",
                                            isSelected 
                                                ? "bg-blue-50 text-blue-900 shadow-md ring-1 ring-blue-200 -translate-y-[1px]" 
                                                : "text-muted-foreground hover:bg-background/50"
                                        )}
                                        onClick={() => setSelectedWeek(week)}
                                        disabled={!selectedPromotora}
                                    >
                                        <span className={cn(
                                            "transition-all duration-300",
                                            isSelected ? "opacity-100" : "opacity-80"
                                        )}>
                                            {formatDate(week)}
                                        </span>
                                        {isSelected && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                                        )}
                                    </Button>
                                )
                            })}
                        </div>
                    </ScrollArea>
                    {selectedPromotora && loanWeeks.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center p-4">No hay préstamos activos.</p>
                    )}
                    {!selectedPromotora && <p className="text-sm text-muted-foreground text-center p-4">Selecciona promotora.</p>}
                </div>
            </CardContent>
        </Card>

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
                      {appUser?.username === 'Cristobal' && (
                          <TableHead className="sticky left-0 bg-card z-10 w-auto p-2">
                              <Checkbox
                                  checked={selectedLoanIds.size > 0 && selectedLoanIds.size === filteredLoans.length}
                                  onCheckedChange={toggleAllLoansSelection}
                                  aria-label="Seleccionar todas las filas"
                                  disabled={filteredLoans.length === 0}
                              />
                          </TableHead>
                      )}
                      <TableHead className={cn("sticky bg-card z-10 w-[200px] p-2", appUser?.username === 'Cristobal' ? "left-10" : "left-0")}>Cliente</TableHead>
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
                        <TableRow key={loan.id} className="bg-card" data-state={selectedLoanIds.has(loan.id) && "selected"}>
                          {appUser?.username === 'Cristobal' && (
                              <TableCell className="sticky left-0 z-10 w-auto p-2 bg-inherit">
                                  <Checkbox
                                      checked={selectedLoanIds.has(loan.id)}
                                      onCheckedChange={() => toggleLoanSelection(loan.id)}
                                      aria-label="Seleccionar fila"
                                  />
                              </TableCell>
                          )}
                          <TableCell className={cn("font-medium sticky z-10 w-[200px] p-2 bg-inherit", appUser?.username === 'Cristobal' ? "left-10" : "left-0")}>
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
                                const isCurrentWeek = weekNumber === currentGroupWeek;
                                const isPenaltyWeek = hasPenalty && weekNumber === termInWeeks;

                                if (weekNumber > termInWeeks) {
                                    return <TableCell key={i} className={cn("text-center p-2 border-r", isCurrentWeek && "bg-blue-100 dark:bg-blue-900/30")} />;
                                }
                                
                                const weekStatus = getWeekPaymentStatus(loan, weekNumber, currentLoanWeek);
                                const canRegisterPayment = (loan.status !== 'Paid Off' && loan.status !== 'Pagado desde CV');

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
                                                {canRegisterPayment ? <p className="text-xs text-primary">Clic para registrar o editar abono</p> : loan.status === 'Paid Off' || loan.status === 'Pagado desde CV' ? <p className="text-xs text-muted-foreground">Préstamo liquidado</p> : <p className="text-xs text-muted-foreground">No se puede registrar pago.</p>}
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
                                {appUser?.username === 'Cristobal' && (
                                    <DropdownMenuItem onClick={() => setLoanToPayOff(loan)} className="text-blue-600 font-semibold">
                                        <BadgeDollarSign className="mr-2 h-4 w-4" />
                                        Liquidar Préstamo
                                    </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                        <TableRow>
                            <TableCell colSpan={21} className="text-center h-24 p-2">
                               {selectedPromotora ? "No hay préstamos activos para la semana y promotora seleccionada." : "Selecciona una promotora para comenzar."}
                            </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                  {filteredLoans.length > 0 && weeklyFailures.length > 0 && weeklyCollected.length > 0 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={appUser?.username === 'Cristobal' ? 4 : 3} className="sticky left-0 bg-inherit p-1 font-semibold text-right">Total a Cobrar</TableCell>
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
                          <TableCell colSpan={appUser?.username === 'Cristobal' ? 4 : 3} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-destructive">Falla</TableCell>
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
                            <TableCell colSpan={appUser?.username === 'Cristobal' ? 4 : 3} className="sticky left-0 bg-inherit p-1 font-semibold text-right text-blue-600">Cobrado</TableCell>
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
                <CardFooter className="justify-end p-2 border-t gap-2">
                    {appUser?.username === 'Cristobal' && hasPaymentsToRevert && (
                         <Button 
                            variant="outline"
                            onClick={() => setRevertDialogOpen(true)} 
                            disabled={isReverting}
                            className="text-orange-600 border-orange-200 hover:bg-orange-50"
                        >
                            {isReverting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : <RotateCcw className="mr-2 h-4 w-4" />}
                            Pasar a Pendiente
                        </Button>
                    )}
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
            }}
        />
    }

    <Dialog open={changeDateDialogOpen} onOpenChange={setChangeDateDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Cambiar Fecha del Grupo de Préstamos</DialogTitle>
                <DialogDescription>
                    Selecciona una nueva semana de inicio para los {selectedLoanIds.size} préstamos seleccionados. Esta acción es irreversible.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Select onValueChange={setTargetWeek} value={targetWeek}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona la nueva semana de destino" />
                    </SelectTrigger>
                    <SelectContent>
                        {allLoanWeeksInSystem
                            .filter(week => week !== selectedWeek)
                            .map(week => (
                                <SelectItem key={week} value={week}>
                                    {formatDate(week)}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setChangeDateDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleChangeDate} disabled={isChangingDate || !targetWeek}>
                    {isChangingDate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar Cambio de Fecha
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <AlertDialog open={!!loanToPayOff} onOpenChange={(open) => !open && setLoanToPayOff(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Liquidar préstamo completamente?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción registrará el abono total restante para {loanToPayOff ? getClientName(loanToPayOff.clientId) : ''} y cambiará el estado a **Pagado**. El dinero se sumará al saldo de la cartera.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handlePayOffLoan} disabled={isPayingOff} className="bg-blue-600 hover:bg-blue-700">
                    {isPayingOff ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgeDollarSign className="mr-2 h-4 w-4" />}
                    Confirmar Liquidación
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Revertir abonos de la semana?</AlertDialogTitle>
                <AlertDialogDescription>
                    Estás a punto de eliminar todos los pagos registrados para la **Semana {currentGroupWeek}** en este grupo. 
                    <br /><br />
                    El dinero correspondiente se restará automáticamente del saldo de la cartera. Esta acción es para corregir acumulaciones erróneas.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel disabled={isReverting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRevertPayments} disabled={isReverting} className="bg-orange-600 hover:bg-orange-700">
                    {isReverting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Confirmar Reversión
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
