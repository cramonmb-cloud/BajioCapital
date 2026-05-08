'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, MessageSquare, MapPin, 
    Wallet, FileText, Shield, History as HistoryIcon, 
    X, Home
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
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
    plazaColor: string;
    isOverduePortfolio?: boolean;
    whatsappTemplate?: string;
    appName?: string;
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

export function OverdueCard({ details, allClients, allLoanPlans, plazaColor, isOverduePortfolio, whatsappTemplate, appName }: OverdueCardProps) {
    const { client, loan, loanPlan, hierarchy } = details;
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const { appUser } = useAuth();

    useEffect(() => {
        if (detailModalOpen) {
            window.dispatchEvent(new CustomEvent('hide-mobile-nav'));
        } else {
            window.dispatchEvent(new CustomEvent('show-mobile-nav'));
        }
    }, [detailModalOpen]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
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

    // RE-CÁLCULO DINÁMICO DE MÉTRICAS (Mismo que el servidor para consistencia)
    const metrics = useMemo(() => {
        const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
        const today = new Date();
        const loanStartDate = new Date(loan.startDate);
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
        
        const baseTerm = loanPlan.termInWeeks;
        let missedCount = 0;
        for (let i = 1; i <= baseTerm; i++) {
            if (i >= rawCurrentLoanWeek) break;
            const p = loan.payments.find(pay => pay.weekNumber === i);
            const amountPaid = p ? p.amount : 0;
            if (amountPaid < weeklyPayment) missedCount++;
        }

        const hasPenalty = missedCount >= 2;
        const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
        
        const totalExpected = weeklyPayment * termInWeeks;
        const totalPaid = loan.payments.reduce((acc, p) => acc + p.amount, 0);
        const balance = Math.max(0, totalExpected - totalPaid);
        const currentProgressWeek = Math.min(rawCurrentLoanWeek, termInWeeks);

        return {
            weeklyPayment,
            missedCount,
            termInWeeks,
            balance,
            currentProgressWeek,
            loanWeekDate: getSaturdayOfWeek(loanStartDate)
        };
    }, [loan, loanPlan]);

    const handleWhatsApp = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (client.phone) {
            const defaultTemplate = `Hola {{nombre_cliente}}, te contactamos de {{nombre_negocio}} para recordarte sobre tu préstamo pendiente de pago.`;
            let message = whatsappTemplate || defaultTemplate;

            const replacements: Record<string, string> = {
                '{{nombre_cliente}}': client.name.toUpperCase(),
                '{{domicilio_cliente}}': `${client.street}, ${client.neighborhood}`.toUpperCase(),
                '{{telefono_cliente}}': client.phone,
                '{{nombre_aval}}': avalName.toUpperCase(),
                '{{domicilio_aval}}': avalAddress.toUpperCase(),
                '{{telefono_aval}}': avalPhone,
                '{{monto_prestamo}}': formatCurrency(loan.amount),
                '{{saldo_pendiente}}': formatCurrency(metrics.balance),
                '{{fallos_registrados}}': metrics.missedCount.toString(),
                '{{nombre_negocio}}': appName || 'CREDICONTROL',
            };

            Object.keys(replacements).forEach(tag => {
                const regex = new RegExp(tag, 'g');
                message = message.replace(regex, replacements[tag]);
            });

            window.open(`https://wa.me/${client.phone}?text=${encodeURIComponent(message)}`, '_blank');
        }
    };

    const fullAddress = `${client.street}, ${client.neighborhood}, ${client.city}, ${client.postalCode}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

    return (
        <>
            <Card className="overflow-hidden border-l-[6px] transition-all hover:shadow-lg bg-white mb-3" style={{ borderLeftColor: plazaColor }}>
                <CardContent className="p-3 space-y-2.5">
                    {/* ENCABEZADO DE RUTA CON CONTORNOS */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b pb-1.5">
                        <Badge className="text-[8px] font-black uppercase px-1.5 h-4 shrink-0" style={{ backgroundColor: plazaColor }}>
                            PLAZA: {hierarchy.plazaName}
                        </Badge>
                        <div className="px-1.5 h-4 border border-zinc-400 rounded flex items-center shrink-0">
                            <span className="text-[8px] font-black text-zinc-600 uppercase whitespace-nowrap">
                                LOCALIDAD: {hierarchy.localidadName}
                            </span>
                        </div>
                        <div className="px-1.5 h-4 border border-zinc-400 rounded flex items-center shrink-0">
                            <span className="text-[8px] font-black text-zinc-600 uppercase whitespace-nowrap">
                                PROMOTORA: {hierarchy.promotoraName}
                            </span>
                        </div>
                    </div>

                    {/* Fila Superior: Nombre y Deuda */}
                    <div className="flex justify-between items-start gap-2">
                        <div className="cursor-pointer flex-1" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-black text-sm uppercase leading-tight text-foreground">{client.name}</h3>
                            <div className="flex items-start gap-1 text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold uppercase leading-tight">
                                    {client.street}, {client.neighborhood}
                                </p>
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={cn("text-[9px] font-black uppercase tracking-tighter", isOverduePortfolio ? 'text-orange-600' : 'text-red-600')}>Saldo</p>
                            <p className={cn("font-black text-lg tracking-tighter leading-none", isOverduePortfolio ? 'text-orange-700' : 'text-red-700')}>
                                {formatCurrency(metrics.balance)}
                            </p>
                        </div>
                    </div>

                    {/* Fila Media: Contacto Cliente */}
                    <div className="flex gap-2 items-center">
                        <Button asChild className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] rounded-lg flex-1 shadow-sm" size="sm">
                            <a href={`tel:${cleanPhone(client.phone)}`}>
                                <Phone className="mr-2 h-3.5 w-3.5" /> {client.phone}
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-8 w-10 p-0 rounded-lg border-green-200 hover:bg-green-50 shadow-sm">
                            <MessageSquare className="h-5 w-5 text-green-500" />
                        </Button>
                    </div>

                    {/* Bloque Aval COMPLETO */}
                    <div className="p-2.5 rounded-xl bg-blue-50/40 border border-blue-100 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <Shield className="h-2.5 w-2.5 text-blue-600" />
                                    <span className="text-[8px] font-black uppercase text-blue-700 tracking-widest">Responsable Solidario (Aval)</span>
                                </div>
                                <p className="text-[10px] font-black uppercase truncate text-blue-900">{avalName}</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-start gap-1.5 opacity-90">
                                <Home className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
                                <p className="text-[9px] font-bold uppercase text-blue-800 leading-tight">
                                    {avalAddress}
                                </p>
                            </div>
                            {avalPhone && (
                                <Button asChild className="h-7 bg-blue-700 hover:bg-blue-800 text-white font-black text-[10px] w-full rounded-lg" size="sm">
                                    <a href={`tel:${cleanPhone(avalPhone)}`}>
                                        <Phone className="mr-2 h-3 w-3" /> {avalPhone}
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Acciones Finales */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-dashed">
                        <div className="text-[9px] font-black text-muted-foreground uppercase opacity-80 flex items-center gap-1">
                            <HistoryIcon className="h-2.5 w-2.5" /> INICIÓ: {formatDate(metrics.loanWeekDate.toISOString())}
                        </div>
                        <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="h-8 bg-foreground text-background font-black text-[10px] uppercase px-5 rounded-lg active:scale-95 shadow-md">
                            <Wallet className="mr-1.5 h-4 w-4" /> Abonar
                        </Button>
                    </div>
                </CardContent>
            </Card>

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
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">PLAZA: {hierarchy.plazaName} • ID: {client.id}</p>
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
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2 rounded-lg bg-muted/30 border text-center">
                                    <p className="text-[7px] uppercase font-black text-muted-foreground">Progreso</p>
                                    <p className="font-black text-sm">{metrics.currentProgressWeek} / {metrics.termInWeeks}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-50 border-blue-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-blue-600">Abono Semanal</p>
                                    <p className="font-black text-sm text-blue-700">{formatCurrency(metrics.weeklyPayment)}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-red-50 border-red-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-red-600">Fallos</p>
                                    <p className="font-black text-sm text-red-700">{metrics.missedCount}</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-blue-600" /> Localización Cliente
                                        </h4>
                                        <div className="p-3 rounded-lg border text-xs space-y-2 bg-white">
                                            <p className="font-bold uppercase">{fullAddress}</p>
                                            <Button asChild className="h-8 bg-blue-600 text-white font-black text-[10px] w-full" size="sm">
                                                <a href={`tel:${cleanPhone(client.phone)}`}>
                                                    <Phone className="mr-1.5 h-3 w-3" /> {client.phone}
                                                </a>
                                            </Button>
                                            <Button variant="secondary" className="w-full h-8 text-[10px] font-bold" asChild>
                                                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">VER EN GOOGLE MAPS</a>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-blue-600" /> Saldo
                                        </h4>
                                        <div className="p-3 rounded-lg border bg-white flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-muted-foreground">RESTA TOTAL</span>
                                            <span className="text-lg font-black text-red-700">{formatCurrency(metrics.balance)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                        <Shield className="h-3 w-3 text-blue-600" /> Información del Aval
                                    </h4>
                                    <div className="p-4 rounded-xl bg-blue-600 text-white space-y-3 shadow-md">
                                        <div>
                                            <p className="text-[7px] uppercase font-black text-blue-200">Titular Aval</p>
                                            <p className="font-black text-sm uppercase leading-tight">{avalName}</p>
                                        </div>
                                        {avalPhone && (
                                            <Button asChild className="bg-white text-blue-700 font-black h-8 w-full text-xs" size="sm">
                                                <a href={`tel:${cleanPhone(avalPhone)}`}>TEL: {avalPhone}</a>
                                            </Button>
                                        )}
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
                weekNumber={metrics.currentProgressWeek}
                weekDate={metrics.loanWeekDate}
                initialAmount={metrics.balance > metrics.weeklyPayment ? metrics.weeklyPayment : metrics.balance}
                onPaymentRegistered={() => {
                    if (typeof window !== 'undefined') window.location.reload();
                }}
            />
        </>
    );
}
