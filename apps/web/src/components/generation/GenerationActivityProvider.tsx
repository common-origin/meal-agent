"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { createActivityCounter } from "./activityCounter";

interface GenerationActivityContextValue {
  isGenerationInProgress: boolean;
  beginGeneration: () => void;
  endGeneration: () => void;
  /**
   * True from the moment sign-out is clicked until clearHouseholdScopedCaches()
   * has finished running. Generation entry points must check this (not
   * isGenerationInProgress — that one allows legitimate overlapping
   * generations, e.g. a swap regen while a full week is still generating,
   * so it can't also be used to block sign-out from overlapping with them)
   * and refuse to start while it's true.
   */
  isSignOutInProgress: boolean;
  beginSignOut: () => void;
  endSignOut: () => void;
}

const GenerationActivityContext = createContext<GenerationActivityContextValue | undefined>(undefined);

/**
 * Tracks whether an async recipe write (AI generation or a custom recipe
 * save) is in flight anywhere in the app, so Header.tsx can disable
 * "Sign out" while one is running — and the reverse: whether sign-out is
 * in flight, so a new write can't start while one is running either.
 *
 * A stopgap for issue #73: clearHouseholdScopedCaches() is a one-shot
 * cleanup on sign-out, and a write that's already in flight (e.g.
 * RecipeLibrary.addTempAIRecipes()/addCustomRecipes() mid-await) can still
 * write the previous household's data back into the cache after that
 * cleanup runs. Blocking each direction from overlapping the other narrows
 * the window without solving the general case (a proper fix needs a
 * cancellation/session-generation guard across every async local-write
 * path, tracked separately) — and only covers call sites that have been
 * wired in explicitly (plan/page.tsx's generation flows,
 * recipes/add/page.tsx's save, Header.tsx's sign-out), not every current
 * or future one.
 *
 * See ./activityCounter.ts for the generation counter logic itself (kept
 * separate so it's unit-testable without rendering). isSignOutInProgress
 * doesn't need the same overlapping-calls handling — only one sign-out can
 * ever be in flight at a time, since the button that starts it disables
 * itself immediately.
 */
export function GenerationActivityProvider({ children }: { children: React.ReactNode }) {
  const [isGenerationInProgress, setIsGenerationInProgress] = useState(false);
  const [counter] = useState(() => createActivityCounter(setIsGenerationInProgress));
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);

  const value = useMemo(
    () => ({
      isGenerationInProgress,
      beginGeneration: counter.begin,
      endGeneration: counter.end,
      isSignOutInProgress,
      beginSignOut: () => setIsSignOutInProgress(true),
      endSignOut: () => setIsSignOutInProgress(false),
    }),
    [isGenerationInProgress, counter, isSignOutInProgress]
  );

  return (
    <GenerationActivityContext.Provider value={value}>
      {children}
    </GenerationActivityContext.Provider>
  );
}

export function useGenerationActivity(): GenerationActivityContextValue {
  const context = useContext(GenerationActivityContext);
  if (context === undefined) {
    throw new Error("useGenerationActivity must be used within a GenerationActivityProvider");
  }
  return context;
}
