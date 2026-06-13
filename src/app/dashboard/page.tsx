'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { useAuth } from '@/hooks/use-auth';
import { getAppConfig } from '@/lib/firestore-data';
import { Users, Landmark, Banknote, TrendingUp, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Logo } from '@/components/logo';
import { useEffect, useState, useMemo } from 'react';
import Loading from './loading';
import { getSaturdayOfWeek, getMexicoNow } from '@/lib/utils';

export default function DashboardPage() {
    const { data, loading: dataLoading } = useRealtimeData();
    const { appUser, loading: authLoading } = useAuth();
    const [config, setConfig] = useState<{logoUrl?: string, logoFormat?: 'square' | 'horizontal', logoHeightDashboard?: number, logoWidthDashboard?: number} | null>(null);
    
    useEffect(() => {
        getAppConfig().then(setConfig);
    }, []);

    const { clients = [], loans = [] } = data || {};

    const stats = useMemo(() => {
        if (!data || !appUser) return null;

        const mexicoNow = getMexicoNow();
        const totalClients = clients.length;
        const activeLoansCount = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
        const totalLoaned = loans.reduce((acc, loan) => acc + loan.amount, 0);



        // Weekly report logic (Saturday to Friday)
        const weekStart = getSaturdayOfWeek(mexicoNow);
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        let totalCollectedThisWeek = 0;
        let totalPaymentsThisWeek = 0;

        loans.forEach(loan => {
            (loan.payments || []).forEach(payment => {
                const paymentDate = new Date(payment.date);
                if (paymentDate >= weekStart && paymentDate <= weekEnd) {
                    totalCollectedThisWeek += payment.amount;
                    totalPaymentsThisWeek += 1;
                }
            });
        });

        const formatDate = (date: Date) => {
            return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };
        const weekStartStr = formatDate(weekStart);
        const weekEndStr = formatDate(weekEnd);

        return {
            totalClients,
            activeLoans: activeLoansCount,
            totalLoaned,
            totalCollectedThisWeek,
            totalPaymentsThisWeek,
            weekStartStr,
            weekEndStr
        };
    }, [clients, loans, appUser, data]);



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
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cobranza de la Semana</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.totalCollectedThisWeek)}</div>
                        <p className="text-xs text-muted-foreground">Del {stats.weekStartStr} al {stats.weekEndStr}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Abonos de la Semana</CardTitle>
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.totalPaymentsThisWeek}</div>
                        <p className="text-xs text-muted-foreground">Del {stats.weekStartStr} al {stats.weekEndStr}</p>
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
            </div>
            



        </div>
    );
}
