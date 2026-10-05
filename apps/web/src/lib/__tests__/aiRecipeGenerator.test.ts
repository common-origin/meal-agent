// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_FAMILY_SETTINGS } from '../types/settings';

const generateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@google/generative-ai')>()),
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent };
    }
  },
}));

import { generateRecipes } from '../aiRecipeGenerator';
import { isTimeoutError } from '../api/aiCall';
import { AI_DEADLINES_MS } from '../constants';

// AbortSignal.timeout runs on Node's own timers, which vi.useFakeTimers()
// doesn't control, so tests build the same signal on the faked setTimeout.
function fakeDeadline(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new DOMException('The operation timed out.', 'TimeoutError')), ms);
  return controller.signal;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(fakeDeadline);
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  generateContent.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generateRecipes deadline', () => {
  it('passes the deadline signal to the model and throws a timeout when it never answers', async () => {
    generateContent.mockReturnValue(new Promise(() => {}));
    const result = generateRecipes({ familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 });
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);

    await vi.advanceTimersByTimeAsync(AI_DEADLINES_MS.generateRecipes - 1);
    expect(generateContent).toHaveBeenCalledTimes(1);
    const { signal } = generateContent.mock.calls[0][1] as { signal: AbortSignal };
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    // The SDK aborts its fetch through this same signal.
    expect(signal.aborted).toBe(true);
  });

  it('shares one deadline across retries', async () => {
    generateContent
      .mockRejectedValueOnce(Object.assign(new Error('[503] overloaded'), { status: 503 }))
      .mockReturnValue(new Promise(() => {}));
    const result = generateRecipes({ familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 });
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);

    await vi.advanceTimersByTimeAsync(AI_DEADLINES_MS.generateRecipes);
    await assertion;
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(generateContent.mock.calls[1][1].signal).toBe(generateContent.mock.calls[0][1].signal);
  });

  it('still returns a non-timeout failure as an error result', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('[400] bad request'), { status: 400 }));
    await expect(
      generateRecipes({ familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 })
    ).resolves.toMatchObject({ error: 'Failed to generate recipes' });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
