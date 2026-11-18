"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry/clientReport";

/**
 * The last resort, for an error in the root layout. It replaces the whole
 * document, so it has no providers or global styles: plain markup, inline
 * styles that take the browser's own colours (the design tokens aren't loaded here). Server errors (those with a digest) are already recorded by
 * onRequestError, so they aren't reported again (admin dashboard, #246).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", colorScheme: "light dark" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ opacity: 0.75 }}>The app hit a problem. You can try again.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "10px 16px", fontSize: 16, borderRadius: 8, border: "1px solid currentColor", background: "transparent", color: "inherit", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
