/**
 * `runAiTask`: the one way server code calls an AI model (#83).
 *
 * Owns, for every call:
 * - the per-task model, thinking level and output cap (models.ts);
 * - one deadline for the whole call, retries included, via
 *   AbortSignal.timeout (#81 carried over);
 * - the SDK's retries (maxRetries 2: 429, 5xx and network errors only);
 * - usage logging and cost (#85, lib/ai/usage.ts);
 * - typed errors (AiTaskError) so routes can map outcomes to responses (#96).
 *
 * Structured output (#84) will add an `output` option here; for now callers
 * parse `text` exactly as before the port.
 */

import { APICallError, generateText, type ModelMessage } from 'ai';
import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import { getAiProvider } from './client';
import { AI_TASKS, type AiTask } from './models';
import { recordAiUsage, type AiCallStatus } from './usage';
import type { TokenUsage } from './pricing';
import { raceAbort } from '@/lib/utils/async';

export const AI_MAX_RETRIES = 2;

export type AiTaskErrorCode = 'timeout' | 'rate_limited' | 'unavailable' | 'error';

/** A failed AI call, classified. `cause` is the original SDK error. */
export class AiTaskError extends Error {
  constructor(
    public readonly code: AiTaskErrorCode,
    message: string,
    public readonly httpStatus?: number,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AiTaskError';
  }
}

export function isAiTimeout(error: unknown): boolean {
  return error instanceof AiTaskError && error.code === 'timeout';
}

export type RunAiTaskOptions = {
  system?: string;
  /** The signed-in user, for usage logging and the daily cap. */
  userId: string;
  /** Aborts the call early (in addition to the task's deadline). */
  signal?: AbortSignal;
} & ({ prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never });

export interface AiTaskResult {
  text: string;
  /** True when the provider withheld the response (safety, recitation, ...). */
  blocked: boolean;
  /** The provider's own finish reason, e.g. "STOP", "RECITATION", "SAFETY". */
  rawFinishReason: string | undefined;
}

export async function runAiTask(task: AiTask, options: RunAiTaskOptions): Promise<AiTaskResult> {
  const config = AI_TASKS[task];
  const deadline = AbortSignal.timeout(config.deadlineMs);
  const abortSignal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const usageContext = { task, model: config.model, userId: options.userId };
  const startedAt = Date.now();

  try {
    const google: GoogleLanguageModelOptions = { thinkingConfig: { thinkingLevel: config.thinkingLevel } };
    // The SDK aborts its request on abortSignal; the race also holds the
    // deadline if a call somehow stays open after the abort (#81).
    const result = await raceAbort(generateText({
      model: getAiProvider()(config.model),
      system: options.system,
      ...(options.messages ? { messages: options.messages } : { prompt: options.prompt as string }),
      maxOutputTokens: config.maxOutputTokens,
      maxRetries: AI_MAX_RETRIES,
      abortSignal,
      providerOptions: { google },
    }), abortSignal);

    const blocked = result.finishReason === 'content-filter';
    recordAiUsage(usageContext, {
      latencyMs: Date.now() - startedAt,
      status: blocked ? 'blocked' : 'ok',
      errorCode: blocked ? (result.rawFinishReason ?? 'content-filter') : null,
      tokens: tokenUsage(result.usage),
    });
    return { text: result.text, blocked, rawFinishReason: result.rawFinishReason };
  } catch (error) {
    const failure = classifyError(error, deadline);
    recordAiUsage(usageContext, {
      latencyMs: Date.now() - startedAt,
      status: failure.status,
      errorCode: failure.errorCode,
      tokens: { inputTokens: null, outputTokens: null, thinkingTokens: null },
    });
    throw failure.error;
  }
}

function tokenUsage(usage: {
  inputTokens: number | undefined;
  outputTokenDetails: { textTokens: number | undefined; reasoningTokens: number | undefined };
}): TokenUsage {
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokenDetails.textTokens ?? null,
    thinkingTokens: usage.outputTokenDetails.reasoningTokens ?? null,
  };
}

const RATE_LIMITED = 429;
const UNAVAILABLE = new Set([500, 502, 503, 504]);

function classifyError(
  error: unknown,
  deadline: AbortSignal
): { error: AiTaskError; status: AiCallStatus; errorCode: string } {
  if (deadline.aborted) {
    return {
      error: new AiTaskError('timeout', 'The AI call took longer than its deadline', undefined, { cause: error }),
      status: 'timeout',
      errorCode: 'timeout',
    };
  }

  // After exhausting retries the SDK throws AI_RetryError wrapping the last attempt's error.
  const last = (error as { name?: string; lastError?: unknown })?.name === 'AI_RetryError'
    ? (error as { lastError: unknown }).lastError
    : error;
  const httpStatus = APICallError.isInstance(last) ? last.statusCode : undefined;
  const message = last instanceof Error ? last.message : String(last);

  if (httpStatus === RATE_LIMITED) {
    return { error: new AiTaskError('rate_limited', message, httpStatus, { cause: error }), status: 'rate_limited', errorCode: 'http_429' };
  }
  if (httpStatus !== undefined && UNAVAILABLE.has(httpStatus)) {
    return { error: new AiTaskError('unavailable', message, httpStatus, { cause: error }), status: 'error', errorCode: `http_${httpStatus}` };
  }
  return {
    error: new AiTaskError('error', message, httpStatus, { cause: error }),
    status: 'error',
    errorCode: httpStatus !== undefined ? `http_${httpStatus}` : last instanceof Error ? last.name : 'unknown',
  };
}
