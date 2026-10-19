/**
 * API Route: Edit the week's plan by typing (#38)
 * POST /api/edit-plan
 *
 * Reads an instruction ("swap Tuesday for something lighter") against the
 * current plan and returns per-night edits. It doesn't generate the new
 * dinners: the plan page does that per night through /api/generate-recipes
 * with each edit's guidance, so the user can preview before accepting.
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { editPlanSchema } from '@/lib/api/schemas';
import { parseBody, readJson, requireUserWithinLimit } from '@/lib/api/guard';
import { runAiTask } from '@/lib/ai/run';
import { PlanEdit } from '@/lib/ai/schemas';
import { aiErrorResponse, aiFailureResponse } from '@/lib/ai/errors';
import { buildPlanEditPrompt, buildPlanEditSystemPrompt } from '@/lib/prompts/planEdit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.planEdit.deadlineMs, so the route can return its 504 first.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.editPlan);
    if (!auth.ok) return auth.response;

    const parsed = parseBody(editPlanSchema, await readJson(request), 'edit-plan');
    if (!parsed.ok) return parsed.response;

    const result = await runAiTask('planEdit', {
      userId: auth.value.id,
      system: buildPlanEditSystemPrompt(),
      prompt: buildPlanEditPrompt(parsed.value),
      schema: PlanEdit,
    });

    if (result.blocked) {
      console.warn(`edit-plan: response blocked (${result.rawFinishReason ?? 'content filtered'})`);
      return aiErrorResponse('blocked', { message: "We couldn't work out that change. Try rewording it." });
    }

    const { reply, question } = result.output;
    // A question means nothing changes yet. Otherwise one edit per night: the last one wins.
    const edits = question
      ? []
      : [...new Map(result.output.edits.map((edit) => [edit.day, edit])).values()].sort((a, b) => a.day - b.day);
    return NextResponse.json({ reply, ...(question ? { question } : {}), edits });
  } catch (error) {
    return aiFailureResponse(error, 'edit-plan');
  }
}
