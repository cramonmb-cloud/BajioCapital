'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, MessageSquare, MapPin, 
    Wallet, FileText, Shield, History as HistoryIcon, 
    X, Home, ListTodo, PencilLine
} from 'lucide-react';
import type { OverdueLoanDetails } from '@/app/dashboard/cartera-vencida/page';
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
import { ManualPaymentAdjustmentDialog } from './manual-payment-adjustment-dialog';

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
    const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
    
    // State for manual adjustment
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
    const [adjustData, setAdjustData] = useState<{ weekNumber: number, amount: number } | null>(null);

    const { appUser } = useAuth();
    const isCristobal = useMemo(() => appUser?.username.toUpperCase() === 'CRISTOBAL', [appUser]);

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

        let missedCount = 0;
        for (let i = 1; i <= baseTerm; i++) {
            const p = (loan.payments || []).find(pay => pay.weekNumber === i);
            if (!p || p.amount < weeklyPayment) {
                const dueDate = new Date(loanStartDate);
                dueDate.setUTCDate(dueDate.getUTCDate() + (i * 7));
                if (isExpired || today > dueDate) missedCount++;
            }
        }

        const hasPenalty = isExpired || (missedCount >= 2);
        
        const totalPaid = (loan.payments || []).reduce((acc, p) => acc + p.amount, 0);
        const totalExpected = (baseTerm + (hasPenalty ? 1 : 0)) * weeklyPayment;
        const totalDue = Math.max(0, totalExpected - totalPaid);

        const baseArrears = Math.max(0, (baseTerm * weeklyPayment) - totalPaid);
        const penaltyArrear = totalDue - baseArrears;

        return {
            weeklyPayment,
            termInWeeks: baseTerm + (hasPenalty ? 1 : 0),
            currentProgressWeek: Math.min(rawCurrentLoanWeek, baseTerm + (hasPenalty ? 1 : 0)),
            loanWeekDate: getSaturdayOfWeek(loanStartDate),
            hasPenalty,
            baseArrears,
            penaltyArrear,
            totalDue,
            missedCount,
            isExpired
        };
    }, [loan, loanPlan]);

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
            
            let statusType: 'PAID' | 'MISSED' | 'PENDING' = 'PENDING';
            let statusText = '';

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

    const handleAdjustClick = (weekNumber: number, currentAmount: number) => {
      if (!isCristobal) return;
      setAdjustData({ weekNumber, amount: currentAmount });
      setIsAdjustDialogOpen(true);
    };

    return (
        <>
            <Card className="overflow-hidden border-l-[6px] transition-all hover:shadow-lg bg-white mb-4" style={{ borderLeftColor: plazaColor }}>
                <CardContent className="p-3.5 space-y-3.5">
                    {/* HIERARCHY */}
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 pb-2">
                        <Badge className="text-[8px] font-black uppercase px-2 h-4 shrink-0 shadow-sm" style={{ backgroundColor: plazaColor }}>
                            PLAZA: {hierarchy.plazaName}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-black text-zinc-600 uppercase border-zinc-300 h-4 px-2">
                            ZONA: {hierarchy.localidadName}
                        </Badge>
                        <Badge variant="outline" className="text-[8px] font-black text-blue-600 uppercase border-blue-200 h-4 px-2 bg-blue-50/50">
                            RUTA: {hierarchy.promotoraName}
                        </Badge>
                    </div>

                    {/* CLIENT INFO */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1" onClick={() => setDetailModalOpen(true)}>
                                <h3 className="font-black text-sm uppercase leading-tight text-foreground tracking-tight">{client.name}</h3>
                                <div className="flex items-center gap-1.5 text-zinc-500 mt-1">
                                    <Home className="h-3 w-3 shrink-0 text-blue-500" />
                                    <span className="text-[10px] font-bold uppercase leading-tight">
                                        {client.street}, {client.neighborhood}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <Button asChild variant="outline" className="h-10 px-4 rounded-full border-blue-200 text-blue-700 hover:bg-blue-50 shadow-md font-black text-xs" size="sm">
                                    <a href={`tel:${cleanPhone(client.phone)}`} title="Llamar Cliente">
                                        <Phone className="h-4 w-4 mr-2" />
                                        {client.phone}
                                    </a>
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleWhatsApp} className="h-9 w-full border-green-200 text-green-700 hover:bg-green-50 shadow-sm rounded-full font-black text-[10px]">
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    WHATSAPP
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* AVAL INFO */}
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-zinc-300" />
                        <div className="flex justify-between items-start gap-2 pl-1">
                            <div className="flex-1">
                                <p className="text-[7px] font-black uppercase text-muted-foreground tracking-widest mb-0.5">Responsable Solidario (Aval)</p>
                                <p className="text-[11px] font-black uppercase leading-tight text-zinc-800">{avalName}</p>
                                <div className="flex items-start gap-1.5 text-zinc-500 mt-1">
                                    <MapPin className="h-2.5 w-2.5 shrink-0 mt-0.5" />
                                    <span className="text-[9px] font-bold uppercase leading-tight">{avalAddress}</span>
                                </div>
                            </div>
                            {avalPhone && (
                                <Button asChild variant="outline" className="h-10 px-4 rounded-full border-zinc-300 text-zinc-700 hover:bg-white bg-white shadow-md shrink-0 font-black text-[10px]" size="sm">
                                    <a href={`tel:${cleanPhone(avalPhone)}`} title="Llamar Aval">
                                        <Phone className="h-4 w-4 mr-2" />
                                        {avalPhone}
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* FINANCIAL SUMMARY */}
                    <div className="flex items-end justify-between gap-4 pt-1">
                        <div className="flex flex-wrap gap-1.5">
                            <Badge variant="destructive" className="h-5 px-2 text-[9px] font-black uppercase shadow-sm">
                                {metrics.missedCount} FALLOS
                            </Badge>
                            {metrics.hasPenalty && (
                                <Badge className="h-5 px-2 text-[9px] font-black bg-orange-500 text-white uppercase shadow-sm">
                                    S. EXTRA
                                </Badge>
                            )}
                        </div>

                        <div className="text-right bg-red-50 px-3 py-2 rounded-lg border border-red-100 min-w-[140px] shadow-inner">
                            <div className="flex flex-col">
                                <div className="flex justify-between items-center gap-4 text-[9px] font-bold text-zinc-500 uppercase">
                                    <span>Saldo Fallos:</span>
                                    <span>{formatCurrency(metrics.baseArrears)}</span>
                                </div>
                                {metrics.hasPenalty && (
                                    <div className="flex justify-between items-center gap-4 text-[9px] font-bold text-orange-600 uppercase border-b border-orange-200 pb-1 mb-1">
                                        <span>Semana Extra:</span>
                                        <span>+{formatCurrency(metrics.penaltyArrear)}</span>
                                    </div>
                                )}
                                <span className="text-[7px] font-black text-red-600 uppercase leading-none mb-0.5 mt-1">Total a Deber</span>
                                <span className="text-lg font-black text-red-700 tracking-tighter leading-none">
                                    {formatCurrency(metrics.totalDue)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER ACTIONS */}
                    <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-dashed border-zinc-200">
                        <div className="text-[9px] font-black text-muted-foreground uppercase opacity-80 flex items-center gap-1.5">
                            <HistoryIcon className="h-3.5 w-3.5" /> INICIÓ: {formatDate(metrics.loanWeekDate.toISOString())}
                        </div>
                        <Button size="sm" onClick={() => setDetailModalOpen(true)} className="h-8 bg-zinc-900 text-white font-black text-[10px] uppercase px-6 rounded-lg shadow-lg hover:bg-zinc-800 active:scale-95 transition-all">
                            <Wallet className="mr-1.5 h-3.5 w-3.5" /> Detalle
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="px-5 py-4 border-b shrink-0 flex flex-row items-center justify-between bg-muted/10">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-md">
                                <AvatarImage src={client.avatarUrl} alt={client.name} />
                                <AvatarFallback className="font-black text-xs bg-blue-100 text-blue-700">{client.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-sm font-black uppercase leading-none tracking-tight">{client.name}</DialogTitle>
                                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1.5">RUTA: {hierarchy.promotoraName} • ID: {client.id}</p>
                            </div>
                        </div>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>

                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-5 space-y-6">
                            <div className={cn("grid gap-2.5", metrics.hasPenalty ? "grid-cols-4" : "grid-cols-3")}>
                                <div className="p-3 rounded-xl bg-muted/30 border text-center">
                                    <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest mb-1">Progreso</p>
                                    <p className="font-black text-base">{metrics.currentProgressWeek} / {metrics.termInWeeks}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-blue-50 border-blue-100 text-center">
                                    <p className="text-[8px] uppercase font-black text-blue-600 tracking-widest mb-1">Abono</p>
                                    <p className="font-black text-base text-blue-700">{formatCurrency(metrics.weeklyPayment)}</p>
                                </div>
                                <div className="p-3 rounded-xl bg-red-50 border-red-100 text-center">
                                    <p className="text-[8px] uppercase font-black text-red-600 tracking-widest mb-1">Fallos</p>
                                    <p className="font-black text-base text-red-700">{metrics.missedCount}</p>
                                </div>
                                {metrics.hasPenalty && (
                                    <div className="p-3 rounded-xl bg-orange-500 border-orange-600 text-center flex flex-col justify-center shadow-sm">
                                        <p className="text-[8px] uppercase font-black text-white tracking-widest mb-0.5">S. Extra</p>
                                        <p className="font-black text-[11px] text-white leading-none">ACTIVA</p>
                                    </div>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-5">
                                    <div className="space-y-2.5">
                                        <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-600" /> Detalle del Adeudo
                                        </h4>
                                        <div className="p-5 rounded-2xl border bg-white space-y-3 shadow-inner">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-bold text-muted-foreground uppercase text-[9px]">Suma de Fallos</span>
                                                <span className="font-black text-zinc-800">{formatCurrency(metrics.baseArrears)}</span>
                                            </div>
                                            {metrics.hasPenalty && (
                                                <div className="flex justify-between items-center text-xs border-b border-dashed border-zinc-200 pb-3">
                                                    <span className="font-bold text-orange-600 uppercase text-[9px]">Semana de Penalización</span>
                                                    <span className="font-black text-orange-600">+{formatCurrency(metrics.penaltyArrear)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="font-black text-red-700 uppercase text-[10px]">Total a Liquidar</span>
                                                <span className="text-2xl font-black text-red-700 tracking-tighter">
                                                    {formatCurrency(metrics.totalDue)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                            <Home className="h-4 w-4 text-blue-600" /> Domicilio Cliente
                                        </h4>
                                        <div className="p-4 rounded-xl border text-[11px] bg-muted/5 font-bold uppercase leading-relaxed shadow-sm">
                                            {client.street}, {client.neighborhood}, {client.city}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2.5">
                                    <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-blue-600" /> Información del Aval
                                    </h4>
                                    <div className="p-5 rounded-2xl bg-zinc-900 text-white space-y-4 shadow-xl">
                                        <div>
                                            <p className="text-[8px] uppercase font-black text-zinc-400 tracking-widest mb-1">Aval / Responsable</p>
                                            <p className="font-black text-base uppercase leading-tight">{avalName}</p>
                                        </div>
                                        {avalPhone && (
                                            <Button asChild className="bg-white text-zinc-900 hover:bg-zinc-100 font-black h-11 w-full text-xs rounded-xl shadow-md" size="sm">
                                                <a href={`tel:${cleanPhone(avalPhone)}`}>
                                                    <Phone className="mr-2 h-4 w-4 text-blue-600" /> {avalPhone}
                                                </a>
                                            </Button>
                                        )}
                                        <div className="pt-2 border-t border-zinc-700">
                                            <p className="text-[9px] font-bold uppercase leading-relaxed text-zinc-300 opacity-90">{avalAddress}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                    
                    <div className="p-4 bg-muted/30 border-t flex gap-3 shrink-0">
                        <Button variant="outline" onClick={() => setHistoryDialogOpen(true)} className="font-black uppercase text-[10px] h-11 flex-1 rounded-xl border-zinc-300 bg-white hover:bg-zinc-50 shadow-sm">
                            <ListTodo className="mr-2 h-4 w-4 text-blue-600" /> Historial de Abonos
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase text-[10px] h-11 flex-1 rounded-xl bg-blue-600 text-white shadow-xl hover:bg-blue-700 active:scale-95 transition-all">
                            <Wallet className="mr-2 h-4 w-4" /> Registrar Abono
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl">
                    <DialogHeader className="p-6 pb-3 border-b shrink-0 flex flex-row items-center justify-between bg-muted/5">
                        <DialogTitle className="text-sm font-black uppercase text-center w-full tracking-wider">Estado de cuenta detallado</DialogTitle>
                        <DialogClose asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full p-6">
                            <Table className="border border-zinc-200">
                                <TableHeader className="bg-zinc-100 sticky top-0 z-10">
                                    <TableRow className="hover:bg-zinc-100 border-zinc-200">
                                        <TableHead className="text-zinc-900 font-black border-r border-zinc-200 text-center uppercase text-[9px]">Semanas</TableHead>
                                        <TableHead className="text-zinc-900 font-black border-r border-zinc-200 uppercase text-[9px]">Vencimiento</TableHead>
                                        <TableHead className="text-zinc-900 font-black border-r border-zinc-200 text-right uppercase text-[9px]">Cuota Fija</TableHead>
                                        <TableHead className="text-zinc-900 font-black border-r border-zinc-200 text-right uppercase text-[9px]">Importe Pagado</TableHead>
                                        <TableHead className="text-zinc-900 font-black text-center uppercase text-[9px]">Estado de Pago</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loanHistoryData.map((row) => (
                                        <TableRow key={row.num} className={cn("border-zinc-100 hover:bg-zinc-50/50", row.isPenalty && "bg-orange-50/40")}>
                                            <TableCell className="border-r border-zinc-100 text-center py-2 font-black text-xs">
                                                {row.num}
                                                {row.isPenalty && <span className="ml-1 text-[7px] text-orange-600 block leading-none font-black tracking-tighter">EXTRA</span>}
                                            </TableCell>
                                            <TableCell className="border-r border-zinc-100 py-2 text-[10px] font-bold text-zinc-600">{row.vencimiento}</TableCell>
                                            <TableCell className="border-r border-zinc-100 text-right py-2 font-bold text-zinc-800">{formatCurrency(row.importeAbono)}</TableCell>
                                            <TableCell 
                                                className={cn(
                                                    "border-r border-zinc-100 text-right py-2 font-black relative group", 
                                                    row.status === 'PAID' ? "bg-green-50 text-green-700" : 
                                                    row.status === 'MISSED' ? "bg-red-50 text-red-700" : 
                                                    "bg-blue-50/20 text-blue-600",
                                                    isCristobal && "cursor-pointer hover:bg-zinc-200 transition-colors"
                                                )}
                                                onClick={() => isCristobal && handleAdjustClick(row.num, row.importeRecibido)}
                                            >
                                                <div className="flex items-center justify-end gap-2">
                                                    {formatCurrency(row.importeRecibido)}
                                                    {isCristobal && (
                                                        <PencilLine className="h-3 w-3 opacity-0 group-hover:opacity-100 text-blue-600 shrink-0" />
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className={cn(
                                                "text-center py-2 text-[10px] font-black uppercase tracking-tight", 
                                                row.status === 'PAID' ? "text-green-600/70" : 
                                                row.status === 'MISSED' ? "text-red-600 font-black" : 
                                                "text-blue-600 animate-pulse"
                                            )}>
                                                {row.status === 'PENDING' ? (
                                                    <span className="text-blue-600 font-black">PENDIENTE</span>
                                                ) : row.fechaAbono}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="bg-zinc-50 border-t-2 border-zinc-300">
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right font-black text-zinc-900 uppercase text-[10px] py-3">Saldo Actual Exigible</TableCell>
                                        <TableCell className="text-right font-black text-red-700 text-lg py-3" colSpan={2}>
                                            {formatCurrency(metrics.totalDue)}
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </ScrollArea>
                    </div>
                    <div className="p-4 border-t flex justify-end bg-muted/10 shrink-0">
                        <Button variant="secondary" className="font-black uppercase text-[10px] rounded-lg" onClick={() => setHistoryDialogOpen(false)}>Cerrar Reporte</Button>
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

            {adjustData && (
                <ManualPaymentAdjustmentDialog
                    isOpen={isAdjustDialogOpen}
                    onOpenChange={setIsAdjustDialogOpen}
                    loan={loan}
                    weekNumber={adjustData.weekNumber}
                    currentAmount={adjustData.amount}
                    onSuccess={() => {
                        if (typeof window !== 'undefined') window.location.reload();
                    }}
                />
            )}
        </>
    );
}
