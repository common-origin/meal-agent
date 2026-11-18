"use client";

import { useEffect } from "react";
import { Button, Stack, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { reportClientError } from "@/lib/telemetry/clientReport";

/**
 * Shown inside the normal layout when a page throws. A server error carries a
 * digest and is already recorded by onRequestError, so only client errors are
 * reported from here (admin dashboard, #246).
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { digest: error.digest });
  }, [error]);

  return (
    <Main maxWidth="sm">
      <Stack direction="column" gap="lg">
        <Typography variant="h2">Something went wrong</Typography>
        <Typography variant="body" color="subdued">
          That page hit a problem. You can try again, and if it keeps happening it will be looked at.
        </Typography>
        <div>
          <Button variant="primary" onClick={() => retry()}>
            Try again
          </Button>
        </div>
      </Stack>
    </Main>
  );
}
