/**
 * One AI recipe for one day's slot (#95). The plan page fires seven of these
 * at once for a week, and reuses it for a single day, a retry or a swap.
 */

import type { FamilySettings } from '@/lib/types/settings';
import type { Recipe } from '@/lib/types/recipe';
import type { DaySlot } from '@/lib/planSlate';
import type { TasteSignals } from '@/lib/tasteSignals';
import { apiErrorMessage, clientTimeZone, redirectToLoginIfUnauthenticated } from '@/lib/api/client';

export interface DayRequest {
  familySettings: FamilySettings;
  slot: DaySlot;
  tasteSignals: TasteSignals;
  pantryItems: string[];
  useSoonItems: string[];
  /** What the household asked for this night, from a typed plan edit (#38). */
  guidance?: string;
}

export type DayResult =
  | { ok: true; recipe: Recipe; explanation?: string }
  /** `error` is friendly copy (#96). `redirected` means a 401 sent the user to log in. */
  | { ok: false; error: string; redirected?: boolean };

export async function generateDay(request: DayRequest, fetchImpl: typeof fetch = fetch): Promise<DayResult> {
  const { slot } = request;
  let response: Response;
  try {
    response = await fetchImpl('/api/generate-recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeZone: clientTimeZone(),
        familySettings: request.familySettings,
        numberOfRecipes: 1,
        specificDays: [{ index: slot.index, type: slot.type }],
        slot: { cuisine: slot.cuisine, protein: slot.protein, method: slot.method, pantryFocus: slot.pantryFocus },
        ...(request.guidance ? { guidance: request.guidance } : {}),
        ...request.tasteSignals,
        pantryItems: request.pantryItems,
        useSoonItems: request.useSoonItems,
      }),
    });
  } catch (error) {
    console.error(`generateDay(${slot.index}): request failed`, error);
    return { ok: false, error: apiErrorMessage(null) };
  }

  if (redirectToLoginIfUnauthenticated(response)) return { ok: false, error: apiErrorMessage(null), redirected: true };

  const data = await response.json().catch(() => null);
  const recipe: Recipe | undefined = data?.recipes?.[0];
  if (!response.ok || !recipe) {
    console.error(`generateDay(${slot.index}): API error`, response.status, data);
    return { ok: false, error: apiErrorMessage(data) };
  }
  return { ok: true, recipe, explanation: data.explanations?.[recipe.id] };
}
