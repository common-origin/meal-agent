/**
 * The AI provider instance (#83). Server-only.
 *
 * Reads GEMINI_API_KEY, not the SDK's default GOOGLE_GENERATIVE_AI_API_KEY,
 * so existing Vercel and .env.local configuration keeps working. Created
 * lazily so a missing key fails the request that needs it, not import.
 */

import { createGoogle, type GoogleProvider } from '@ai-sdk/google';

let provider: GoogleProvider | undefined;

export function getAiProvider(): GoogleProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  provider ??= createGoogle({ apiKey });
  return provider;
}
