/**
 * POST /api/telemetry/client-error (admin dashboard, #246): a browser-side
 * error, stored in app_errors with source 'client'.
 *
 * Signed-in users only (a signed-out page doesn't report), with a burst
 * limit. The body is strictly validated and capped at about 4 KB. The
 * household comes from the session, never the body. Only a route pattern,
 * a scrubbed message and the top stack frame are kept.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUserWithinBurst } from '@/lib/api/guard';
import { clientErrorRateLimiter } from '@/lib/api/rateLimit';
import { aiErrorResponse } from '@/lib/ai/errors';
import { reportErrorAfterResponse } from '@/lib/telemetry/report';

export const runtime = 'nodejs';

export const MAX_BODY_BYTES = 4096;

const clientErrorSchema = z.strictObject({
  kind: z.string().max(60),
  message: z.string().max(600),
  route: z.string().max(200),
  topFrame: z.string().max(160).optional(),
});

export async function POST(request: NextRequest) {
  const guarded = await requireUserWithinBurst(clientErrorRateLimiter);
  if (!guarded.ok) return guarded.response;

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return aiErrorResponse('invalid_request');
  // Without a Content-Length (a chunked body) the cap is still enforced, after reading; the platform's own body limit bounds that.
  const text = await request.text().catch(() => '');
  if (text.length === 0 || new TextEncoder().encode(text).length > MAX_BODY_BYTES) return aiErrorResponse('invalid_request');

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return aiErrorResponse('invalid_request');
  }
  const parsed = clientErrorSchema.safeParse(json);
  if (!parsed.success) return aiErrorResponse('invalid_request');

  const { kind, message, route, topFrame } = parsed.data;
  // reportErrorAfterResponse scrubs the message, normalises the route and looks up the session's household.
  reportErrorAfterResponse({
    source: 'client',
    route,
    error: { name: kind, message },
    context: { topFrame },
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
