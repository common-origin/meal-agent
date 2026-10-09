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
import { GeneratedRecipes } from '../ai/schemas';
import { validAiRecipe } from '../ai/__tests__/fixtures';

const request = { familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 };

const generated = (recipes = [validAiRecipe()]) => ({ blocked: false, output: { recipes }, rawFinishReason: 'STOP' });

beforeEach(() => {
  runAiTask.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('generateRecipes', () => {
  it('runs the generation task with its schema, and the system prompt separate from the request prompt', async () => {
    runAiTask.mockResolvedValue(generated());
    await generateRecipes(request, { userId: 'user-1' });

    expect(runAiTask).toHaveBeenCalledTimes(1);
    const [task, options] = runAiTask.mock.calls[0];
    expect(task).toBe('generation');
    expect(options).toMatchObject({ userId: 'user-1', system: buildSystemPrompt(), schema: GeneratedRecipes });
    expect(options.prompt).toContain('Generate 1 weeknight dinner recipes');
    expect(options.prompt).not.toContain(buildSystemPrompt());
  });

  it('normalises each validated recipe (unique IDs, cuisine, prep, Coles cost)', async () => {
    runAiTask.mockResolvedValue(generated([validAiRecipe(), validAiRecipe()]));
    const result = await generateRecipes(request, { userId: 'user-1' });
    if (!('recipes' in result)) throw new Error('expected recipes');
    expect(result.recipes).toHaveLength(2);
    expect(result.recipes[0].id).not.toBe(result.recipes[1].id);
    expect(result.recipes[0]).toMatchObject({
      title: 'Lemon Chicken Traybake',
      cuisine: 'italian',
      ingredients: expect.arrayContaining([expect.objectContaining({ prep: 'cut into 3cm pieces' })]),
    });
    expect(result.recipes[0].costPerServeEst).toBeGreaterThan(0);
  });

  it.each(['timeout', 'invalid_output'] as const)('rethrows %s so the route can return 504/502', async (code) => {
    const error = new AiTaskError(code, 'x');
    runAiTask.mockRejectedValue(error);
    await expect(generateRecipes(request, { userId: 'user-1' })).rejects.toBe(error);
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

  it('reports a blocked response as declined', async () => {
    runAiTask.mockResolvedValue({ blocked: true, output: undefined, rawFinishReason: 'SAFETY' });
    await expect(generateRecipes(request, { userId: 'user-1' })).resolves.toEqual({
      error: 'Failed to generate recipes',
      details: expect.stringContaining('declined to generate recipes for these settings (SAFETY)'),
    });
  });
});
