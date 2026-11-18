/**
 * Runs in the browser before the app is interactive (Next 16), so errors
 * thrown before hydration are caught too (admin dashboard, #246). Errors that
 * React error boundaries catch are reported by app/error.tsx instead.
 */

import { reportClientError } from '@/lib/telemetry/clientReport';

window.addEventListener('error', (event) => {
  // A script error with no Error object (cross-origin, or a resource failing) has nothing useful to report.
  if (!event.error) return;
  reportClientError(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  reportClientError(event.reason);
});
