/**
 * Next calls onRequestError for every uncaught server error: route-handler
 * throws, server-component render errors and server actions (admin dashboard,
 * #244). The row stores `context.routePath` (a pattern such as
 * `/app/api/plan/ics/[token]`), never `request.path`, which includes the
 * query string and the real dynamic segments.
 *
 * Next requires async work here to be awaited, and `after()` isn't available.
 */

import type { Instrumentation } from 'next';

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The Edge runtime (the proxy) can't use the Node-only helpers; its errors stay in the logs.
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { reportErrorNow } = await import('@/lib/telemetry/report');
  await reportErrorNow({
    source: 'server',
    route: context.routePath,
    error,
    context: { method: request.method, routeType: context.routeType, renderSource: context.renderSource },
  });
};
