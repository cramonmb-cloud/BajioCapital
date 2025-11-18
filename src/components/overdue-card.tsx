'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, User, Calendar, MessageSquare } from 'lucide-react';
import type { OverdueLoanDetails } from '@/app/dashboard/overdue-portfolio/page';
import { RegisterPaymentDialog } from './register-payment-dialog';
import type { Client, LoanPlan } from '@/lib/types';
import { ClientOutreach } from './client-outreach';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
}

export function OverdueCard({ details, allClients, allLoanPlans }: OverdueCardProps) {
    const { client, loan, loanPlan, amountDue, missedPayments } = details;
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      // Adjust for timezone offset to show the correct local date
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  };

    const handleWhatsApp = () => {
        if (client.phone) {
            const message = `Hola ${client.name}, te contactamos de CrediControl para recordarte sobre tu préstamo.`;
            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };
    
    const avalName = client.endorsement.split('(')[0].trim();
    
    // The dialog needs a week number to be opened, we'll default to the last possible week.
    const lastWeekNumber = details.loanPlan.termInWeeks;
    const weekDate = new Date(loan.startDate);
    weekDate.setDate(weekDate.getDate() + (lastWeekNumber * 7));

    return (
        <>
            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-bold text-lg">{client.name}</h3>
                            <p className="text-xs text-muted-foreground">{client.street}</p>
                        </div>
                        <Badge variant="destructive">Vencido</Badge>
                    </div>

                    <div className="text-sm space-y-1 text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{client.phone || 'No disponible'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            <span>Aval: {avalName}</span>
                        </div>
                         <div className="flex items-center gap-2 pt-1">
                            <Calendar className="h-3 w-3" />
                            <span>Fecha de Préstamo: {formatDate(loan.startDate)}</span>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-2">
                        <div>
                            <p className="text-xs text-muted-foreground">Préstamo</p>
                            <p className="font-semibold">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Adeudo</p>
                            <p className="font-bold text-destructive">{formatCurrency(amountDue)}</p>
                        </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                         <div className="grid grid-cols-3 gap-2">
                            <ClientOutreach clientInfo={{
                                clientId: client.id,
                                clientName: client.name,
                                loanAmount: loan.amount,
                                loanStatus: loan.status,
                                paymentHistory: `Debe ${formatCurrency(amountDue)}`,
                                missedPayments: missedPayments,
                            }}/>
                             <Button variant="outline" size="sm" onClick={handleWhatsApp}>
                                <MessageSquare className="mr-1 h-3 w-3" />
                                WhatsApp
                            </Button>
                            <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="col-span-1">
                                ${' '}Abonar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <RegisterPaymentDialog
                isOpen={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                loan={loan}
                clients={allClients}
                loanPlans={allLoanPlans}
                weekNumber={lastWeekNumber}
                weekDate={weekDate}
                initialAmount={amountDue}
                onPaymentRegistered={() => {
                    // This page is server rendered, so we just refresh
                    window.location.reload();
                }}
            />
        </>
    );
}
