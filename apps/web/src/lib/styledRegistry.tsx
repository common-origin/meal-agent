"use client";

import { useState, type ReactNode } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { ServerStyleSheet, StyleSheetManager } from "styled-components";

/**
 * Collects styled-components rules during server rendering and flushes them
 * into the HTML, so styled elements (ours and the design system's, which
 * shares this styled-components copy) arrive styled instead of waiting for
 * hydration (#162). The setup from Next's CSS-in-JS guide.
 */
export default function StyledComponentsRegistry({ children }: { children: ReactNode }) {
  // One sheet per request, created once
  const [sheet] = useState(() => new ServerStyleSheet());

  useServerInsertedHTML(() => {
    const styles = sheet.getStyleElement();
    // Each streamed chunk sends only the rules added since the last one
    sheet.instance.clearTag();
    return <>{styles}</>;
  });

  // On the client, styled-components injects styles itself
  if (typeof window !== "undefined") return <>{children}</>;

  return <StyleSheetManager sheet={sheet.instance}>{children}</StyleSheetManager>;
}
