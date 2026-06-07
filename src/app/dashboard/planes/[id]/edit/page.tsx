import { notFound } from 'next/navigation';
import { PlanForm } from '@/components/plan-form';
import { getLoanPlan } from '@/lib/firestore-data';

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const plan = await getLoanPlan(params.id);

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
