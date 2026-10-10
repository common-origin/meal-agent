// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { AI_ERRORS, aiErrorResponse, aiFailureResponse, toAiErrorCode, unreadablePageResponse } from '../errors';
import { AiTaskError, type AiTaskErrorCode } from '../run';

describe('AI error contract (#96)', () => {
  it.each([
    ['unauthenticated', 401, 'Please sign in to use this feature.'],
    ['rate_limited', 429, "You've hit the limit for now. Try again in a few minutes."],
    ['daily_cap', 429, "You've reached today's AI limit. It resets tomorrow."],
    ['provider_busy', 503, 'The AI service is busy right now. Please try again in a minute.'],
    ['timeout', 504, 'That took too long. Please try again.'],
    ['invalid_output', 502, "The AI returned something we couldn't read. Please try again."],
    ['invalid_request', 400, 'Something was wrong with that request.'],
    ['recitation', 422, "We couldn't read this page automatically. Please add the recipe manually."],
    ['blocked', 422, "We couldn't process this photo. Try a different one."],
    ['image_too_large', 413, 'That photo is too large. Try a smaller one.'],
    ['unknown', 500, 'Something went wrong. Please try again.'],
  ] as const)('%s → %i with friendly copy', async (code, status, message) => {
    expect(AI_ERRORS[code]).toEqual({ status, message });
    const res = aiErrorResponse(code);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message, code });
  });

  it('lets a route override the copy but not the code or status', async () => {
    const res = aiErrorResponse('blocked', { message: "We couldn't read that page." });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "We couldn't read that page.", code: 'blocked' });
  });

  it.each([
    ['timeout', 'timeout'],
    ['invalid_output', 'invalid_output'],
    ['rate_limited', 'provider_busy'],
    ['unavailable', 'provider_busy'],
    ['error', 'unknown'],
  ] as [AiTaskErrorCode, string][])('maps AiTaskError %s to %s', (taskCode, code) => {
    expect(toAiErrorCode(new AiTaskError(taskCode, 'raw SDK message', 404))).toBe(code);
  });

  it.each([new Error('Not Found: models/gemini-1.5-pro'), 'a string', null, undefined])(
    'maps anything else (%s) to unknown',
    (error) => {
      expect(toAiErrorCode(error)).toBe('unknown');
    }
  );

  it('logs the raw error server-side but never returns it', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = new AiTaskError('error', '404 Not Found: models/gemini-1.5-pro is not found', 404);
    const res = aiFailureResponse(raw, 'test-route');
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'Something went wrong. Please try again.', code: 'unknown' });
    expect(JSON.stringify(body)).not.toContain('gemini');
    expect(body).not.toHaveProperty('details');
    expect(log).toHaveBeenCalledWith('test-route: request failed (unknown)', raw);
    log.mockRestore();
  });

  it.each([
    ['invalid_url', 400],
    ['blocked_host', 400],
    ['timeout', 422],
    ['too_large', 422],
    ['not_html', 422],
    ['http_error', 422],
  ])('unreadable page %s → %i with the shared copy', async (code, status) => {
    const res = unreadablePageResponse(code);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({
      error: "We couldn't read that page. Check the link or add the recipe manually.",
      code,
    });
  });
});
