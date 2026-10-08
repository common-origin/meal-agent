// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_FAMILY_SETTINGS } from '../types/settings';

const runAiTask = vi.hoisted(() => vi.fn());

// Deadlines, retries, error mapping and usage logging are runAiTask's job
// (tested in lib/ai/__tests__/run.test.ts); here we check what the generator
// asks for and how it handles the outcomes.
vi.mock('../ai/run', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai/run')>()),
  runAiTask,
}));

import { generateRecipes } from '../aiRecipeGenerator';
import { AiTaskError } from '../ai/run';
import { buildSystemPrompt } from '../prompts/recipeGeneration';

const request = { familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 };

const validRecipe = {
  name: 'Lemon Chicken',
  cuisine: 'italian',
  totalTime: 30,
  servings: 4,
  ingredients: [{ name: 'chicken thighs', qty: 500, unit: 'g' }],
  instructions: ['Cook it.'],
};

beforeEach(() => {
  runAiTask.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generateRecipes', () => {
  it('runs the generation task with the system prompt separate from the request prompt', async () => {
    runAiTask.mockResolvedValue({ text: JSON.stringify({ recipes: [validRecipe] }), blocked: false, rawFinishReason: 'STOP' });
    await generateRecipes(request, { userId: 'user-1' });

    expect(runAiTask).toHaveBeenCalledTimes(1);
    const [task, options] = runAiTask.mock.calls[0];
    expect(task).toBe('generation');
    expect(options).toMatchObject({ userId: 'user-1', system: buildSystemPrompt() });
    expect(options.prompt).toContain('Generate 1 weeknight dinner recipes');
    expect(options.prompt).not.toContain(buildSystemPrompt());
  });

  it('parses the response exactly as before the SDK port', async () => {
    runAiTask.mockResolvedValue({
      text: '```json\n' + JSON.stringify({ recipes: [validRecipe] }) + '\n```',
      blocked: false,
      rawFinishReason: 'STOP',
    });
    const result = await generateRecipes(request, { userId: 'user-1' });
    expect(result).toMatchObject({ recipes: [{ title: 'Lemon Chicken' }] });
  });

  it('rethrows a timeout so the route can return 504', async () => {
    const timeout = new AiTaskError('timeout', 'deadline');
    runAiTask.mockRejectedValue(timeout);
    await expect(generateRecipes(request, { userId: 'user-1' })).rejects.toBe(timeout);
  });

  it.each([
    ['unavailable', /temporarily overloaded/],
    ['rate_limited', /Rate limit reached/],
    ['error', /boom/],
  ] as const)('returns a %s failure as an error result', async (code, details) => {
    runAiTask.mockRejectedValue(new AiTaskError(code, 'boom'));
    const result = await generateRecipes(request, { userId: 'user-1' });
    expect(result).toMatchObject({ error: 'Failed to generate recipes', details: expect.stringMatching(details) });
  });

  it('reports a blocked response as declined, not as a parse failure', async () => {
    runAiTask.mockResolvedValue({ text: '', blocked: true, rawFinishReason: 'SAFETY' });
    await expect(generateRecipes(request, { userId: 'user-1' })).resolves.toEqual({
      error: 'Failed to generate recipes',
      details: expect.stringContaining('declined to generate recipes for these settings (SAFETY)'),
    });
  });

  it('still reports unparseable text as a parse failure', async () => {
    runAiTask.mockResolvedValue({ text: 'not json', blocked: false, rawFinishReason: 'STOP' });
    await expect(generateRecipes(request, { userId: 'user-1' })).resolves.toMatchObject({
      error: 'Failed to parse AI response',
    });
  });
});
