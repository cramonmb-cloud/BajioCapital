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
            avalName: name || 'NO ESPECIFICADO',
            avalAddress: rawDetails || 'SIN DIRECCIÓN REGISTRADA',
            avalPhone: phone || 'SIN TELÉFONO'
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

    const debtLabel = isOverduePortfolio ? "Fallas Acumuladas" : "Saldo Vencido";

    return (
        <>
            <Card className="overflow-hidden border-t-[6px] transition-all hover:shadow-xl group/card bg-white" style={{ borderTopColor: plazaColor }}>
                {/* Cabecera de Plaza */}
                <div className="px-4 py-2 border-b flex justify-between items-center bg-muted/20">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: plazaColor }}>
                        <Building className="h-3.5 w-3.5" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant={isOverduePortfolio ? "secondary" : "destructive"} className="text-[9px] h-5 font-black px-2 uppercase shadow-sm">
                        {isOverduePortfolio ? 'Pendiente' : 'En Mora'}
                    </Badge>
                </div>

                <CardContent className="p-0">
                    <div className="p-4 space-y-4">
                        <div className="cursor-pointer space-y-1" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-black text-xl leading-none uppercase group-hover/card:text-blue-600 transition-colors">{client.name}</h3>
                            <div className="flex items-start gap-1.5 text-muted-foreground pt-1">
                                <Map className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                                <p className="text-[11px] font-bold uppercase leading-tight line-clamp-2">
                                    {client.street}, {client.neighborhood}, {client.city}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground font-black uppercase tracking-tighter pt-1 opacity-70">
                                <span className="flex items-center gap-1"><MapPin className="h-2.5 w-2.5" /> {hierarchy.localidadName}</span>
                                <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" /> {hierarchy.promotoraName}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-center">
                            <Button asChild className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 transition-all" size="sm">
                                <a href={`tel:${cleanPhone(client.phone)}`}>
                                    <Phone className="mr-2 h-4 w-4" />
                                    {client.phone}
                                </a>
                            </Button>
                            <div className="text-right">
                                <p className="text-[8px] font-black text-muted-foreground uppercase leading-none mb-1">Contratado</p>
                                <p className="text-[11px] font-black text-foreground uppercase">{formatDate(loanWeekDate.toISOString())}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mx-4 mb-4 p-4 rounded-3xl bg-blue-50/40 border-2 border-dashed border-blue-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-700">
                                <UserCheck className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Aval</span>
                            </div>
                            <Shield className="h-3 w-3 text-blue-300" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-black uppercase leading-tight text-blue-900 line-clamp-1">{avalName}</p>
                            <p className="text-[9px] font-bold uppercase text-blue-600/70 leading-relaxed italic line-clamp-2">
                                <MapPin className="inline-block h-2 w-2 mr-1" /> {avalAddress}
                            </p>
                        </div>
                        <Button asChild className="h-9 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs w-full rounded-2xl shadow-sm border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all" size="sm">
                            <a href={`tel:${cleanPhone(avalPhone)}`}>
                                <Phone className="mr-2 h-3.5 w-3.5" />
                                LLAMAR AVAL: {avalPhone !== 'SIN TELÉFONO' ? avalPhone : ''}
                            </a>
                        </Button>
                    </div>
                    
                    <div className="px-5 py-4 bg-muted/40 border-t border-b flex justify-between items-center shadow-inner">
                        <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Préstamo</p>
                            <p className="font-bold text-sm text-foreground/80">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div className="text-right space-y-0">
                            <p className={cn("text-[10px] uppercase font-black tracking-widest", isOverduePortfolio ? 'text-orange-600' : 'text-red-600')}>
                                {debtLabel}
                            </p>
                            <p className={cn("font-black text-2xl tracking-tighter", isOverduePortfolio ? 'text-orange-700' : 'text-red-700')}>
                                {formatCurrency(amountDue)}
                            </p>
                        </div>
                    </div>

                    <div className="p-3 grid grid-cols-2 gap-3">
                        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-12 font-black text-[10px] uppercase tracking-[0.1em] rounded-2xl border-2 hover:bg-green-50 hover:text-green-700 hover:border-green-300 shadow-sm transition-all active:scale-95">
                            <MessageSquare className="mr-2 h-5 w-5 text-green-500" />
                            WhatsApp
                        </Button>
                        <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="h-12 font-black text-[10px] uppercase tracking-[0.1em] rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all bg-foreground text-background hover:bg-foreground/90">
                            <Wallet className="mr-2 h-5 w-5" />
                            Abonar Pago
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* MODAL DE DETALLE REDISEÑADO: MÁS COMPACTO Y CON BOTÓN X */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="px-6 py-4 border-b shrink-0 flex flex-row items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarImage src={client.avatarUrl} alt={client.name} />
                                <AvatarFallback className="font-bold bg-blue-100 text-blue-700">{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-lg font-black uppercase leading-none">{client.name}</DialogTitle>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">ID: {client.id} • {hierarchy.plazaName}</p>
                            </div>
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
                                <X className="h-5 w-5" />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </DialogClose>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-4 sm:p-6 space-y-6">
                            {/* MÉTRICAS RÁPIDAS */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl bg-muted/30 border border-muted text-center space-y-0.5">
                                    <p className="text-[8px] uppercase font-black text-muted-foreground">Progreso</p>
                                    <p className="font-black text-xl">{currentLoanWeek} / {termInWeeksWithPenalty}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-center space-y-0.5">
                                    <p className="text-[8px] uppercase font-black text-blue-600">Abono Semanal</p>
                                    <p className="font-black text-xl text-blue-700">{formatCurrency(weeklyPayment)}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center space-y-0.5">
                                    <p className="text-[8px] uppercase font-black text-red-600">Fallos Reg.</p>
                                    <p className="font-black text-xl text-red-700">{missedPayments}</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* COLUMNA 1: CLIENTE Y FINANZAS */}
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <MapPin className="h-3 w-3 text-blue-600" /> Datos de Localización
                                        </h4>
                                        <div className="p-4 rounded-xl border-2 space-y-3 bg-white">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase">Dirección Principal</p>
                                                <p className="text-sm font-bold uppercase">{fullAddress}</p>
                                            </div>
                                            <div className="flex gap-4 border-t pt-2">
                                                <div className="flex-1 space-y-0.5">
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase">Localidad</p>
                                                    <p className="text-[11px] font-bold uppercase text-blue-700">{hierarchy.localidadName}</p>
                                                </div>
                                                <div className="flex-1 space-y-0.5 border-l pl-4">
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase">Promotora</p>
                                                    <p className="text-[11px] font-bold uppercase text-blue-700">{hierarchy.promotoraName}</p>
                                                </div>
                                            </div>
                                            <Button variant="secondary" className="w-full h-9 rounded-lg font-bold text-xs" asChild>
                                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                                    <Map className="mr-2 h-4 w-4" /> Abrir en Google Maps
                                                </a>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-blue-600" /> Contrato y Saldo
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 p-4 rounded-xl border-2 bg-white">
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-black text-muted-foreground uppercase">Préstamo Base</p>
                                                <p className="text-sm font-bold">{formatCurrency(loan.amount)}</p>
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] font-black text-muted-foreground uppercase">Fecha Inicio</p>
                                                <p className="text-sm font-bold">{formatDate(loan.startDate)}</p>
                                            </div>
                                            <div className="col-span-2 space-y-1 mt-1 p-3 rounded-lg bg-red-50 border border-red-100">
                                                <p className="text-[9px] font-black text-red-600 uppercase">Saldo Total Pendiente</p>
                                                <p className="text-2xl font-black text-red-700 leading-none">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* COLUMNA 2: AVAL Y GARANTÍA */}
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                            <Shield className="h-3 w-3 text-blue-600" /> Garantía y Aval
                                        </h4>
                                        <div className="p-5 rounded-2xl bg-blue-600 text-white space-y-4 shadow-lg shadow-blue-100 relative overflow-hidden">
                                            <UserCheck className="absolute -bottom-4 -right-4 h-24 w-24 opacity-10" />
                                            <div className="space-y-0.5">
                                                <p className="text-[8px] uppercase font-black text-blue-200 tracking-widest">Responsable Solidario</p>
                                                <p className="font-black text-lg uppercase leading-tight">{avalName}</p>
                                            </div>
                                            <Button asChild className="bg-white hover:bg-blue-50 text-blue-700 font-black h-10 w-full rounded-xl shadow-sm text-sm" size="sm">
                                                <a href={`tel:${cleanPhone(avalPhone)}`}>
                                                    <Phone className="mr-2 h-4 w-4" /> {avalPhone}
                                                </a>
                                            </Button>
                                            <div className="space-y-0.5 pt-2 border-t border-blue-500/50">
                                                <p className="text-[8px] uppercase font-black text-blue-200 tracking-widest">Dirección del Aval</p>
                                                <p className="text-[10px] font-bold uppercase leading-relaxed text-blue-50">{avalAddress}</p>
                                            </div>
                                        </div>
                                        <div className="p-4 rounded-xl border-2 border-dashed bg-muted/20">
                                            <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Garantía Declarada</p>
                                            <p className="text-xs font-bold uppercase leading-snug">{client.guarantee || 'SIN REGISTRO'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 sm:p-6 bg-muted/30 border-t shrink-0 flex flex-col sm:flex-row gap-3">
                        <Button variant="outline" size="lg" onClick={() => handleWhatsApp()} className="font-black uppercase text-[10px] h-12 flex-1 rounded-xl border-2 active:scale-95 shadow-sm">
                            <MessageSquare className="mr-2 h-5 w-5 text-green-500" /> WhatsApp
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase text-[10px] h-12 flex-1 rounded-xl shadow-lg shadow-blue-200 active:scale-95 bg-blue-600 hover:bg-blue-700 text-white">
                            <Wallet className="mr-2 h-5 w-5" /> Registrar Abono
                        </Button>
                        <DialogClose asChild>
                            <Button variant="secondary" size="lg" className="font-black uppercase text-[10px] h-12 px-6 rounded-xl sm:hidden">
                                Cerrar
                            </Button>
                        </DialogClose>
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
