'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, User, MessageSquare, Building, MapPin, 
    Wallet, FileText, Shield, AlertTriangle, Map, UserCheck, X 
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
    DialogClose,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
    plazaColor: string;
    isOverduePortfolio?: boolean;
}

const getSaturdayOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const diff = day === 0 ? -1 : 6 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
};

const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

export function OverdueCard({ details, allClients, allLoanPlans, plazaColor, isOverduePortfolio }: OverdueCardProps) {
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

    const handleWhatsApp = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (client.phone) {
            const message = `Hola ${client.name}, te contactamos de CrediControl para recordarte sobre tu préstamo pendiente de pago.`;
            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };
    
    const { avalName, avalAddress, avalPhone } = useMemo(() => {
        const parts = client.endorsement.split('(');
        const name = parts[0].trim();
        let rawDetails = parts[1]?.replace(')', '').trim() || '';
        
        let phone = '';
        const phoneMatch = rawDetails.match(/Tel:\s*(.*)$/i);
        if (phoneMatch) {
            phone = phoneMatch[1].trim();
            rawDetails = rawDetails.replace(phoneMatch[0], '').trim();
            if (rawDetails.endsWith(',')) {
                rawDetails = rawDetails.slice(0, -1).trim();
            }
        }
        
        return {
            avalName: name || 'SIN NOMBRE',
            avalAddress: rawDetails || 'SIN DIRECCIÓN',
            avalPhone: phone || ''
        };
    }, [client.endorsement]);
    
    const today = new Date();
    const loanStartDate = new Date(loan.startDate);
    const timeDiff = today.getTime() - loanStartDate.getTime();
    const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
    
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
            <Card className="overflow-hidden border-l-[4px] transition-all hover:shadow-lg bg-white mb-2" style={{ borderLeftColor: plazaColor }}>
                <CardContent className="p-3 space-y-2">
                    {/* Fila Superior: Nombre y Deuda */}
                    <div className="flex justify-between items-start gap-2">
                        <div className="cursor-pointer flex-1" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-black text-sm uppercase leading-tight truncate">{client.name}</h3>
                            <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                                <MapPin className="h-3 w-3 text-blue-500" />
                                <p className="text-[10px] font-bold uppercase truncate">{client.street}, {client.neighborhood}</p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={cn("text-[9px] font-black uppercase", isOverduePortfolio ? 'text-orange-600' : 'text-red-600')}>Saldo</p>
                            <p className={cn("font-black text-base tracking-tighter leading-none", isOverduePortfolio ? 'text-orange-700' : 'text-red-700')}>
                                {formatCurrency(amountDue)}
                            </p>
                        </div>
                    </div>

                    {/* Fila Media: Contacto Cliente */}
                    <div className="flex gap-2 items-center">
                        <Button asChild className="h-7 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-lg flex-1" size="sm">
                            <a href={`tel:${cleanPhone(client.phone)}`}>
                                <Phone className="mr-1.5 h-3 w-3" /> {client.phone}
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-7 w-9 p-0 rounded-lg border-green-200 hover:bg-green-50">
                            <MessageSquare className="h-4 w-4 text-green-500" />
                        </Button>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">
                            INICIÓ: {formatDate(loanWeekDate.toISOString())}
                        </div>
                    </div>

                    {/* Bloque Aval: Super Compacto */}
                    <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                                <Shield className="h-2.5 w-2.5 text-blue-600" />
                                <span className="text-[8px] font-black uppercase text-blue-700 tracking-wider">Aval</span>
                            </div>
                            <p className="text-[9px] font-black uppercase truncate text-blue-900">{avalName}</p>
                        </div>
                        {avalPhone && (
                            <Button asChild className="h-6 bg-blue-700 hover:bg-blue-800 text-white font-black text-[9px] px-2 rounded-md" size="sm">
                                <a href={`tel:${cleanPhone(avalPhone)}`}>
                                    <Phone className="mr-1 h-2.5 w-2.5" /> LLAMAR
                                </a>
                            </Button>
                        )}
                    </div>

                    {/* Acciones Finales */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex gap-2 text-[8px] font-black text-muted-foreground uppercase opacity-60">
                            <span className="flex items-center gap-0.5"><Building className="h-2 w-2" /> {hierarchy.plazaName}</span>
                            <span className="flex items-center gap-0.5"><User className="h-2 w-2" /> {hierarchy.promotoraName}</span>
                        </div>
                        <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="h-8 bg-foreground text-background font-black text-[10px] uppercase px-4 rounded-lg active:scale-95 shadow-sm">
                            <Wallet className="mr-1.5 h-3.5 w-3.5" /> Abonar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* MODAL DE DETALLE REDISEÑADO COMPACTO */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="px-5 py-3 border-b shrink-0 flex flex-row items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border">
                                <AvatarImage src={client.avatarUrl} alt={client.name} />
                                <AvatarFallback className="font-bold text-xs bg-blue-100 text-blue-700">{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-sm font-black uppercase leading-none">{client.name}</DialogTitle>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{hierarchy.plazaName} • ID: {client.id}</p>
                            </div>
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-4 space-y-5">
                            {/* MÉTRICAS */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded-lg bg-muted/30 border text-center">
                                    <p className="text-[7px] uppercase font-black text-muted-foreground">Progreso</p>
                                    <p className="font-black text-sm">{currentLoanWeek} / {termInWeeksWithPenalty}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-50 border-blue-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-blue-600">Abono Semanal</p>
                                    <p className="font-black text-sm text-blue-700">{formatCurrency(weeklyPayment)}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-red-50 border-red-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-red-600">Fallos</p>
                                    <p className="font-black text-sm text-red-700">{missedPayments}</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-blue-600" /> Localización
                                        </h4>
                                        <div className="p-3 rounded-lg border text-xs space-y-2 bg-white">
                                            <p className="font-bold uppercase leading-tight">{fullAddress}</p>
                                            <Button variant="secondary" className="w-full h-8 text-[10px] font-bold" asChild>
                                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">MAPS</a>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-blue-600" /> Saldo
                                        </h4>
                                        <div className="p-3 rounded-lg border bg-white flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-muted-foreground">RESTA TOTAL</span>
                                            <span className="text-lg font-black text-red-700">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                        <Shield className="h-3 w-3 text-blue-600" /> Aval y Garantía
                                    </h4>
                                    <div className="p-4 rounded-xl bg-blue-600 text-white space-y-3 shadow-md">
                                        <div>
                                            <p className="text-[7px] uppercase font-black text-blue-200">Titular Aval</p>
                                            <p className="font-black text-sm uppercase leading-tight">{avalName}</p>
                                        </div>
                                        <Button asChild className="bg-white text-blue-700 font-black h-8 w-full text-xs" size="sm">
                                            <a href={`tel:${cleanPhone(avalPhone)}`}>LLAMAR: {avalPhone}</a>
                                        </Button>
                                        <p className="text-[9px] font-bold uppercase leading-relaxed text-blue-50 opacity-80">{avalAddress}</p>
                                    </div>
                                    <div className="p-2 border border-dashed rounded-lg text-[9px] font-bold uppercase text-muted-foreground text-center">
                                        Garantía: {client.guarantee || 'NO REGISTRADA'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 bg-muted/30 border-t flex gap-2">
                        <Button variant="outline" size="lg" onClick={() => handleWhatsApp()} className="font-black uppercase text-[10px] h-10 flex-1 rounded-lg">
                            WhatsApp
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase text-[10px] h-10 flex-1 rounded-lg bg-blue-600 text-white shadow-lg">
                            Registrar Abono
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
                weekDate={loanWeekDate}
                initialAmount={amountDue}
                onPaymentRegistered={() => {
                    if (typeof window !== 'undefined') window.location.reload();
                }}
            />
        </>
    );
}
