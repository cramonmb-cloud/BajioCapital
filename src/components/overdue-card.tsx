'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
    Phone, User, Calendar, MessageSquare, Building, MapPin, 
    Home, Wallet, FileText, Shield, AlertTriangle, X, Map, ChevronDown, UserCheck 
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
    isOverduePortfolio?: boolean;
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

// Helper to clean phone numbers for tel: protocol
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
    
    // Improved Endorsement Parsing
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

    const debtLabel = isOverduePortfolio ? "Acumulado de Fallos" : "Saldo Pendiente";

    return (
        <>
            <Card className="overflow-hidden border-t-4 transition-all hover:shadow-md" style={{ borderTopColor: plazaColor }}>
                <div className="px-4 py-2 border-b flex justify-between items-center" style={{ backgroundColor: `${plazaColor}10` }}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: plazaColor }}>
                        <Building className="h-3 w-3" /> {hierarchy.plazaName}
                    </div>
                    <Badge variant="destructive" className="text-[10px] h-5 font-bold">CON FALLA</Badge>
                </div>
                <CardContent className="p-4 space-y-4">
                    <div className="cursor-pointer group" onClick={() => setDetailModalOpen(true)}>
                        <h3 className="font-bold text-lg leading-tight uppercase group-hover:text-primary transition-colors">{client.name}</h3>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1 uppercase font-semibold">
                            <MapPin className="h-3 w-3" /> {hierarchy.localidadName} • <User className="h-3 w-3" /> {hierarchy.promotoraName}
                        </div>
                    </div>

                    <div className="text-sm space-y-2">
                        {/* Bloque Info Cliente */}
                        <div className="bg-secondary/30 p-2 rounded-md space-y-2">
                            <div className="flex items-center justify-between text-muted-foreground">
                                <Button asChild className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold w-full" size="sm">
                                    <a href={`tel:${cleanPhone(client.phone)}`}>
                                        <Phone className="mr-2 h-3.5 w-3.5" />
                                        {client.phone || 'LLAMAR CLIENTE'}
                                    </a>
                                </Button>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Inició: {formatDate(loanWeekDate.toISOString())}</span>
                            </div>
                        </div>

                        {/* Bloque Info Aval */}
                        <div className="bg-primary/5 border border-primary/10 p-2 rounded-md space-y-2">
                             <div className="flex items-center gap-2 text-primary">
                                <UserCheck className="h-3 w-3 flex-shrink-0" />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Aval Responsable</span>
                            </div>
                            <p className="text-xs font-extrabold uppercase leading-tight">{avalName}</p>
                            
                            <Button asChild className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold w-full" size="sm">
                                <a href={`tel:${cleanPhone(avalPhone)}`}>
                                    <Phone className="mr-2 h-3.5 w-3.5" />
                                    {avalPhone !== 'SIN TELÉFONO' ? avalPhone : 'LLAMAR AVAL'}
                                </a>
                            </Button>

                            <div className="flex items-start gap-2 text-[10px] text-muted-foreground leading-none">
                                <MapPin className="h-2.5 w-2.5 mt-0.5" />
                                <span className="uppercase">{avalAddress}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-end pt-1">
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Monto Original</p>
                            <p className="font-semibold text-sm">{formatCurrency(loan.amount)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{debtLabel}</p>
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

            {/* Modal de Detalle del Cliente */}
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
                            <div className="text-sm text-muted-foreground grid grid-cols-1 gap-y-2">
                                <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-4" size="sm">
                                    <a href={`tel:${cleanPhone(client.phone)}`}>
                                        <Phone className="mr-2 h-4 w-4" />
                                        {client.phone}
                                    </a>
                                </Button>
                                <div className="flex items-center gap-2">
                                    {isMobile ? (
                                        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline" style={{ color: '#005DC7' }}>
                                            <Map className="h-4 w-4" /> {`${client.street}, ${client.neighborhood}`}
                                        </a>
                                    ) : (
                                        <><Home className="h-4 w-4 text-primary" /> {`${client.street}, ${client.neighborhood}`}</>
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
                            <h3 className="font-bold text-lg uppercase flex items-center gap-2 border-b pb-2"><Wallet className="text-primary h-5 w-5"/> Progreso del Pago</h3>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Semana Actual</p>
                                    <p className="font-bold text-2xl">{currentLoanWeek} <span className="text-sm text-muted-foreground">de {termInWeeksWithPenalty}</span></p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Abono</p>
                                    <p className="font-bold text-2xl" style={{ color: '#005DC7' }}>{formatCurrency(weeklyPayment)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Fallos</p>
                                    <p className={cn("font-bold text-2xl", missedPayments > 0 ? 'text-red-500' : 'text-blue-500')}>
                                        {missedPayments}
                                    </p>
                                </div>
                            </div>
                            
                            <h3 className="font-bold text-lg uppercase flex items-center gap-2 border-b pb-2 pt-2"><FileText className="text-primary h-5 w-5"/> Detalles del Préstamo</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Monto Solicitado</p>
                                    <p className="font-bold text-lg">{formatCurrency(loan.amount)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Plan</p>
                                    <p className="font-semibold uppercase">{loanPlan.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Fecha de Inicio</p>
                                    <p className="font-semibold">{formatDateFull(loan.startDate)}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo Pendiente Real</p>
                                    <p className="font-bold text-destructive text-lg">{formatCurrency(remainingBalance > 0 ? remainingBalance : 0)}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4 border-l md:pl-8">
                            <div className="flex items-center justify-between w-full border-b pb-2">
                                <h3 className="font-bold text-lg uppercase flex items-center gap-2">
                                    <Shield className="text-primary h-5 w-5"/> Datos del Aval
                                </h3>
                            </div>
                            
                            <div className="space-y-5 py-2">
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                            <UserCheck className="h-3 w-3" /> Nombre Completo del Aval
                                        </p>
                                        <p className="font-extrabold text-lg uppercase text-primary">{avalName}</p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> Teléfono de Contacto
                                        </p>
                                        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-4 w-full" size="sm">
                                            <a href={`tel:${cleanPhone(avalPhone)}`}>
                                                <Phone className="mr-2 h-4 w-4" />
                                                {avalPhone}
                                            </a>
                                        </Button>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> Domicilio Registrado
                                        </p>
                                        <p className="font-medium text-sm uppercase leading-tight">{avalAddress}</p>
                                    </div>
                                </div>

                                <div className="space-y-1 pt-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                        <Shield className="h-3 w-3" /> Garantía Presentada
                                    </p>
                                    <p className="font-semibold text-sm uppercase bg-muted p-2 rounded-lg">{client.guarantee || 'SIN GARANTÍA'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex justify-end mt-8 gap-3 border-t pt-4">
                        <Button variant="outline" size="lg" onClick={() => handleWhatsApp()} className="font-bold">
                            <MessageSquare className="mr-2 h-5 w-5" /> WhatsApp
                        </Button>
                        <Button size="lg" onClick={() => { setDetailModalOpen(false); setPaymentDialogOpen(true); }} className="font-bold px-8">
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
