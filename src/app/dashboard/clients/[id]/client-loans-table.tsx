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
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import { EditLoanDialog } from '@/components/edit-loan-dialog';


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

  const canEdit = useMemo(() => appUser?.username === 'Cristobal', [appUser]);
  
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

  const handleEditClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsEditDialogOpen(true);
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
            {canEdit && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientLoans.length > 0 ? (
            clientLoans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>{formatCurrency(loan.amount)}</TableCell>
                <TableCell>{getPlanName(loan.loanPlanId)}</TableCell>
                <TableCell>{formatDate(loan.startDate)}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(loan.status)}>{translateStatus(loan.status)}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(loan)}>
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar Préstamo</span>
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={canEdit ? 5 : 4} className="text-center">No hay préstamos para este cliente.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
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
    </>
  );
}
