'use client';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { useAuth } from '@/hooks/use-auth';
import { getAppConfig } from '@/lib/firestore-data';
import { Users, Landmark, Banknote, TrendingUp, Receipt, Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
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
    const [selectedWeekValue, setSelectedWeekValue] = useState<string>('');
    
    useEffect(() => {
        getAppConfig().then(setConfig);
    }, []);

    const { clients = [], loans = [] } = data || {};

    // Calculate the complete list of operative weeks (Saturday to Friday) since the oldest loan
    const weeksList = useMemo(() => {
        if (loans.length === 0) return [];
        let minTime = Infinity;
        loans.forEach(loan => {
            if (loan.startDate) {
                const time = new Date(loan.startDate.includes('T') ? loan.startDate : loan.startDate + 'T00:00:00').getTime();
                if (!isNaN(time) && time < minTime) {
                    minTime = time;
                }
            }
        });

        if (minTime === Infinity) return [];
        
        const oldestSat = getSaturdayOfWeek(new Date(minTime));
        const currentSat = getSaturdayOfWeek(getMexicoNow());
        
        const list: { start: Date; end: Date; label: string; value: string }[] = [];
        let temp = new Date(oldestSat);
        
        while (temp <= currentSat) {
            const start = new Date(temp);
            start.setHours(0, 0, 0, 0);
            
            const end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            
            const startStr = start.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const endStr = end.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
            
            list.push({
                start,
                end,
                label: `Semana: Del ${startStr} al ${endStr}`,
                value: start.toISOString()
            });
            
            temp.setDate(temp.getDate() + 7);
        }
        
        return list.reverse();
    }, [loans]);

    // Initialize state with current week when list loads
    useEffect(() => {
        if (weeksList.length > 0 && !selectedWeekValue) {
            setSelectedWeekValue(weeksList[0].value);
        }
    }, [weeksList, selectedWeekValue]);

    // Retrieve currently selected week range dates
    const activeWeek = useMemo(() => {
        if (weeksList.length === 0) return null;
        return weeksList.find(w => w.value === selectedWeekValue) || weeksList[0];
    }, [weeksList, selectedWeekValue]);

    const stats = useMemo(() => {
        if (!data || !appUser) return null;

        const totalClients = clients.length;
        const activeLoansCount = loans.filter((loan) => loan.status === 'Active' || loan.status === 'Overdue').length;
        const totalLoaned = loans.reduce((acc, loan) => acc + loan.amount, 0);

        // Calculate defaults if activeWeek is not loaded yet
        const mexicoNow = getMexicoNow();
        const defaultStart = getSaturdayOfWeek(mexicoNow);
        defaultStart.setHours(0, 0, 0, 0);
        const defaultEnd = new Date(defaultStart);
        defaultEnd.setDate(defaultStart.getDate() + 6);
        defaultEnd.setHours(23, 59, 59, 999);

        const weekStart = activeWeek ? activeWeek.start : defaultStart;
        const weekEnd = activeWeek ? activeWeek.end : defaultEnd;

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

        let newLoansCountThisWeek = 0;
        loans.forEach(loan => {
            if (loan.startDate) {
                const loanDate = loan.startDate.includes('T') 
                    ? new Date(loan.startDate) 
                    : new Date(loan.startDate + 'T00:00:00');
                if (loanDate >= weekStart && loanDate <= weekEnd) {
                    newLoansCountThisWeek += 1;
                }
            }
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
            weekEndStr,
            newLoansCountThisWeek
        };
    }, [clients, loans, appUser, data, activeWeek]);

    const activeWeekIndex = useMemo(() => {
        if (weeksList.length === 0) return 0;
        const idx = weeksList.findIndex(w => w.value === selectedWeekValue);
        return idx !== -1 ? idx : 0;
    }, [weeksList, selectedWeekValue]);

    const handleGoBack = () => {
        if (activeWeekIndex < weeksList.length - 1) {
            setSelectedWeekValue(weeksList[activeWeekIndex + 1].value);
        }
    };

    const handleGoNext = () => {
        if (activeWeekIndex > 0) {
            setSelectedWeekValue(weeksList[activeWeekIndex - 1].value);
        }
    };

    const handleGoCurrent = () => {
        if (weeksList.length > 0) {
            setSelectedWeekValue(weeksList[0].value);
        }
    };

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

            {/* Week Navigation Buttons */}
            {weeksList.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/50 backdrop-blur p-4 rounded-2xl border border-border/40 shadow-sm animate-in fade-in duration-300">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGoBack}
                            disabled={activeWeekIndex >= weeksList.length - 1}
                            className="h-10 text-xs font-bold uppercase rounded-xl border-border/60 hover:bg-indigo-50/20 shrink-0 gap-1.5 px-4"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Atrás
                        </Button>

                        {activeWeekIndex > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGoNext}
                                className="h-10 text-xs font-bold uppercase rounded-xl border-border/60 hover:bg-indigo-50/20 shrink-0 gap-1.5 px-4"
                            >
                                Siguiente
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGoCurrent}
                            disabled={activeWeekIndex === 0}
                            className="h-10 text-xs font-bold uppercase rounded-xl border-border/60 hover:bg-indigo-50/20 shrink-0 gap-1.5 px-4"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Actual
                        </Button>
                    </div>

                    {activeWeek && (
                        <div className="text-xs font-black uppercase text-zinc-700 tracking-wider bg-indigo-50/50 border border-indigo-150 px-4 py-2.5 rounded-xl shrink-0">
                            {activeWeek.label}
                        </div>
                    )}
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
                        <CardTitle className="text-sm font-medium">Nuevos Préstamos</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.newLoansCountThisWeek}</div>
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
