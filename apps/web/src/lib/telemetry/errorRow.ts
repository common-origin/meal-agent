/**
 * Builds the app_errors row for a failure (admin dashboard, #244). Pure: no
 * I/O, so every privacy rule here is unit tested. Everything stored passes
 * through scrub(), routePattern() or a whitelist; nothing is copied from the
 * error object as-is.
 */

import { fingerprint } from './fingerprint';
import { release } from './release';
import { routePattern } from './routePattern';
import { scrub } from './scrub';

export type ErrorSource = 'server' | 'route' | 'client';

/** Context keys that may be stored. Anything else is dropped. */
export type ErrorContext = {
  method?: string;
  routeType?: string;
  renderSource?: string;
  status?: number;
  /** The top stack frame only, as file:line. */
  topFrame?: string;
};

export interface ErrorReport {
  source: ErrorSource;
  /** Route pattern, e.g. `/app/api/plan/ics/[token]`. A plain path is normalised through routePattern(). */
  route?: string | null;
  /** A developer-written static label, e.g. 'coles-search: lookup failed'. */
  label?: string | null;
  error: unknown;
  context?: ErrorContext;
  /** Pseudonymous household. Never a user. */
  householdId?: string | null;
  /** Set on server errors; client reports pass the digest they were given. */
  digest?: string | null;
}

export interface AppErrorRow {
  release: string;
  source: ErrorSource;
  route: string | null;
  label: string | null;
  kind: string;
  message: string;
  digest: string | null;
  fingerprint: string;
  household_id: string | null;
  context: ErrorContext;
}

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const ROUTE_TYPES = new Set(['render', 'route', 'action', 'proxy']);
const RENDER_SOURCES = new Set(['react-server-components', 'react-server-components-payload', 'server-rendering']);
const MAX_LABEL = 120;
const MAX_FRAME = 160;

/** The error's class name when it is a plain identifier, else 'Error'. */
export function errorKind(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : '';
  return /^[A-Za-z][A-Za-z0-9_.]{0,59}$/.test(name) ? name : 'Error';
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message);
  return '';
}

export function errorDigest(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
    const digest = (error as { digest: unknown }).digest;
    if (typeof digest === 'string' || typeof digest === 'number') return String(digest).slice(0, 64);
  }
  return null;
}

/**
 * The first stack frame as `file:line`, keeping only the last two path
 * segments and dropping the query string, host and column.
 */
export function topFrameOf(stack: string | undefined | null): string | undefined {
  if (!stack) return undefined;
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    // Chrome/Node: "at fn (file:1:2)" or "at file:1:2"; Firefox/Safari: "fn@file:1:2".
    const match = /^at\s+(?:.*?\()?(.*?):(\d+):\d+\)?$/.exec(line) ?? /@(.*?):(\d+):\d+$/.exec(line);
    if (!match) continue;
    const location = (match[1] ?? '').replace(/^[a-z]+:\/\/[^/]*/i, '').split(/[?#]/, 1)[0] ?? '';
    const file = location.split('/').filter(Boolean).slice(-2).join('/');
    if (file) return `${file}:${match[2]}`.slice(0, MAX_FRAME);
  }
  return undefined;
}

export function sanitizeContext(context: ErrorContext | undefined): ErrorContext {
  const out: ErrorContext = {};
  if (!context) return out;
  if (context.method && METHODS.has(context.method.toUpperCase())) out.method = context.method.toUpperCase();
  if (context.routeType && ROUTE_TYPES.has(context.routeType)) out.routeType = context.routeType;
  if (context.renderSource && RENDER_SOURCES.has(context.renderSource)) out.renderSource = context.renderSource;
  if (typeof context.status === 'number' && Number.isInteger(context.status) && context.status >= 100 && context.status <= 599) {
    out.status = context.status;
  }
  if (typeof context.topFrame === 'string' && context.topFrame) out.topFrame = scrub(context.topFrame).slice(0, MAX_FRAME);
  return out;
}

export function buildErrorRow(report: ErrorReport, env?: Record<string, string | undefined>): AppErrorRow {
  const route = report.route ? routePattern(report.route) : null;
  const label = report.label ? scrub(report.label).slice(0, MAX_LABEL) : null;
  const kind = errorKind(report.error);
  const message = scrub(errorMessage(report.error));
  const context = sanitizeContext({
    ...report.context,
    topFrame: report.context?.topFrame ?? (report.error instanceof Error ? topFrameOf(report.error.stack) : undefined),
  });
  return {
    release: release(env),
    source: report.source,
    route,
    label,
    kind,
    message,
    digest: report.digest ?? errorDigest(report.error),
    fingerprint: fingerprint({ source: report.source, kind, route, message, label }),
    household_id: report.householdId ?? null,
    context,
  };
}
