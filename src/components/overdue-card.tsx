'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, User, Calendar, MessageSquare, Building, MapPin, 
    Home, Wallet, FileText, Shield, AlertTriangle, X, Map, ChevronDown 
} from 'lucide-react';
import type { OverdueLoanDetails } from '@/app/dashboard/overdue-portfolio/page';
import { RegisterPaymentDialog } from './register-payment-dialog';
import type { Client, LoanPlan } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from '@/lib/utils';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
    plazaColor: string;
}

// Helper to get the Saturday of the week for a given date
const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const diff = day === 0 ? -1 : 6 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
};

export function OverdueCard({ details, allClients, allLoanPlans, plazaColor }: OverdueCardProps) {
    const { client, loan, loanPlan, amountDue, missedPayments, hierarchy } = details;
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { appUser } = useAuth();

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
    };

    const formatDateFull = (dateString: string) => {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const correctedDate = new Date(date.getTime() + userTimezoneOffset);
        return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    const handleWhatsApp = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (client.phone) {
            const message = `Hola ${client.name}, te contactamos de CrediControl para recordarte sobre tu préstamo pendiente de pago.`;
            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };
    
    const avalParts = client.endorsement.split('(');
    const avalName = avalParts[0].trim();
    const avalDetails = avalParts[1]?.replace(')', '').trim() || '';
    
    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

    const weekDate = new Date(loan.startDate);
    weekDate.setDate(weekDate.getDate() + ((currentLoanWeek - 1) * 7));
    
    const loanWeekDate = getSaturdayOfWeek(new Date(loan.startDate));

    const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
    const termInWeeksWithPenalty = loanPlan.termInWeeks + (missedPayments >= 2 ? 1 : 0);
    const totalToPay = weeklyPayment * termInWeeksWithPenalty;
    const totalPaid = loan.payments.reduce((acc, p) => acc + p.amount, 0);
    const remainingBalance = totalToPay - totalPaid;

    const fullAddress = `${client.street}, ${client.neighborhood}, ${client.city}, ${client.postalCode}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

    return (
        <>
            <Card className="overflow-hidden border-t-4 transition-all hover:shadow-md" style={{ borderTopColor: plazaColor }}>
                <div className="px-4 py-2 border-b flex justify-between items-center" style={{ backgroundColor: `${plazaColor}10` }}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: plazaColor }}>
                        <Building className="h-3 w-3" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant="destructive" className="text-[10px] h-5 font-bold">CON FALLA</Badge>
                </div>
                <CardContent className="p-4 space-y-3">
                    <div className="cursor-pointer group" onClick={() => setDetailModalOpen(true)}>
                        <h3 className="font-bold text-lg leading-tight uppercase group-hover:text-primary transition-colors">{client.name}</h3>
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

            {/* Modal de Detalle del Cliente (Estilo Consultar Cliente) */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-16 w-16 border-2 border-primary">
                                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                                    <AvatarFallback className="text-2xl">{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <DialogTitle className="text-2xl uppercase">{client.name}</DialogTitle>
                                    <p className="text-sm text-muted-foreground">ID de Cliente: {client.id}</p>
                                </div>
                            </div>
                            <div className="text-sm text-muted-foreground grid grid-cols-1 gap-y-1">
                                <div className="flex items-center gap-2"><Phone className="h-4 w-4" /> {client.phone}</div>
                                <div className="flex items-center gap-2">
                                    {isMobile ? (
                                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline" style={{ color: '#005DC7' }}>
                                            <Map className="h-4 w-4" /> {`${client.street}, ${client.neighborhood}`}
                                        </a>
                                    ) : (
                                        <><Home className="h-4 w-4" /> {`${client.street}, ${client.neighborhood}`}</>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs font-semibold">
                                    <Building className="h-3 w-3" /> {hierarchy.plazaName} • <MapPin className="h-3 w-3" /> {hierarchy.localidadName}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <Separator className="my-4" />

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="font-semibold text-xl flex items-center gap-2"><Wallet className="text-primary"/> Progreso del Pago</h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Semana Actual</p>
                                    <p className="font-bold text-3xl">{currentLoanWeek} <span className="text-lg text-muted-foreground">de {termInWeeksWithPenalty}</span></p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Abono</p>
                                    <p className="font-bold text-3xl" style={{ color: '#005DC7' }}>{formatCurrency(weeklyPayment)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Fallos</p>
                                    <p className={cn("font-bold text-3xl", missedPayments > 0 ? 'text-red-500' : 'text-blue-500')}>
                                        {missedPayments}
                                    </p>
                                </div>
                            </div>
                            <Separator className="my-4"/>
                            <h3 className="font-semibold text-xl flex items-center gap-2"><FileText className="text-primary"/> Detalles del Préstamo</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Monto Solicitado</p>
                                    <p className="font-bold text-lg">{formatCurrency(loan.amount)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Plan</p>
                                    <p className="font-semibold uppercase">{loanPlan.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Fecha de Inicio</p>
                                    <p className="font-semibold">{formatDateFull(loan.startDate)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">Saldo Pendiente</p>
                                    <p className="font-bold text-destructive">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-2 border-l md:pl-8">
                            <Collapsible defaultOpen={true}>
                                <CollapsibleTrigger className="w-full">
                                    <div className="flex items-center justify-between w-full">
                                        <h3 className="font-semibold text-xl flex items-center gap-2"><Shield className="text-primary"/> Información del Aval</h3>
                                        <ChevronDown className="h-5 w-5" />
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-3 text-sm mt-4">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Garantía</p>
                                            <p className="font-semibold uppercase">{client.guarantee}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Nombre del Aval</p>
                                            <p className="font-bold text-lg uppercase">{avalName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground">Contacto y Domicilio</p>
                                            <p className="font-semibold uppercase">{avalDetails || 'No especificado'}</p>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </div>
                    </div>
                    
                    <div className="flex justify-end mt-6 gap-2">
                        <Button variant="outline" onClick={() => handleWhatsApp()}>
                            <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
                        </Button>
                        <Button onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }}>
                            $ Registrar Abono
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

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
                    window.location.reload();
                }}
            />
        </>
    );
}
