import { notFound } from 'next/navigation';
import { PlanForm } from '@/components/plan-form';
import { loanPlans } from '@/lib/data';

export default function EditPlanPage({ params }: { params: { id: string } }) {
  const plan = loanPlans.find((p) => p.id === params.id);

  if (!plan) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Editar Plan de Préstamo</h1>
      <PlanForm plan={plan} />
    </div>
  );
}
