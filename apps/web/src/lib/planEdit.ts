/**
 * Editing the week by typing (#38): a preview of proposed nights that the
 * household accepts or discards, and a one-step undo. Pure, so the plan
 * page only wires it to state and requests.
 */

import type { MealCardProps } from '@/components/app/MealCard';

export type Plan = (MealCardProps | null)[];

export type ProposedNight =
  /** `token` ties the night to the request generating it, so a stale result can't land. */
  | { kind: 'replace'; guidance?: string; status: 'loading'; token: number }
  | { kind: 'replace'; guidance?: string; status: 'ready'; meal: MealCardProps }
  | { kind: 'replace'; guidance?: string; status: 'failed'; error: string }
  | { kind: 'remove' };

export interface PlanEditPreview {
  /** Proposed changes by day (0 = Monday). Nights not listed are unchanged. */
  nights: Record<number, ProposedNight>;
}

export interface EditInstruction {
  day: number;
  action: 'replace' | 'remove';
  guidance?: string;
}

/**
 * Starts a preview, or merges a follow-up into the open one: each edited
 * night is (re)proposed, and nights from the earlier instruction stay.
 */
export function proposeEdits(preview: PlanEditPreview | null, edits: EditInstruction[], token: number): PlanEditPreview {
  const nights = { ...(preview?.nights ?? {}) };
  for (const edit of edits) {
    nights[edit.day] =
      edit.action === 'remove' ? { kind: 'remove' } : { kind: 'replace', guidance: edit.guidance, status: 'loading', token };
  }
  return { nights };
}

/** Regenerates one proposed night again (e.g. "Try again" after a failure), under a new token. */
export function retryNight(preview: PlanEditPreview, day: number, token: number): PlanEditPreview {
  const night = preview.nights[day];
  if (!night || night.kind !== 'replace') return preview;
  return { nights: { ...preview.nights, [day]: { kind: 'replace', guidance: night.guidance, status: 'loading', token } } };
}

/**
 * Records a night's generated meal or failure. Ignored unless that night is
 * still waiting on this request (`token`): a discarded preview or a newer
 * instruction for the same night wins.
 */
export function resolveNight(
  preview: PlanEditPreview | null,
  day: number,
  token: number,
  result: { ok: true; meal: MealCardProps } | { ok: false; error: string }
): PlanEditPreview | null {
  const night = preview?.nights[day];
  if (!preview || !night || night.kind !== 'replace' || night.status !== 'loading' || night.token !== token) return preview;
  return {
    nights: {
      ...preview.nights,
      [day]: result.ok
        ? { kind: 'replace', guidance: night.guidance, status: 'ready', meal: result.meal }
        : { kind: 'replace', guidance: night.guidance, status: 'failed', error: result.error },
    },
  };
}

/** True while any proposed night is still generating; Accept waits for these. */
export function isPreviewPending(preview: PlanEditPreview | null): boolean {
  return Boolean(preview && Object.values(preview.nights).some((n) => n.kind === 'replace' && n.status === 'loading'));
}

/**
 * The plan with the preview applied: ready meals replace their night,
 * removals clear it, and failed or still-loading nights keep the original.
 * Also returns the recipe IDs that are new to the plan, for history.
 */
export function acceptPreview(plan: Plan, preview: PlanEditPreview): { plan: Plan; newIds: string[] } {
  const next = [...plan];
  const newIds: string[] = [];
  for (const [key, night] of Object.entries(preview.nights)) {
    const day = Number(key);
    if (night.kind === 'remove') {
      next[day] = null;
    } else if (night.status === 'ready') {
      next[day] = night.meal;
      newIds.push(night.meal.recipeId);
    }
  }
  return { plan: next, newIds };
}

/** How many nights an accept would change. */
export function changeCount(preview: PlanEditPreview | null): number {
  if (!preview) return 0;
  return Object.values(preview.nights).filter((n) => n.kind === 'remove' || n.status === 'ready').length;
}
