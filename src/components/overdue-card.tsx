'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, User, MessageSquare, Building, MapPin, 
    Wallet, FileText, Shield, AlertTriangle, Map, UserCheck 
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
import { cn } from '@/lib/utils';

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
                {/* Cabecera de Plaza con Estilo de Cinta */}
                <div className="px-4 py-2 border-b flex justify-between items-center bg-muted/20">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: plazaColor }}>
                        <Building className="h-3.5 w-3.5" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant={isOverduePortfolio ? "secondary" : "destructive"} className="text-[9px] h-5 font-black px-2 uppercase shadow-sm">
                        {isOverduePortfolio ? 'Pendiente' : 'En Mora'}
                    </Badge>
                </div>

                <CardContent className="p-0">
                    {/* SECCIÓN TITULAR: DATOS PRINCIPALES */}
                    <div className="p-4 space-y-4">
                        <div className="cursor-pointer space-y-1" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-black text-xl leading-none uppercase group-hover/card:text-blue-600 transition-colors">{client.name}</h3>
                            
                            {/* Dirección del Cliente */}
                            <div className="flex items-start gap-1.5 text-muted-foreground pt-1">
                                <Map className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-blue-500" />
                                <p className="text-[11px] font-bold uppercase leading-tight line-clamp-2">
                                    {client.street}, {client.neighborhood}, {client.city}
                                </p>
                            </div>

                            {/* Jerarquía de Ruta */}
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

                    {/* SECCIÓN AVAL: DIFERENCIACIÓN VISUAL */}
                    <div className="mx-4 mb-4 p-4 rounded-3xl bg-blue-50/40 border-2 border-dashed border-blue-200 space-y-3 relative overflow-hidden group/aval hover:bg-blue-50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-700">
                                <UserCheck className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Garante / Aval</span>
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
                    
                    {/* SECCIÓN FINANCIERA: MONTOS CRÍTICOS */}
                    <div className="px-5 py-4 bg-muted/40 border-t border-b flex justify-between items-center shadow-inner">
                        <div className="space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Préstamo Base</p>
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

                    {/* ACCIONES FINALES */}
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

            {/* MODAL DE DETALLE EXPANDIDO: VISTA COMPLETA */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 rounded-[2.5rem] border-none shadow-3xl">
                    <div className="sticky top-0 bg-white/90 backdrop-blur-xl z-20 p-8 border-b-2 border-muted">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-24 w-24 border-4 border-white shadow-2xl ring-4 ring-blue-50">
                                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                                    <AvatarFallback className="text-4xl font-black bg-blue-100 text-blue-700">{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">{client.name}</h2>
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase px-3 py-1">CLIENTE #{client.id}</Badge>
                                        <Badge className="bg-blue-600 text-[10px] font-black px-3">{hierarchy.plazaName}</Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-black h-14 px-8 rounded-2xl flex-1 md:flex-none shadow-xl shadow-blue-100 border-b-4 border-blue-800" size="lg">
                                    <a href={`tel:${cleanPhone(client.phone)}`}>
                                        <Phone className="mr-3 h-6 w-6" />
                                        {client.phone}
                                    </a>
                                </Button>
                                <Button variant="secondary" className="h-14 w-14 rounded-2xl p-0 hover:bg-blue-100 transition-colors shadow-inner" asChild title="Ver en Google Maps">
                                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                        <Map className="h-7 w-7 text-blue-600" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-10 grid md:grid-cols-2 gap-12">
                        {/* COLUMNA IZQUIERDA: MÉTRICAS Y DIRECCIÓN */}
                        <div className="space-y-10">
                            <div className="space-y-6">
                                <h3 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                    <Wallet className="text-blue-600 h-5 w-5"/> Control de Cobranza
                                </h3>
                                <div className="grid grid-cols-3 gap-5">
                                    <div className="p-5 rounded-3xl bg-muted/30 border-2 border-muted space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Progreso</p>
                                        <p className="font-black text-3xl">{currentLoanWeek} <span className="text-sm font-bold text-muted-foreground">/ {termInWeeksWithPenalty}</span></p>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-blue-50 border-2 border-blue-100 space-y-1">
                                        <p className="text-[10px] uppercase font-black text-blue-600">Abono</p>
                                        <p className="font-black text-3xl text-blue-700">{formatCurrency(weeklyPayment)}</p>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-red-50 border-2 border-red-100 space-y-1">
                                        <p className="text-[10px] uppercase font-black text-red-600">Fallos</p>
                                        <p className="font-black text-3xl text-red-700">{missedPayments}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <h3 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                    <MapPin className="text-blue-600 h-5 w-5"/> Ubicación del Titular
                                </h3>
                                <div className="p-6 rounded-3xl bg-muted/20 border-2 space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground">Dirección Registrada</p>
                                        <p className="font-bold text-lg uppercase leading-snug">{fullAddress}</p>
                                    </div>
                                    <div className="flex gap-4 pt-2">
                                        <div className="flex-1 space-y-1">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground">Localidad</p>
                                            <p className="font-black text-sm uppercase text-blue-700">{hierarchy.localidadName}</p>
                                        </div>
                                        <div className="flex-1 space-y-1 border-l-2 pl-4">
                                            <p className="text-[10px] font-black uppercase text-muted-foreground">Promotora</p>
                                            <p className="font-black text-sm uppercase text-blue-700">{hierarchy.promotoraName}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                    <FileText className="text-blue-600 h-5 w-5"/> Datos Financieros
                                </h3>
                                <div className="grid grid-cols-2 gap-y-8 gap-x-12">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Monto de Inicio</p>
                                        <p className="font-bold text-xl">{formatCurrency(loan.amount)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Tipo de Plan</p>
                                        <p className="font-bold text-xl uppercase text-blue-700">{loanPlan.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Fecha Contrato</p>
                                        <p className="font-bold text-xl">{formatDateFull(loan.startDate)}</p>
                                    </div>
                                    <div className="space-y-1 bg-red-50 p-4 rounded-2xl border-2 border-red-100">
                                        <p className="text-[10px] uppercase font-black text-red-600">Saldo Exigible Total</p>
                                        <p className="font-black text-3xl text-red-700 leading-none mt-1">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* COLUMNA DERECHA: AVAL Y GARANTÍA */}
                        <div className="space-y-8 md:border-l-4 md:border-muted md:pl-12">
                            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-3">
                                <Shield className="text-blue-600 h-5 w-5"/> Garantía y Responsable Solidario
                            </h3>
                            
                            <div className="p-8 rounded-[3rem] bg-blue-600 text-white space-y-8 relative overflow-hidden shadow-2xl shadow-blue-200">
                                <div className="absolute top-0 right-0 p-6 opacity-10">
                                    <UserCheck className="h-32 w-32" />
                                </div>
                                
                                <div className="space-y-2 relative z-10">
                                    <p className="text-[11px] uppercase font-black tracking-[0.2em] text-blue-200 flex items-center gap-2">
                                        <UserCheck className="h-4 w-4" /> Titular del Aval
                                    </p>
                                    <p className="font-black text-2xl uppercase leading-tight">{avalName}</p>
                                </div>
                                
                                <div className="space-y-4 relative z-10">
                                    <p className="text-[11px] uppercase font-black tracking-[0.2em] text-blue-200">Contacto Directo</p>
                                    <Button asChild className="bg-white hover:bg-blue-50 text-blue-700 font-black h-14 px-8 w-full rounded-2xl shadow-lg text-lg transition-transform active:scale-95" size="sm">
                                        <a href={`tel:${cleanPhone(avalPhone)}`}>
                                            <Phone className="mr-3 h-6 w-6" />
                                            {avalPhone}
                                        </a>
                                    </Button>
                                </div>
                                
                                <div className="space-y-2 relative z-10 pt-4 border-t border-blue-500/50">
                                    <p className="text-[11px] uppercase font-black tracking-[0.2em] text-blue-200">Dirección del Aval</p>
                                    <p className="font-bold text-sm uppercase leading-relaxed text-blue-50">{avalAddress}</p>
                                </div>
                            </div>

                            <div className="p-8 rounded-3xl bg-muted/40 border-2 border-dashed space-y-3">
                                <p className="text-[11px] uppercase font-black text-muted-foreground flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-blue-600" /> Garantía Declarada en Contrato
                                </p>
                                <p className="font-black text-base uppercase text-foreground/80 leading-snug">{client.guarantee || 'SIN GARANTÍA REGISTRADA'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-10 bg-muted/20 border-t-2 border-muted flex flex-col sm:flex-row justify-end gap-5">
                        <Button variant="outline" size="lg" onClick={() => handleWhatsApp()} className="font-black uppercase tracking-widest text-xs h-16 px-10 rounded-2xl border-4 hover:bg-green-50 hover:text-green-700 hover:border-green-300 transition-all active:scale-95 shadow-sm">
                            <MessageSquare className="mr-3 h-6 w-6 text-green-500" /> WhatsApp Directo
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase tracking-widest text-xs h-16 px-16 rounded-2xl shadow-2xl shadow-blue-300 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-95 border-b-4 border-blue-800">
                            <Wallet className="mr-3 h-6 w-6" /> $ Registrar Abono Hoy
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
