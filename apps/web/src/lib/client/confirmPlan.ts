/**
 * Confirm the week (#38): wait for any plan save still in flight, mark the
 * week's recipes as confirmed (they join My Recipes), record it, clear the
 * week's "shopping complete" flag (a confirmed plan is a new shop, #173),
 * then open the shopping list. Waiting first means the shopping list loads the plan
 * the user just confirmed, not the version before their last edit.
 */
export interface ConfirmPlanDeps {
  /** Resolves once queued plan saves have finished. */
  pendingSaves: Promise<unknown>;
  markConfirmed: (recipeIds: string[]) => void;
  track: (meta: { finalCost: number; dayCount: number }) => void;
  /** Clears the week's "shopping complete" flag, so the list shows rather than the completed screen (#173). */
  clearShoppingComplete: () => void;
  navigate: (path: string) => void;
}

/** Returns false (and does nothing) for an empty plan. */
export async function confirmPlan(recipeIds: string[], cost: number, deps: ConfirmPlanDeps): Promise<boolean> {
  if (recipeIds.length === 0) return false;
  await deps.pendingSaves.catch(() => undefined);
  deps.markConfirmed(recipeIds);
  deps.track({ finalCost: cost, dayCount: recipeIds.length });
  deps.clearShoppingComplete();
  deps.navigate('/shopping-list');
  return true;
}
