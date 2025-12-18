/**
 * @fileoverview This file configures and exports the Genkit AI object.
 */
import {genkit, type Plugin} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

const plugins: Plugin[] = [googleAI()];

// The dev plugin was causing issues, so it has been removed.
// if (process.env.NODE_ENV === 'development') {
//   const {dev} = await import('@/ai/dev');
//   plugins.push(dev);
// }

export const ai = genkit({
  plugins,
  enableTracingAndMetrics: true,
});
