/**
 * `runAiTask`: the one way server code calls an AI model (#83).
 *
 * Owns, for every call:
 * - the per-task model, thinking level and output cap (models.ts);
 * - structured output: the caller's schema goes to the model as
 *   `Output.object({ schema })` and the result is validated against it (#84);
 * - one deadline for the whole call, retries included, via
 *   AbortSignal.timeout (#81 carried over);
 * - the SDK's retries (maxRetries 2: 429, 5xx and network errors only), plus
 *   one retry when the output doesn't match the schema;
 * - usage logging and cost (#85, lib/ai/usage.ts), one entry per attempt;
 * - typed errors (AiTaskError) so routes can map outcomes to responses (#96).
 */

import { APICallError, generateText, Output, type LanguageModelUsage, type ModelMessage } from 'ai';
import type { GoogleLanguageModelOptions } from '@ai-sdk/google';
import type { z } from 'zod';
import { getAiProvider } from './client';
import { AI_TASKS, type AiTask } from './models';
import { recordAiUsage, type AiCallContext, type AiCallStatus } from './usage';
import type { TokenUsage } from './pricing';
import { raceAbort } from '@/lib/utils/async';

export const AI_MAX_RETRIES = 2;
/** Fresh attempts after output that fails the schema, before giving up. */
export const AI_INVALID_OUTPUT_RETRIES = 1;

export type AiTaskErrorCode = 'timeout' | 'rate_limited' | 'unavailable' | 'invalid_output' | 'error';

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

export function isAiInvalidOutput(error: unknown): boolean {
  return error instanceof AiTaskError && error.code === 'invalid_output';
}

export type RunAiTaskOptions<SCHEMA extends z.ZodType> = {
  /** The response shape; sent to the model and enforced before returning. */
  schema: SCHEMA;
  system?: string;
  /** The signed-in user, for usage logging and the daily cap. */
  userId: string;
  /** Aborts the call early (in addition to the task's deadline). */
  signal?: AbortSignal;
} & ({ prompt: string; messages?: never } | { messages: ModelMessage[]; prompt?: never });

export type AiTaskResult<T> =
  | { blocked: false; output: T; rawFinishReason: string | undefined }
  /** The provider withheld the response (safety, recitation, ...); there is no output. */
  | { blocked: true; output: undefined; rawFinishReason: string | undefined };

export async function runAiTask<SCHEMA extends z.ZodType>(
  task: AiTask,
  options: RunAiTaskOptions<SCHEMA>
): Promise<AiTaskResult<z.output<SCHEMA>>> {
  const config = AI_TASKS[task];
  const deadline = AbortSignal.timeout(config.deadlineMs);
  const abortSignal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;
  const usageContext: AiCallContext = { task, model: config.model, userId: options.userId };
  const google: GoogleLanguageModelOptions = { thinkingConfig: { thinkingLevel: config.thinkingLevel } };

  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now();
    // The final step's raw finish reason and usage, kept for when output parsing throws.
    let lastStep: { rawFinishReason: string | undefined; usage: LanguageModelUsage } | undefined;
    const record = (status: AiCallStatus, errorCode: string | null, usage?: LanguageModelUsage) =>
      recordAiUsage(usageContext, {
        latencyMs: Date.now() - startedAt,
        status,
        errorCode,
        tokens: usage ? tokenUsage(usage) : { inputTokens: null, outputTokens: null, thinkingTokens: null },
      });

    try {
      // The SDK aborts its request on abortSignal; the race also holds the
      // deadline if a call somehow stays open after the abort (#81).
      const result = await raceAbort(
        generateText({
          model: getAiProvider()(config.model),
          system: options.system,
          ...(options.messages ? { messages: options.messages } : { prompt: options.prompt as string }),
          output: Output.object({ schema: options.schema }),
          maxOutputTokens: config.maxOutputTokens,
          maxRetries: AI_MAX_RETRIES,
          abortSignal,
          providerOptions: { google },
          onStepEnd: (step) => {
            lastStep = { rawFinishReason: step.rawFinishReason, usage: step.usage };
          },
        }),
        abortSignal
      );

      if (result.finishReason === 'content-filter') {
        record('blocked', result.rawFinishReason ?? 'content-filter', result.usage);
        return { blocked: true, output: undefined, rawFinishReason: result.rawFinishReason };
      }
      // Throws NoOutputGeneratedError when nothing was parsed.
      const output = result.output as z.output<SCHEMA>;
      record('ok', null, result.usage);
      return { blocked: false, output, rawFinishReason: result.rawFinishReason };
    } catch (error) {
      if (isOutputError(error) && !deadline.aborted && !options.signal?.aborted) {
        const finishReason = (error as { finishReason?: string }).finishReason;
        const usage = (error as { usage?: LanguageModelUsage }).usage ?? lastStep?.usage;
        if (finishReason === 'content-filter') {
          const rawFinishReason = lastStep?.rawFinishReason;
          record('blocked', rawFinishReason ?? 'content-filter', usage);
          return { blocked: true, output: undefined, rawFinishReason };
        }
        record('invalid_output', lastStep?.rawFinishReason ?? 'schema', usage);
        // Output cut off at the token cap would be cut off again; don't pay twice.
        if (attempt < AI_INVALID_OUTPUT_RETRIES && finishReason !== 'length') continue;
        throw new AiTaskError('invalid_output', 'The AI response did not match the expected format', undefined, {
          cause: error,
        });
      }

      const failure = classifyError(error, deadline);
      record(failure.status, failure.errorCode);
      throw failure.error;
    }
  }
}

/** Output that couldn't be parsed or didn't match the schema. */
function isOutputError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === 'AI_NoObjectGeneratedError' || name === 'AI_NoOutputGeneratedError';
}

function tokenUsage(usage: LanguageModelUsage): TokenUsage {
  const reasoning = usage.outputTokenDetails.reasoningTokens;
  // Some providers report only the output total; derive the text part from it.
  const text =
    usage.outputTokenDetails.textTokens ??
    (usage.outputTokens !== undefined ? usage.outputTokens - (reasoning ?? 0) : undefined);
  return {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: text ?? null,
    thinkingTokens: reasoning ?? null,
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
