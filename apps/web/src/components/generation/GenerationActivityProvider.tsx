"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { createActivityCounter } from "./activityCounter";

interface GenerationActivityContextValue {
  isGenerationInProgress: boolean;
  beginGeneration: () => void;
  endGeneration: () => void;
}

const GenerationActivityContext = createContext<GenerationActivityContextValue | undefined>(undefined);

/**
 * Tracks whether an async recipe write (AI generation or a custom recipe
 * save) is in flight anywhere in the app, so Header.tsx can disable
 * "Sign out" while one is running.
 *
 * A stopgap for issue #73: clearHouseholdScopedCaches() is a one-shot
 * cleanup on sign-out, and a write that's already in flight (e.g.
 * RecipeLibrary.addTempAIRecipes()/addCustomRecipes() mid-await) can still
 * write the previous household's data back into the cache after that
 * cleanup runs. Disabling sign-out during the write narrows the window
 * without solving the general case (a proper fix needs a
 * cancellation/session-generation guard across every async local-write
 * path, tracked separately) — and only covers call sites that have been
 * wired in explicitly (plan/page.tsx's generation flows,
 * recipes/add/page.tsx's save), not every current or future one.
 *
 * See ./activityCounter.ts for the counter logic itself (kept separate so
 * it's unit-testable without rendering).
 */
export function GenerationActivityProvider({ children }: { children: React.ReactNode }) {
  const [isGenerationInProgress, setIsGenerationInProgress] = useState(false);
  const [counter] = useState(() => createActivityCounter(setIsGenerationInProgress));

  const value = useMemo(
    () => ({
      isGenerationInProgress,
      beginGeneration: counter.begin,
      endGeneration: counter.end,
    }),
    [isGenerationInProgress, counter]
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
