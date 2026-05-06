'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, User, Calendar, MessageSquare, Building, MapPin, 
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

    const debtLabel = isOverduePortfolio ? "Acumulado Fallos" : "Saldo Pendiente";

    return (
        <>
            <Card className="overflow-hidden border-t-4 transition-all hover:shadow-md group/card" style={{ borderTopColor: plazaColor }}>
                {/* Cabecera de Plaza */}
                <div className="px-4 py-1.5 border-b flex justify-between items-center" style={{ backgroundColor: `${plazaColor}10` }}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: plazaColor }}>
                        <Building className="h-3 w-3" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant="destructive" className="text-[9px] h-4 font-black px-1.5 animate-pulse">
                        MORA
                    </Badge>
                </div>

                <CardContent className="p-0">
                    {/* Sección Titular */}
                    <div className="p-4 space-y-3">
                        <div className="cursor-pointer" onClick={() => setDetailModalOpen(true)}>
                            <h3 className="font-extrabold text-lg leading-tight uppercase group-hover/card:text-primary transition-colors line-clamp-1">{client.name}</h3>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tight">
                                <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {hierarchy.localidadName}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" /> {hierarchy.promotoraName}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 items-center">
                            <Button asChild className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-sm" size="sm">
                                <a href={`tel:${cleanPhone(client.phone)}`}>
                                    <Phone className="mr-1.5 h-3.5 w-3.5" />
                                    {client.phone || 'LLAMAR'}
                                </a>
                            </Button>
                            <div className="text-[10px] text-right font-bold text-muted-foreground uppercase">
                                <p>Inició</p>
                                <p className="text-foreground">{formatDate(loanWeekDate.toISOString())}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sección Aval (Diseño Diferenciado) */}
                    <div className="mx-4 mb-4 p-3 rounded-2xl bg-primary/5 border border-primary/10 space-y-2 relative overflow-hidden">
                        <div className="flex items-center gap-1.5 text-primary">
                            <UserCheck className="h-3.5 w-3.5" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Aval Responsable</span>
                        </div>
                        <p className="text-xs font-black uppercase leading-tight text-foreground/90 line-clamp-1">{avalName}</p>
                        
                        <div className="flex flex-col gap-2">
                            <Button asChild className="h-8 bg-blue-600/90 hover:bg-blue-600 text-white font-bold text-[10px] rounded-lg" size="sm">
                                <a href={`tel:${cleanPhone(avalPhone)}`}>
                                    <Phone className="mr-1.5 h-3 w-3" />
                                    {avalPhone !== 'SIN TELÉFONO' ? avalPhone : 'LLAMAR AVAL'}
                                </a>
                            </Button>
                            <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/80 leading-tight uppercase font-medium">
                                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span className="line-clamp-2">{avalAddress}</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Sección Financiera */}
                    <div className="px-4 py-3 bg-muted/30 border-t border-b flex justify-between items-center">
                        <div className="space-y-0.5">
                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">Préstamo</p>
                            <p className="font-bold text-xs">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                            <p className="text-[9px] text-destructive uppercase font-black tracking-tighter">{debtLabel}</p>
                            <p className="font-black text-xl text-destructive tracking-tight">{formatCurrency(amountDue)}</p>
                        </div>
                    </div>

                    {/* Botones de Acción Final */}
                    <div className="p-2 grid grid-cols-2 gap-2">
                        <Button variant="ghost" size="sm" onClick={handleWhatsApp} className="h-10 font-black text-[10px] uppercase tracking-wider rounded-xl border hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-all">
                            <MessageSquare className="mr-1.5 h-4 w-4" />
                            WhatsApp
                        </Button>
                        <Button size="sm" onClick={() => setPaymentDialogOpen(true)} className="h-10 font-black text-[10px] uppercase tracking-wider rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">
                            <Wallet className="mr-1.5 h-4 w-4" />
                            Abonar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Modal de Detalle Extendido */}
            <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0 rounded-3xl border-none shadow-2xl">
                    <div className="sticky top-0 bg-background/80 backdrop-blur-md z-10 p-6 border-b">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div className="flex items-center gap-5">
                                <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-xl">
                                    <AvatarImage src={client.avatarUrl} alt={client.name} />
                                    <AvatarFallback className="text-3xl font-black bg-primary/10">{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">{client.name}</h2>
                                    <Badge variant="outline" className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">ID: {client.id}</Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-black h-12 px-6 rounded-2xl flex-1 md:flex-none shadow-lg shadow-blue-200" size="lg">
                                    <a href={`tel:${cleanPhone(client.phone)}`}>
                                        <Phone className="mr-2 h-5 w-5" />
                                        {client.phone}
                                    </a>
                                </Button>
                                <Button variant="secondary" className="h-12 w-12 rounded-2xl p-0" asChild>
                                    <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                                        <Map className="h-6 w-6" />
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 grid md:grid-cols-2 gap-10">
                        {/* Columna Financiera */}
                        <div className="space-y-8">
                            <div className="space-y-4">
                                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                    <Wallet className="text-primary h-4 w-4"/> Control de Pagos
                                </h3>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="p-4 rounded-2xl bg-muted/30 border space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Progreso</p>
                                        <p className="font-black text-2xl">{currentLoanWeek} <span className="text-sm font-bold text-muted-foreground">/ {termInWeeksWithPenalty}</span></p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-1">
                                        <p className="text-[10px] uppercase font-black text-blue-600">Cuota</p>
                                        <p className="font-black text-2xl text-blue-700">{formatCurrency(weeklyPayment)}</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 space-y-1">
                                        <p className="text-[10px] uppercase font-black text-red-600">Fallos</p>
                                        <p className="font-black text-2xl text-red-700">{missedPayments}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <Separator />

                            <div className="space-y-4">
                                <h3 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                    <FileText className="text-primary h-4 w-4"/> Datos del Préstamo
                                </h3>
                                <div className="grid grid-cols-2 gap-y-6 gap-x-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Capital Original</p>
                                        <p className="font-bold text-lg">{formatCurrency(loan.amount)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Plan Seleccionado</p>
                                        <p className="font-bold text-lg uppercase">{loanPlan.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-muted-foreground">Fecha Contratación</p>
                                        <p className="font-bold text-lg">{formatDateFull(loan.startDate)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-black text-red-600">Saldo Exigible Real</p>
                                        <p className="font-black text-2xl text-red-600">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Columna Aval */}
                        <div className="space-y-6 md:border-l md:pl-10">
                            <h3 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Shield className="text-primary h-4 w-4"/> Garantía y Responsable
                            </h3>
                            
                            <div className="p-6 rounded-[2rem] bg-primary/5 border-2 border-primary/10 space-y-6 relative">
                                <div className="space-y-1.5">
                                    <p className="text-[10px] uppercase font-black text-primary/60 flex items-center gap-1.5">
                                        <UserCheck className="h-3.5 w-3.5" /> Avalista
                                    </p>
                                    <p className="font-black text-xl uppercase text-foreground leading-tight">{avalName}</p>
                                </div>
                                
                                <div className="space-y-2.5">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground">Contacto Aval</p>
                                    <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-black h-12 px-6 w-full rounded-2xl shadow-md" size="sm">
                                        <a href={`tel:${cleanPhone(avalPhone)}`}>
                                            <Phone className="mr-2 h-5 w-5" />
                                            {avalPhone}
                                        </a>
                                    </Button>
                                </div>
                                
                                <div className="space-y-1.5">
                                    <p className="text-[10px] uppercase font-black text-muted-foreground">Dirección Aval</p>
                                    <p className="font-bold text-sm uppercase leading-relaxed text-muted-foreground">{avalAddress}</p>
                                </div>
                            </div>

                            <div className="p-5 rounded-2xl bg-muted/50 border space-y-2">
                                <p className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1.5">
                                    <Shield className="h-3.5 w-3.5" /> Garantía Declarada
                                </p>
                                <p className="font-black text-sm uppercase text-foreground/80 leading-snug">{client.guarantee || 'SIN GARANTÍA'}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-8 bg-muted/20 border-t flex justify-end gap-4">
                        <Button variant="outline" size="lg" onClick={() => handleWhatsApp()} className="font-black uppercase tracking-widest text-[11px] h-14 px-8 rounded-2xl border-2">
                            <MessageSquare className="mr-2 h-5 w-5" /> WhatsApp
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-black uppercase tracking-widest text-[11px] h-14 px-12 rounded-2xl shadow-xl shadow-primary/20">
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
                weekDate={loanWeekDate}
                initialAmount={amountDue}
                onPaymentRegistered={() => {
                    // Refrescar para ver cambios
                    if (typeof window !== 'undefined') window.location.reload();
                }}
            />
        </>
    );
}
