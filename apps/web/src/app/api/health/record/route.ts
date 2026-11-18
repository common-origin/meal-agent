/**
 * POST /api/health/record (#248): runs the dependency checks, stores one
 * health_checks row, and purges expired telemetry. Called every 15 minutes by
 * .github/workflows/uptime.yml with `Authorization: Bearer $HEALTH_CHECK_SECRET`.
 *
 * With HEALTH_CHECK_SECRET unset the route answers 404, as if it weren't
 * there. The comparison is timing-safe, on SHA-256 digests of both values.
 * Purging runs every time: it is indexed and cheap, and needs no state.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runHealthChecks } from '@/lib/health/checks';
import { release } from '@/lib/telemetry/release';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// The Gemini check alone can take 8 s.
export const maxDuration = 30;

const digest = (value: string) => createHash('sha256').update(value).digest();

function authorised(request: NextRequest, secret: string): boolean {
  const match = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '');
  if (!match) return false;
  return timingSafeEqual(digest(match[1]), digest(secret));
}

export async function POST(request: NextRequest) {
  const secret = process.env.HEALTH_CHECK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!authorised(request, secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const report = await runHealthChecks();

  let recorded = false;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('health_checks').insert({
      release: release(),
      ok: report.ok,
      checks: report.checks as unknown as Json,
      total_latency_ms: report.totalLatencyMs,
    });
    if (error) console.warn('health_checks insert failed (is migration 021 applied?):', error.message);
    else recorded = true;
    const purged = await supabase.rpc('purge_telemetry');
    if (purged.error) console.warn('purge_telemetry failed (is migration 019 applied?):', purged.error.message);
  } catch (e) {
    console.warn('health record failed:', e instanceof Error ? e.message : String(e));
  }

  // The response is for the workflow's job summary: which checks passed, nothing secret.
  return NextResponse.json({
    ok: report.ok,
    recorded,
    checks: Object.fromEntries(Object.entries(report.checks).map(([name, check]) => [name, { ok: check.ok, detail: check.detail ?? null }])),
  });
}
