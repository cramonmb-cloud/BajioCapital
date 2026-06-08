/**
 * @fileoverview This file configures and exports the Genkit AI object.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
});
