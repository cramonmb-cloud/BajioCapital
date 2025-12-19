'use server';

import { doc, deleteDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { revalidatePath } from 'next/cache';
import type { LoanPlan } from '@/lib/types';

export async function deleteLoanPlanAction(planId: string) {
  if (!planId) {
    return { success: false, message: 'ID de plan no proporcionado.' };
  }

  try {
    const planRef = doc(db, 'loanPlans', planId);
    await deleteDoc(planRef);

    revalidatePath('/dashboard/plans');
    revalidatePath('/dashboard/control');
    
    return { success: true, message: 'Plan eliminado con éxito.' };
  } catch (error: any) {
    console.error('Error deleting loan plan:', error);
    return { success: false, message: `Error al eliminar el plan: ${error.message}` };
  }
}

export async function saveLoanPlanAction(planData: Omit<LoanPlan, 'id'>, planId?: string) {
    try {
        if (planId) {
            // Update existing plan
            const planRef = doc(db, 'loanPlans', planId);
            await setDoc(planRef, planData, { merge: true });
        } else {
            // Create new plan
            await addDoc(collection(db, 'loanPlans'), planData);
        }

        revalidatePath('/dashboard/plans');
        revalidatePath('/dashboard/control');
        if (planId) {
            revalidatePath(`/dashboard/plans/${planId}/edit`);
        }

        return { success: true, message: `Plan "${planData.name}" guardado con éxito.` };
    } catch (error: any) {
        console.error('Error saving loan plan:', error);
        return { success: false, message: `Error al guardar el plan: ${error.message}` };
    }
}
