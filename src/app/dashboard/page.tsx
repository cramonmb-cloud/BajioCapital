'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Users, Landmark, Banknote, ArrowRight, TrendingUp, Receipt, ChevronLeft, ChevronRight, List } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import type { Loan } from '@/lib/types';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { ClientesConFallos } from '@/components/clientes-con-fallos';
import { useEffect, useState, useMemo } from 'react';
import Loading from './loading';
import { getSaturdayOfWeek, getMexicoNow } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

export default function DashboardPage() {
    const { data, loading: dataLoading } = useRealtimeData();
    const { appUser, loading: authLoading } = useAuth();
    const [config, setConfig] = useState<{logoUrl?: string, logoFormat?: 'square' | 'horizontal', logoHeightDashboard?: number, logoWidthDashboard?: number} | null>(null);
    
    // Pagination state for Overdue Loans
    const [currentPage, setCurrentPage] = useState(1);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        getAppConfig().then(setConfig);
    }, []);

    const { clients = [], loans = [], loanPlans = [] } = data || {};

    const stats = useMemo(() => {
        if (!data || !appUser) return null;

        const mexicoNow = getMexicoNow();
        const totalClients = clients.length;
        const activeLoansCount = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
        const totalLoaned = loans.reduce((acc, loan) => acc + loan.amount, 0);

        const overdueLoans = loans.filter((loan) => {
            if (loan.status === 'Paid Off' || loan.status === 'Pagado desde CV') return false;
            const plan = loanPlans.find(p => p.id === loan.loanPlanId);
            if (!plan) return false;

            const loanStartDate = new Date(loan.startDate);
            const baseTerm = plan.termInWeeks;

            const diffTime = Math.abs(mexicoNow.getTime() - loanStartDate.getTime());
            const daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const currentLoanWeek = Math.max(1, Math.floor((daysDiff - 1) / 7) + 1);

            const weeklyPayment = (loan.amount / 1000) * plan.weeklyPaymentRate;
            let missedWeeksCount = 0;
            let totalPaidInBase = 0;
            for (let i = 1; i <= baseTerm; i++) {
                const p = loan.payments.find(pay => pay.weekNumber === i);
                if (p) {
                    totalPaidInBase += p.amount;
                    if (p.amount < weeklyPayment) missedWeeksCount++;
                } else if (i < currentLoanWeek - 1) {
                    missedWeeksCount++;
                }
            }

            const isExpired = currentLoanWeek > baseTerm + 1;
            const hasPenalty = (missedWeeksCount >= 2) || (isExpired && totalPaidInBase < (baseTerm * weeklyPayment));

            const term = baseTerm + (hasPenalty ? 1 : 0);
            return currentLoanWeek > term + 1;
        });

        // Weekly report logic
        const currentSaturday = getSaturdayOfWeek(mexicoNow);
        currentSaturday.setHours(23, 59, 59, 999);

        const weekStart = new Date(currentSaturday);
        weekStart.setDate(currentSaturday.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);

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
            activeLoans: activeLoansCount,
            totalLoaned,
            overdueLoans,
            totalCollectedThisWeek,
            totalPaymentsThisWeek
        };
    }, [clients, loans, loanPlans, appUser, data]);

    const overdueLoans = stats?.overdueLoans || [];
    const totalPages = Math.ceil(overdueLoans.length / ITEMS_PER_PAGE);

    const visibleOverdueLoans = useMemo(() => {
        if (showAll) return overdueLoans;
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return overdueLoans.slice(start, start + ITEMS_PER_PAGE);
    }, [overdueLoans, currentPage, showAll]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
        }
    }, [totalPages, currentPage]);

    if (dataLoading || authLoading || !data || !appUser || !stats) {
        return <Loading />;
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    return (
        <div className="flex flex-col gap-5">
            {config?.logoUrl && (
                <div className="flex justify-center mt-3 md:mt-2">
                    <div className="relative animate-in fade-in zoom-in duration-700 flex items-center justify-center">
                        <Logo 
                            logoUrl={config.logoUrl} 
                            logoFormat={config.logoFormat} 
                            size="xl" 
                            customHeight={config.logoHeightDashboard}
                            customWidth={config.logoWidthDashboard}
                        />
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
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Préstamos en Cartera Vencida</CardTitle>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                            setShowAll(!showAll);
                            setCurrentPage(1);
                        }}
                        className="gap-2"
                    >
                        <List className="h-4 w-4" />
                        {showAll ? "Ver paginado" : "Mostrar todo"}
                    </Button>
                </CardHeader>
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
                            {visibleOverdueLoans.length > 0 ? (
                                visibleOverdueLoans.map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell className="font-medium">
                                            {clients.find(c => c.id === loan.clientId)?.name || 'N/A'}
                                        </TableCell>
                                        <TableCell>{formatCurrency(loan.amount)}</TableCell>
                                        <TableCell>{loanPlans.find(p => p.id === loan.loanPlanId)?.name || 'N/A'}</TableCell>
                                        <TableCell><Badge variant="destructive">Vencido</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button asChild variant="ghost" size="icon">
                                                <Link href="/dashboard/pendientes"><ArrowRight className="h-4 w-4" /></Link>
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
                {!showAll && totalPages > 1 && (
                    <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Mostrando {visibleOverdueLoans.length} de {overdueLoans.length} registros
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">
                                Página {currentPage} de {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Siguiente
                                    <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardFooter>
                )}
                {showAll && overdueLoans.length > ITEMS_PER_PAGE && (
                    <CardFooter className="py-4 border-t justify-center">
                        <p className="text-sm text-muted-foreground">
                            Mostrando lista completa ({overdueLoans.length} registros)
                        </p>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
