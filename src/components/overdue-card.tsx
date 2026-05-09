'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, MessageSquare, MapPin, 
    Wallet, FileText, Shield, History as HistoryIcon, 
    X, Home, ListTodo, AlertTriangle
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from '@/components/ui/table';

interface OverdueCardProps {
    details: OverdueLoanDetails;
    allClients: Client[];
    allLoanPlans: LoanPlan[];
    plazaColor: string;
    isOverduePortfolio?: boolean; // True para Pagos Pendientes, False para Cartera Vencida
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
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    const { appUser } = useAuth();

    useEffect(() => {
        if (detailModalOpen || historyDialogOpen) {
            window.dispatchEvent(new CustomEvent('hide-mobile-nav'));
        } else {
            window.dispatchEvent(new CustomEvent('show-mobile-nav'));
        }
    }, [detailModalOpen, historyDialogOpen]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);
    };
    
    const formatDate = (dateString: string) => {
      const date = new Date(dateString);
      const userTimezoneOffset = date.getTimezoneOffset() * 60000;
      const correctedDate = new Date(date.getTime() + userTimezoneOffset);
      return correctedDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' })
    };

    const metrics = useMemo(() => {
        const weeklyPayment = (loan.amount / 1000) * loanPlan.weeklyPaymentRate;
        const today = new Date();
        const loanStartDate = new Date(loan.startDate);
        const baseTerm = loanPlan.termInWeeks;
        
        const timeDiff = today.getTime() - loanStartDate.getTime();
        const rawCurrentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);
        const isExpired = rawCurrentLoanWeek > baseTerm;

        let baseArrears = 0;
        let registeredMissedCount = 0;

        for (let i = 1; i <= baseTerm; i++) {
            const p = (loan.payments || []).find(pay => pay.weekNumber === i);
            const amountPaid = p ? p.amount : 0;
            const dueDate = new Date(loanStartDate);
            dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
            
            if (amountPaid < weeklyPayment) {
                if (isExpired || today > dueDate) {
                    baseArrears += (weeklyPayment - amountPaid);
                    registeredMissedCount++;
                }
            }
        }

        // REGLA DE PENALIZACIÓN UNIFICADA Y OBLIGATORIA
        // Cartera Vencida (!isOverduePortfolio) -> PENALIZACIÓN SIEMPRE OBLIGATORIA.
        // Pagos Pendientes (isOverduePortfolio) -> Requiere 2+ fallos.
        const hasPenalty = !isOverduePortfolio || (registeredMissedCount >= 2);

        let penaltyArrear = 0;
        if (hasPenalty) {
            const penaltyWeekNum = baseTerm + 1;
            const pExtra = (loan.payments || []).find(pay => pay.weekNumber === penaltyWeekNum);
            penaltyArrear = weeklyPayment - (pExtra?.amount || 0);
        }

        const totalDue = baseArrears + penaltyArrear;
        const termInWeeks = baseTerm + (hasPenalty ? 1 : 0);
        const currentProgressWeek = Math.min(rawCurrentLoanWeek, termInWeeks);

        return {
            weeklyPayment,
            termInWeeks,
            currentProgressWeek,
            loanWeekDate: getSaturdayOfWeek(loanStartDate),
            hasPenalty,
            baseArrears,
            penaltyArrear,
            totalDue,
            missedCount: registeredMissedCount
        };
    }, [loan, loanPlan, isOverduePortfolio]);

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

    const loanHistoryData = useMemo(() => {
        const weeklyPayment = metrics.weeklyPayment;
        const termInWeeks = metrics.termInWeeks;
        const startDate = new Date(loan.startDate);
        const today = new Date();
        
        const rows = [];
        for(let i = 1; i <= termInWeeks; i++) {
            const dueDate = new Date(startDate);
            dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
            
            const payment = (loan.payments || []).find(p => p.weekNumber === i);
            const isRegistered = !!payment;
            const isPast = today > dueDate;
            
            let statusText = '';
            let statusType: 'PAID' | 'MISSED' | 'PENDING' = 'PENDING';

            if (isRegistered) {
                if (payment.amount >= weeklyPayment) {
                    statusText = formatDate(payment.date);
                    statusType = 'PAID';
                } else {
                    statusText = 'FALLO';
                    statusType = 'MISSED';
                }
            } else if (isPast) {
                statusText = 'FALLO';
                statusType = 'MISSED';
            } else {
                statusText = 'PENDIENTE';
                statusType = 'PENDING';
            }
            
            rows.push({
                num: i,
                vencimiento: dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                importeAbono: weeklyPayment,
                importeRecibido: isRegistered ? payment.amount : 0,
                fechaAbono: statusText,
                isPenalty: i > loanPlan.termInWeeks,
                status: statusType
            });
        }
        return rows;
    }, [loan, loanPlan, metrics]);

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
                '{{saldo_pendiente}}': formatCurrency(metrics.totalDue),
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

    return (
        <>
            <Card className="overflow-hidden border-l-[6px] transition-all hover:shadow-lg bg-white mb-3" style={{ borderLeftColor: plazaColor }}>
                <CardContent className="p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b pb-1.5">
                        <div className='flex items-center gap-1.5'>
                            <Badge className="text-[8px] font-black uppercase px-1.5 h-4 shrink-0" style={{ backgroundColor: plazaColor }}>
                                PLAZA: {hierarchy.plazaName}
                            </Badge>
                            <div className="px-1.5 h-4 border border-zinc-300 rounded flex items-center shrink-0">
                                <span className="text-[8px] font-black text-zinc-600 uppercase whitespace-nowrap">
                                    ZONA: {hierarchy.localidadName}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-start gap-2">
                        <div className="cursor-pointer flex-1" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-black text-sm uppercase leading-tight text-foreground">{client.name}</h3>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <Badge variant="outline" className="h-5 px-2 text-[9px] font-black bg-red-50 text-red-700 border-red-200 uppercase">
                                    {metrics.missedCount} {metrics.missedCount === 1 ? 'FALLO' : 'FALLOS'}
                                </Badge>
                                {metrics.hasPenalty && (
                                    <Badge className="h-5 px-2 text-[9px] font-black bg-orange-500 text-white shadow-sm uppercase">
                                        S. EXTRA
                                    </Badge>
                                )}
                            </div>
                        </div>
                        
                        <div className="text-right shrink-0 bg-zinc-50 p-2 rounded-lg border border-zinc-200 min-w-[115px]">
                            <div className="space-y-0.5">
                                <div className="flex justify-between gap-2 text-[7px] font-black text-muted-foreground uppercase">
                                    <span>Saldo Fallos</span>
                                    <span>{formatCurrency(metrics.baseArrears)}</span>
                                </div>
                                {metrics.hasPenalty && (
                                    <div className="flex justify-between gap-2 text-[7px] font-black text-orange-600 uppercase border-b border-zinc-200 pb-0.5">
                                        <span>Semana Extra</span>
                                        <span>+{formatCurrency(metrics.penaltyArrear)}</span>
                                    </div>
                                )}
                                <div className="flex flex-col items-end pt-1">
                                    <span className="text-[7px] font-black text-red-700 uppercase leading-none mb-0.5">Total a Deber</span>
                                    <span className="text-sm font-black text-red-700 tracking-tighter leading-none">{formatCurrency(metrics.totalDue)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 items-center">
                        <Button asChild className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] rounded-lg flex-1" size="sm">
                            <a href={`tel:${cleanPhone(client.phone)}`}>
                                <Phone className="mr-2 h-3.5 w-3.5" /> {client.phone}
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-8 w-10 p-0 rounded-lg border-green-200 hover:bg-green-50 shadow-sm">
                            <MessageSquare className="h-5 w-5 text-green-500" />
                        </Button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-dashed">
                        <div className="text-[9px] font-black text-muted-foreground uppercase opacity-80 flex items-center gap-1">
                            <HistoryIcon className="h-2.5 w-2.5" /> INICIÓ: {formatDate(metrics.loanWeekDate.toISOString())}
                        </div>
                        <Button size="sm" onClick={() => setDetailModalOpen(true)} className="h-8 bg-foreground text-background font-black text-[10px] uppercase px-5 rounded-lg shadow-md">
                            <Wallet className="mr-1.5 h-4 w-4" /> Detalle
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="px-5 py-3 border-b shrink-0 flex flex-row items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border shadow-sm">
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
                            <div className={cn("grid gap-2", metrics.hasPenalty ? "grid-cols-4" : "grid-cols-3")}>
                                <div className="p-2 rounded-lg bg-muted/30 border text-center">
                                    <p className="text-[7px] uppercase font-black text-muted-foreground">Progreso</p>
                                    <p className="font-black text-sm">{metrics.currentProgressWeek} / {metrics.termInWeeks}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-blue-50 border-blue-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-blue-600">Abono</p>
                                    <p className="font-black text-sm text-blue-700">{formatCurrency(metrics.weeklyPayment)}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-red-50 border-red-100 text-center">
                                    <p className="text-[7px] uppercase font-black text-red-600">Fallos</p>
                                    <p className="font-black text-sm text-red-700">{metrics.missedCount}</p>
                                </div>
                                {metrics.hasPenalty && (
                                    <div className="p-2 rounded-lg bg-orange-500 border-orange-600 text-center flex flex-col justify-center">
                                        <p className="text-[7px] uppercase font-black text-white">S. Extra</p>
                                        <p className="font-black text-[10px] text-white leading-tight">ACTIVA</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-blue-600" /> Detalle del Saldo Deudor
                                        </h4>
                                        <div className="p-4 rounded-xl border bg-white space-y-2 shadow-inner">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-muted-foreground uppercase text-[9px]">Suma de Fallos</span>
                                                <span className="font-black text-zinc-800">{formatCurrency(metrics.baseArrears)}</span>
                                            </div>
                                            {metrics.hasPenalty && (
                                                <div className="flex justify-between items-center text-xs border-b border-dashed pb-2">
                                                    <span className="font-bold text-orange-600 uppercase text-[9px]">Semana de Penalización</span>
                                                    <span className="font-black text-orange-600">+{formatCurrency(metrics.penaltyArrear)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-2">
                                                <span className="font-black text-red-700 uppercase text-[10px]">Total a Liquidar</span>
                                                <span className="text-xl font-black text-red-700 tracking-tighter">{formatCurrency(metrics.totalDue)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                            <MapPin className="h-3 w-3 text-blue-600" /> Dirección Cliente
                                        </h4>
                                        <div className="p-3 rounded-lg border text-[10px] bg-muted/5 font-bold uppercase leading-tight">
                                            {client.street}, {client.neighborhood}, {client.city}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="text-[9px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
                                        <Shield className="h-3 w-3 text-blue-600" /> Información del Aval
                                    </h4>
                                    <div className="p-4 rounded-xl bg-blue-600 text-white space-y-3 shadow-md">
                                        <div>
                                            <p className="text-[7px] uppercase font-black text-blue-200">Responsable Solidario</p>
                                            <p className="font-black text-sm uppercase leading-tight">{avalName}</p>
                                        </div>
                                        {avalPhone && (
                                            <Button asChild className="bg-white text-blue-700 font-black h-8 w-full text-xs" size="sm">
                                                <a href={`tel:${cleanPhone(avalPhone)}`}>TEL: {avalPhone}</a>
                                            </Button>
                                        )}
                                        <p className="text-[9px] font-bold uppercase leading-relaxed text-blue-50 opacity-80">{avalAddress}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 bg-muted/30 border-t flex gap-2">
                        <Button variant="outline" onClick={() => setHistoryDialogOpen(true)} className="font-black uppercase text-[10px] h-10 flex-1 rounded-lg border-blue-200 bg-white">
                            <ListTodo className="mr-1.5 h-4 w-4" /> Historial de Abonos
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase text-[10px] h-10 flex-1 rounded-lg bg-blue-600 text-white shadow-lg">
                            <Wallet className="mr-1.5 h-4 w-4" /> Abonar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="p-6 pb-2 border-b shrink-0 flex flex-row items-center justify-between">
                        <DialogTitle className="text-sm font-black uppercase text-center w-full">Detalle de todos los abonos</DialogTitle>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full p-6">
                            <Table className="border border-blue-200">
                                <TableHeader className="bg-blue-100 sticky top-0 z-10">
                                    <TableRow className="hover:bg-blue-100 border-blue-200">
                                        <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-center">Num Abono</TableHead>
                                        <TableHead className="text-blue-900 font-bold border-r border-blue-200">Vencimiento</TableHead>
                                        <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-right">Cuota</TableHead>
                                        <TableHead className="text-blue-900 font-bold border-r border-blue-200 text-right">Pagado</TableHead>
                                        <TableHead className="text-blue-900 font-bold text-center">Estado / Fecha</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loanHistoryData.map((row) => (
                                        <TableRow key={row.num} className={cn("border-blue-100 hover:bg-blue-50/50", row.isPenalty && "bg-orange-50/40")}>
                                            <TableCell className="border-r border-blue-100 text-center py-1 font-bold">
                                                {row.num}
                                                {row.isPenalty && <span className="ml-1 text-[8px] text-orange-600 block leading-none font-black">EXTRA</span>}
                                            </TableCell>
                                            <TableCell className="border-r border-blue-100 py-1 text-[10px] font-bold">{row.vencimiento}</TableCell>
                                            <TableCell className="border-r border-blue-100 text-right py-1 font-bold">{formatCurrency(row.importeAbono)}</TableCell>
                                            <TableCell className={cn(
                                                "border-r border-blue-100 text-right py-1 font-black", 
                                                row.status === 'PAID' ? "bg-green-50 text-green-700" : 
                                                row.status === 'MISSED' ? "bg-red-50 text-red-700" : 
                                                "bg-blue-50/30 text-blue-600"
                                            )}>
                                                {formatCurrency(row.importeRecibido)}
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-center py-1 text-[10px] font-black uppercase", 
                                                row.status === 'PAID' ? "text-muted-foreground/80 font-bold" : 
                                                row.status === 'MISSED' ? "text-red-600 animate-pulse font-black" : 
                                                "text-blue-600 font-bold"
                                            )}>
                                                {row.fechaAbono}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-zinc-50 border-t-2 border-blue-300">
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right font-black text-blue-900 uppercase text-xs">Total Deuda Calculada</TableCell>
                                        <TableCell className="text-right font-black text-red-700 text-sm" colSpan={2}>
                                            {formatCurrency(metrics.totalDue)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </ScrollArea>
                    </div>
                    <div className="p-4 border-t flex justify-end bg-muted/10 shrink-0">
                        <Button variant="secondary" className="font-bold" onClick={() => setHistoryDialogOpen(false)}>Cerrar Historial</Button>
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
                initialAmount={metrics.totalDue > metrics.weeklyPayment ? metrics.weeklyPayment : metrics.totalDue}
                onPaymentRegistered={() => {
                    if (typeof window !== 'undefined') window.location.reload();
                }}
            />
        </>
    );
}