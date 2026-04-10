'use client';

import { useState } from 'react';
import type { LoanPlan } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, FileText, LayoutGrid } from 'lucide-react';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { PlanForm } from './plan-form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface PlanManagementProps {
    initialLoanPlans: LoanPlan[];
}

export function PlanManagement({ initialLoanPlans }: PlanManagementProps) {
    const { data, loading } = useRealtimeData();
    const [selectedPlan, setSelectedPlan] = useState<LoanPlan | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const loanPlans = data?.loanPlans ?? initialLoanPlans;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
        }).format(amount);
    };

    const handleCreateNew = () => {
        setSelectedPlan(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (plan: LoanPlan) => {
        setSelectedPlan(plan);
        setIsDialogOpen(true);
    };

    const handleSuccess = () => {
        setIsDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Catálogo de Planes</h2>
                    <p className="text-muted-foreground">Define las condiciones de tus productos financieros.</p>
                </div>
                <Button onClick={handleCreateNew}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Nuevo Plan
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {loanPlans.map((plan) => (
                    <Card key={plan.id} className="shadow-md hover:shadow-lg transition-shadow border-primary/10">
                        <CardHeader className="bg-primary/5 border-b mb-4">
                            <CardTitle className="text-lg uppercase flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" /> {plan.name}
                            </CardTitle>
                            <CardDescription className="line-clamp-2 min-h-[2.5rem] uppercase text-xs">{plan.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="space-y-1">
                                    <p className="text-muted-foreground font-bold text-[10px] uppercase">Abono Semanal</p>
                                    <p className="font-bold text-lg text-primary">{formatCurrency(plan.weeklyPaymentRate)}</p>
                                    <p className="text-[10px] text-muted-foreground">POR CADA $1,000</p>
                                </div>
                                <div className="space-y-1 border-l pl-4">
                                    <p className="text-muted-foreground font-bold text-[10px] uppercase">Plazo Total</p>
                                    <p className="font-bold text-lg">{plan.termInWeeks} Semanas</p>
                                    <p className="text-[10px] text-muted-foreground">DURACIÓN BASE</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="pt-2">
                            <Button variant="outline" className="w-full font-bold uppercase text-xs h-9" onClick={() => handleEdit(plan)}>
                                <Edit className="mr-2 h-3.5 w-3.5" /> Editar Condiciones
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
                {loanPlans.length === 0 && (
                    <Card className="col-span-full border-dashed border-2 bg-muted/30">
                        <CardContent className="flex flex-col items-center justify-center h-48">
                            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                            <p className="text-muted-foreground font-medium">No hay planes definidos en el sistema.</p>
                            <Button variant="link" onClick={handleCreateNew}>Crea tu primer plan ahora</Button>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold uppercase">
                            {selectedPlan ? `Editar: ${selectedPlan.name}` : 'Definir Nuevo Plan Financiero'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <PlanForm plan={selectedPlan || undefined} />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
