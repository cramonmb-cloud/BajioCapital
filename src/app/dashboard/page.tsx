'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { useAuth } from '@/hooks/use-auth';
import { getAppConfig } from '@/lib/firestore-data';
import { Users, Landmark, Banknote, ArrowRight, TrendingUp, Receipt } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Loan } from '@/lib/types';
import Image from 'next/image';
import { ClientesConFallos } from '@/components/clientes-con-fallos';
import { useEffect, useState, useMemo } from 'react';
import Loading from './loading';

export default function DashboardPage() {
    const { data, loading: dataLoading } = useRealtimeData();
    const { appUser, loading: authLoading } = useAuth();
    const [config, setConfig] = useState<{logoUrl?: string} | null>(null);

    useEffect(() => {
        getAppConfig().then(setConfig);
    }, []);

    // Safe destructuring with fallbacks to avoid crashes during partial data loads
    const { clients = [], loans = [], loanPlans = [] } = data || {};

    const stats = useMemo(() => {
        if (!data || !appUser) return null;

        const totalClients = clients.length;
        const activeLoans = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
        const totalLoaned = loans.reduce((acc, loan) => acc + loan.amount, 0);

        const overdueLoans = loans.filter((loan) => {
            if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return false;
            const plan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!plan) return false;

            const today = new Date();
            const loanStartDate = new Date(loan.startDate);
            const timeDiff = today.getTime() - loanStartDate.getTime();
            const currentLoanWeek = Math.max(1, Math.floor(timeDiff / (1000 * 3600 * 24 * 7)) + 1);

            const weeklyPayment = (loan.amount / 1000) * plan.weeklyPaymentRate;
            let missedWeeksCount = 0;
            for (let i = 1; i < currentLoanWeek; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p && p.amount < weeklyPayment) missedWeeksCount++;
            }

            const term = plan.termInWeeks + (missedWeeksCount >= 2 ? 1 : 0);
            return currentLoanWeek > term;
        });

        // Weekly report logic
        const getSaturdayOfWeek = (d: Date) => {
            const date = new Date(d);
            date.setUTCHours(0, 0, 0, 0);
            const day = date.getUTCDay();
            const diff = day === 0 ? -1 : 6 - day;
            date.setUTCDate(date.getUTCDate() + diff);
            return date;
        };
        
        const currentSaturday = getSaturdayOfWeek(new Date());
        currentSaturday.setUTCHours(23, 59, 59, 999);

        const weekStart = new Date(currentSaturday);
        weekStart.setUTCDate(currentSaturday.getUTCDate() - 6);
        weekStart.setUTCHours(0, 0, 0, 0);

        let totalCollectedThisWeek = 0;
        let totalPaymentsThisWeek = 0;

        loans.forEach(loan => {
            (loan.payments || []).forEach(payment => {
                const paymentDate = new Date(payment.date);
                if (paymentDate >= weekStart && paymentDate <= currentSaturday) {
                    totalCollectedThisWeek += payment.amount;
                    totalPaymentsThisWeek += 1;
                }
            });
        });

        return {
            totalClients,
            activeLoans,
            totalLoaned,
            overdueLoans,
            totalCollectedThisWeek,
            totalPaymentsThisWeek
        };
    }, [clients, loans, loanPlans, appUser, data]);

    if (dataLoading || authLoading || !data || !appUser || !stats) {
        return <Loading />;
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const translateStatus = (status: Loan['status']) => {
        switch (status) {
            case 'Active': return 'Activo';
            case 'Overdue': return 'Vencido';
            case 'Paid Off': return 'Pagado';
            case 'Pagado desde CV': return 'Pagado desde CV';
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            {config?.logoUrl && (
                <div className="flex justify-center mb-8">
                    <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center p-4">
                        <div className="relative w-full h-full animate-in fade-in zoom-in duration-700">
                            <Image 
                                src={config.logoUrl} 
                                alt="Logo" 
                                fill
                                className="object-contain rounded-3xl border-4 border-white animate-glow-green bg-white/80 backdrop-blur-sm p-4"
                            />
                        </div>
                    </div>
                </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cobranza de la Semana</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalCollectedThisWeek)}</div>
                        <p className="text-xs text-muted-foreground">Total recaudado en la semana actual</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Abonos de la Semana</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.totalPaymentsThisWeek}</div>
                        <p className="text-xs text-muted-foreground">Pagos registrados en la semana</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalClients}</div>
                        <p className="text-xs text-muted-foreground">Clientes registrados en el sistema</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Préstamos Activos</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeLoans}</div>
                        <p className="text-xs text-muted-foreground">Préstamos actualmente en curso</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Prestado</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalLoaned)}</div>
                        <p className="text-xs text-muted-foreground">Suma total de todos los préstamos</p>
                    </CardContent>
                </Card>
            </div>
            
            <ClientesConFallos loans={loans} clients={clients} loanPlans={loanPlans} />

            <Card>
                <CardHeader><CardTitle>Préstamos en Cartera Vencida</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Plan</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.overdueLoans.length > 0 ? (
                                stats.overdueLoans.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell className="font-medium">
                                            {clients.find(c => c.id === loan.clientId)?.name || 'N/A'}
                                        </TableCell>
                                        <TableCell>{formatCurrency(loan.amount)}</TableCell>
                                        <TableCell>{loanPlans.find(p => p.id === loan.loanPlanId)?.name || 'N/A'}</TableCell>
                                        <TableCell><Badge variant="destructive">Vencido</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href="/dashboard/overdue-portfolio"><ArrowRight className="h-4 w-4" /></Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">No hay préstamos en cartera vencida.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
