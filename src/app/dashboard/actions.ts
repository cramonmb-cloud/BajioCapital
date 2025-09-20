'use server';

import { getClientOutreachSuggestion } from '@/ai/flows/client-outreach-suggestions';
import type { ClientOutreachInput } from '@/ai/flows/client-outreach-suggestions';

export async function getOutreachSuggestionAction(input: ClientOutreachInput) {
  try {
    const result = await getClientOutreachSuggestion(input);
    return result.outreachSuggestion;
  } catch (error) {
    console.error(error);
    return 'Hubo un error al generar la sugerencia. Por favor, inténtelo de nuevo.';
  }
}
