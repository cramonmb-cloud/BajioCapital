'use server';

import type { Client } from '@/lib/types';

export type CreateLoanInput = {
    loanPlanId: string;
    amount: number;
    client: Omit<Client, 'id' | 'avatarUrl'> & { id?: string };
};

export async function createLoanAction(input: CreateLoanInput) {
    // This is where you would typically handle the form submission,
    // e.g., by calling an API to save the loan and client.
    
    const today = new Date();
    // Sunday - Saturday : 0 - 6
    const dayOfWeek = today.getDay(); 
    // If today is Sunday (0), we want the Saturday of the *previous* week.
    // So we subtract 1 day.
    // For any other day (Mon-Sat), we calculate days until the upcoming Saturday.
    const daysToAdd = dayOfWeek === 0 ? -1 : 6 - dayOfWeek;
    
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + daysToAdd);

    const newLoan = {
        ...input,
        startDate: saturday.toISOString().split('T')[0], // Format as YYYY-MM-DD
    };

    console.log('Creating loan with input:', newLoan);
    
    // In a real app, you would get the new loan and client data back from the API
    // and then potentially revalidate the data on the client.
    
    return { success: true, message: 'Préstamo creado con éxito.' };
}
