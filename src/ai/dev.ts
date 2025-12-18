/**
 * @fileoverview This file is loaded only in development and is used to load development-specific plugins.
 */
import {genkit} from 'genkit';
import {dotprompt, typescript} from '@genkit-ai/dotprompt';

export const dev = genkit({
  plugins: [
    dotprompt({
      model: 'googleai/gemini-1.5-flash',
      prompt: {
        model: 'googleai/gemini-1.5-flash',
      },
    }),
    typescript(),
  ],
});
