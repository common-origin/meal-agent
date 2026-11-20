"use client";

import { useCallback, useSyncExternalStore } from "react";

// One MediaQueryList per query, kept (React reads the snapshot on every render); rebuilt only if matchMedia itself is replaced.
const lists = new Map<string, { matchMedia: typeof window.matchMedia; list: MediaQueryList }>();

function mediaList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  const cached = lists.get(query);
  if (cached?.matchMedia === window.matchMedia) return cached.list;
  const list = window.matchMedia(query);
  lists.set(query, { matchMedia: window.matchMedia, list });
  return list;
}

/**
 * Whether a CSS media query matches. True on the server and where matchMedia is
 * missing (the wide layout); the browser corrects it right after hydrating, so
 * a phone briefly gets the wide layout first. Use it only for what the design
 * system's responsive props can't express (showing or hiding a node).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = mediaList(query);
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => mediaList(query)?.matches ?? true,
    () => true
  );
}
