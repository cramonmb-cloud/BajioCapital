'use server';

import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';

export async function deleteLoanPlanAction(planId: string) {
  if (!planId) {
    return { success: false, message: 'ID de plan no proporcionado.' };
  }

  try {
    const planRef = doc(db, 'loanPlans', planId);
    await deleteDoc(planRef);

    revalidatePath('/dashboard/plans');
    revalidatePath('/dashboard/plans/[id]/edit', 'page');
    
    return { success: true, message: 'Plan eliminado con éxito.' };
  } catch (error: any) {
    console.error('Error deleting loan plan:', error);
    return { success: false, message: `Error al eliminar el plan: ${error.message}` };
  }
}
