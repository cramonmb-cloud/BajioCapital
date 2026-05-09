'use client';

import { useState, useMemo } from 'react';
import type { Loan, LoanPlan, AppUser, Plaza, Localidad, Promotora } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, ListTodo, PencilLine } from 'lucide-react';
import { EditLoanDialog } from '@/components/edit-loan-dialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ManualPaymentAdjustmentDialog } from '@/components/manual-payment-adjustment-dialog';


// Helper to get the Saturday of the week for a given date
const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0); // Normalize time
  const day = date.getUTCDay(); // Sunday = 0, Saturday = 6
  const diff = day === 0 ? -1 : 6 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
};


interface ClientLoansTableProps {
  clientLoans: Loan[];
  loanPlans: LoanPlan[];
  allLoans: Loan[];
  users: AppUser[];
  plazas: Plaza[];
  localidades: Localidad[];
  promotoras: Promotora[];
}

export function ClientLoansTable({ clientLoans, loanPlans, allLoans, users, plazas, localidades, promotoras }: ClientLoansTableProps) {
  const { appUser } = useAuth();
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loanForDetails, setLoanForDetails] = useState<Loan | null>(null);
  
  // State for manual adjustment
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [adjustData, setAdjustData] = useState<{ weekNumber: number, amount: number } | null>(null);

  const isCristobal = useMemo(() => appUser?.username.toUpperCase() === 'CRISTOBAL', [appUser]);
  const canEdit = useMemo(() => isCristobal, [isCristobal]);
  
  // Sort loans: Active/Overdue first, then by startDate descending
  const sortedLoans = useMemo(() => {
    return [...clientLoans].sort((a, b) => {
      const isAActive = a.status === 'Active' || a.status === 'Overdue';
      const isBActive = b.status === 'Active' || b.status === 'Overdue';
      
      if (isAActive && !isBActive) return -1;
      if (!isAActive && isBActive) return 1;
      
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [clientLoans]);

  const allLoanWeeks = useMemo(() => 
    Array.from(
      new Set(allLoans.map(loan => getSaturdayOfWeek(new Date(loan.startDate)).toISOString()))
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  , [allLoans]);

  const getPlanName = (planId: string) => {
    return loanPlans.find(p => p.id === planId)?.name || 'N/A';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const correctedDate = new Date(date.getTime() + userTimezoneOffset);
    return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const translateStatus = (status: Loan['status']) => {
    const statusMap = {
      'Active': 'Activo',
      'Overdue': 'Vencido',
      'Paid Off': 'Pagado',
      'Pagado desde CV': 'Pagado desde CV',
    };
    return statusMap[status] || status;
  };

  const getStatusVariant = (status: Loan['status']): 'destructive' | 'success' | 'default' | 'purple' => {
    const variantMap = {
      'Overdue': 'destructive',
      'Paid Off': 'success',
      'Pagado desde CV': 'purple',
    };
    return variantMap[status as keyof typeof variantMap] || 'default';
  };

  const handleEditClick = (e: React.MouseEvent, loan: Loan) => {
    e.stopPropagation();
    setSelectedLoan(loan);
    setIsEditDialogOpen(true);
  };

  const handleRowClick = (loan: Loan) => {
      setLoanForDetails(loan);
      setIsDetailsDialogOpen(true);
  };

  const loanDetailsData = useMemo(() => {
      if (!loanForDetails) return [];
      const plan = loanPlans.find(p => p.id === loanForDetails.loanPlanId);
      if (!plan) return [];

      const weeklyPayment = (loanForDetails.amount / 1000) * plan.weeklyPaymentRate;
      
      // Calculate missed weeks for penalty
      let missedWeeksCount = 0;
      const today = new Date();
      const startDate = new Date(loanForDetails.startDate);
      const timeDiff = today.getTime() - startDate.getTime();
      const currentWeekAtOpening = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

      for(let i = 1; i < currentWeekAtOpening; i++) {
          const p = loanForDetails.payments.find(p => p.weekNumber === i);
          if (p && p.amount < weeklyPayment) missedWeeksCount++;
      }
      
      const isExpired = currentWeekAtOpening > plan.termInWeeks;
      const hasPenalty = isExpired || (missedWeeksCount >= 2);
      const termInWeeks = plan.termInWeeks + (hasPenalty ? 1 : 0);
      const isLiquidated = loanForDetails.status === 'Paid Off' || loanForDetails.status === 'Pagado desde CV';
      
      const normalPayments = loanForDetails.payments.filter(p => p.weekNumber > 0);
      const lastNormalWeek = normalPayments.length > 0 
        ? Math.max(...normalPayments.map(p => p.weekNumber)) 
        : 0;

      const rows = [];

      for(let i = 1; i <= termInWeeks; i++) {
          const dueDate = new Date(startDate);
          dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
          
          const payment = loanForDetails.payments.find(p => p.weekNumber === i);
          const isRegistered = !!payment;
          
          let received: number | null = isRegistered ? payment.amount : null;
          let note = '';
          let dateStr = isRegistered ? formatDate(payment.date) : '';

          if (!isRegistered && isLiquidated && i > lastNormalWeek) {
              received = weeklyPayment;
              note = 'AD';
              dateStr = 'LIQUIDADO';
          }

          rows.push({
              num: i,
              vencimiento: dueDate.toLocaleDateString('es-MX'),
              importeAbono: weeklyPayment,
              importeRecibido: received,
              fechaAbono: dateStr,
              note: note
          });
      }
      return rows;
  }, [loanForDetails, loanPlans]);

  const totalAbono = loanDetailsData.reduce((acc, r) => acc + r.importeAbono, 0);
  const totalRecibido = loanDetailsData.reduce((acc, r) => acc + (r.importeRecibido || 0), 0);

  const handleAdjustClick = (weekNumber: number, currentAmount: number) => {
    if (!isCristobal) return;
    setAdjustData({ weekNumber, amount: currentAmount });
    setIsAdjustDialogOpen(true);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Monto</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Fecha del Préstamo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedLoans.length > 0 ? (
            sortedLoans.map((loan) => {
              const isPaid = loan.status === 'Paid Off' || loan.status === 'Pagado desde CV';
              return (
                <TableRow 
                  key={loan.id} 
                  className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => handleRowClick(loan)}
                >
                  <TableCell className="font-semibold">{formatCurrency(loan.amount)}</TableCell>
                  <TableCell>{getPlanName(loan.loanPlanId)}</TableCell>
                  <TableCell>{formatDate(loan.startDate)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(loan.status)}>{translateStatus(loan.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRowClick(loan)}>
                          <ListTodo className="h-4 w-4 mr-1" />
                          Abonos
                      </Button>
                      {canEdit && !isPaid && (
                          <Button variant="ghost" size="icon" onClick={(e) => handleEditClick(e, loan)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar Préstamo</span>
                          </Button>
                      )}
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center">No hay préstamos para este cliente.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden">
              <DialogHeader className="p-6 pb-2 shrink-0">
                  <DialogTitle className="text-center border-b pb-2">Detalle de los abonos del prestamo</DialogTitle>
              </DialogHeader>
              <div className="flex-1 min-h-0">
                <ScrollArea className="h-full px-6">
                    <div className="py-4">
                        <Table className="border border-blue-200">
                            <TableHeader className="bg-blue-100 sticky top-0 z-10">
                                <TableRow className="hover:bg-blue-100 border-blue-200">
                                    <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-center">Num Abono</TableHead>
                                    <TableHead className="text-blue-900 font-bold border-r border-blue-200">Fecha Vencimiento</TableHead>
                                    <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-right">Importe Abono</TableHead>
                                    <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-right">Importe Recibido</TableHead>
                                    <TableHead className="text-blue-900 font-bold text-center">Fecha Abono</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loanDetailsData.map((row) => (
                                    <TableRow key={row.num} className="border-blue-100 hover:bg-blue-50/50">
                                        <TableCell className="border-r border-blue-100 text-center py-1">{row.num}</TableCell>
                                        <TableCell className="border-r border-blue-100 py-1">{row.vencimiento}</TableCell>
                                        <TableCell className="border-r border-blue-100 text-right py-1">{formatCurrency(row.importeAbono)}</TableCell>
                                        <TableCell 
                                            className={cn(
                                                "border-r border-blue-100 text-right py-1 font-semibold relative group", 
                                                row.importeRecibido !== null ? "bg-green-100 text-green-800" : "",
                                                isCristobal && "cursor-pointer hover:bg-green-200 transition-colors"
                                            )}
                                            onClick={() => isCristobal && row.importeRecibido !== null && handleAdjustClick(row.num, row.importeRecibido)}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                {row.importeRecibido !== null ? formatCurrency(row.importeRecibido) : ''}
                                                {row.note === 'AD' && <Badge variant="secondary" className="bg-blue-200 text-blue-800 text-[10px] h-4">AD</Badge>}
                                                {isCristobal && row.importeRecibido !== null && row.note !== 'AD' && (
                                                    <PencilLine className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600 shrink-0" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-1 text-xs text-muted-foreground">{row.fechaAbono}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter className="bg-white border-t-2 border-blue-300">
                                <TableRow>
                                    <TableCell colSpan={2} className="text-right font-bold text-blue-900">TOTALES</TableCell>
                                    <TableCell className="text-right font-bold text-blue-900">{formatCurrency(totalAbono)}</TableCell>
                                    <TableCell className="text-right font-bold text-blue-900 bg-green-50">{formatCurrency(totalRecibido)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </ScrollArea>
              </div>
              <div className="p-4 border-t flex justify-end shrink-0">
                  <Button variant="secondary" onClick={() => setIsDetailsDialogOpen(false)}>Cerrar</Button>
              </div>
          </DialogContent>
      </Dialog>

      {selectedLoan && (
        <EditLoanDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          loan={selectedLoan}
          loanPlans={loanPlans}
          allLoanWeeks={allLoanWeeks}
          plazas={plazas}
          localidades={localidades}
          promotoras={promotoras}
        />
      )}

      {loanForDetails && adjustData && (
        <ManualPaymentAdjustmentDialog
          isOpen={isAdjustDialogOpen}
          onOpenChange={setIsAdjustDialogOpen}
          loan={loanForDetails}
          weekNumber={adjustData.weekNumber}
          currentAmount={adjustData.amount}
          onSuccess={() => {
              // No es ideal, pero fuerza el refresco de los datos tras el ajuste manual
              if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      )}
    </>
  );
}
