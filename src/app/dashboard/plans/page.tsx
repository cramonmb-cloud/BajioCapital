import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getLoanPlans } from '@/lib/firestore-data';
import Link from 'next/link';

export default async function LoanPlansPage() {
    const loanPlans = await getLoanPlans();
    const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planes de Préstamo</h1>
          <p className="text-muted-foreground">
            Define y administra los diferentes tipos de préstamos que ofreces.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/plans/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Definir Nuevo Plan
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loanPlans.map((plan) => (
          <Card key={plan.id}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Abono Semanal:</span>
                  <span>{formatCurrency(plan.weeklyPayment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plazo:</span>
                  <span>{plan.termInWeeks} semanas</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/dashboard/plans/${plan.id}/edit`}>Editar Plan</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
