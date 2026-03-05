'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, User, Calendar, MessageSquare, Building, MapPin } from 'lucide-react';
import type { OverdueLoanDetails } from '@/app/dashboard/overdue-portfolio/page';
import { RegisterPaymentDialog } from './register-payment-dialog';
import type { Client, LoanPlan, AppUser } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
    plazaColor: string;
}

// Helper to get the Saturday of the week for a given date
const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0); // Normalize time
  const day = date.getUTCDay(); // Sunday = 0, Saturday = 6
  // If it's Sunday, we want the previous saturday. Otherwise, find the upcoming one.
  const diff = day === 0 ? -1 : 6 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
};


export function OverdueCard({ details, allClients, allLoanPlans, plazaColor }: OverdueCardProps) {
    const { client, loan, loanPlan, amountDue, missedPayments, hierarchy } = details;
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const { appUser } = useAuth();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      // Adjust for timezone offset to show the correct local date
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
  };

    const handleWhatsApp = () => {
        if (client.phone) {
            const message = `Hola ${client.name}, te contactamos de CrediControl para recordarte sobre tu préstamo pendiente de pago.`;
            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };
    
    const avalName = client.endorsement.split('(')[0].trim();
    
    // Calculate the current week of the loan to pass to the dialog
    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

    const weekDate = new Date(loan.startDate);
    weekDate.setDate(weekDate.getDate() + ((currentLoanWeek - 1) * 7));
    
    const loanWeekDate = getSaturdayOfWeek(new Date(loan.startDate));

    return (
        <>
            <Card className="overflow-hidden border-t-4" style={{ borderTopColor: plazaColor }}>
                <div className="px-4 py-2 border-b flex justify-between items-center" style={{ backgroundColor: `${plazaColor}10` }}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: plazaColor }}>
                        <Building className="h-3 w-3" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant="destructive" className="text-[10px] h-5 font-bold">FALLO REGISTRADO</Badge>
                </div>
                <CardContent className="p-4 space-y-3">
                    <div>
                        <h3 className="font-bold text-lg leading-tight uppercase">{client.name}</h3>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 uppercase font-semibold">
                            <MapPin className="h-3 w-3" /> {hierarchy.localidadName} • <User className="h-3 w-3" /> {hierarchy.promotoraName}
                        </div>
                    </div>

                    <div className="text-sm space-y-1 text-muted-foreground bg-secondary/30 p-2 rounded-md">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                <span>{client.phone || 'S/N'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <Calendar className="h-3 w-3" />
                                <span>Inició: {formatDate(loanWeekDate.toISOString())}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                            <User className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate uppercase">Aval: {avalName}</span>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-1">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Monto Original</p>
                            <p className="font-semibold text-sm">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Deuda Pendiente</p>
                            <p className="font-bold text-xl text-destructive">{formatCurrency(amountDue)}</p>
                        </div>
                    </div>

                    <div className="border-t pt-3">
                         <div className="grid grid-cols-2 gap-2">
                             <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-9 font-bold">
                                <MessageSquare className="mr-1 h-4 w-4" />
                                WhatsApp
                            </Button>
                            <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="h-9 font-bold">
                                $ ABONAR
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
                weekNumber={currentLoanWeek}
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
