'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, User, Edit, MessageSquare, Bot, Loader2, Sparkles } from 'lucide-react';
import type { OverdueLoanDetails } from '@/app/dashboard/overdue-portfolio/page';
import { RegisterPaymentDialog } from './register-payment-dialog';
import type { Client, LoanPlan } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { getClientOutreachSuggestion } from '@/ai/flows/client-outreach-suggestions';


interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
}

export function OverdueCard({ details, allClients, allLoanPlans }: OverdueCardProps) {
    const { client, loan, amountDue } = details;
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState('');
    const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
    const { toast } = useToast();

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };

    const handleWhatsApp = () => {
        if (client.phone) {
            const message = `Hola ${client.name}, te contactamos de CrediControl para recordarte sobre tu préstamo.`;
            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };
    
    const handleSMS = () => {
        if (client.phone) {
             window.open(`sms:${client.phone}`);
        }
    }

    const fetchSuggestion = async () => {
        setIsFetchingSuggestion(true);
        setAiSuggestion('');
        try {
            const result = await getClientOutreachSuggestion({
                clientId: client.id,
                clientName: client.name,
                loanAmount: loan.amount,
                loanStatus: loan.status,
                paymentHistory: `${loan.payments.length} pagos realizados.`,
                missedPayments: details.missedPayments,
            });
            setAiSuggestion(result.outreachSuggestion);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error de IA',
                description: 'No se pudo generar la sugerencia.',
            });
        } finally {
            setIsFetchingSuggestion(false);
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
                             <Button variant="outline" size="sm" disabled>
                                <Edit className="mr-1 h-3 w-3" />
                                Editar
                            </Button>
                            <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="col-span-2">
                                ${' '}Abonar
                            </Button>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={handleWhatsApp}>
                                <MessageSquare className="mr-1 h-3 w-3" />
                                Enviar WhatsApp
                            </Button>
                            <Popover>
                                <PopoverTrigger asChild>
                                     <Button variant="outline" size="sm" onClick={fetchSuggestion}>
                                        {isFetchingSuggestion ? (
                                            <Loader2 className="mr-1 h-3 w-3 animate-spin"/>
                                        ) : (
                                            <Sparkles className="mr-1 h-3 w-3 text-yellow-400" />
                                        )}
                                        Sugerencia IA
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent>
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none flex items-center gap-2">
                                            <Bot className="h-4 w-4" />
                                            Sugerencia de Contacto
                                        </h4>
                                         {isFetchingSuggestion ? (
                                            <div className="flex items-center justify-center p-4">
                                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                            </div>
                                        ) : (
                                             <p className="text-sm text-muted-foreground">
                                                {aiSuggestion || 'No se pudo generar una sugerencia en este momento.'}
                                            </p>
                                        )}
                                    </div>
                                </PopoverContent>
                             </Popover>
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
