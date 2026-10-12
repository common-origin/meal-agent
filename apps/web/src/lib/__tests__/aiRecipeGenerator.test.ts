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

import { cleanExplanation, generateRecipes } from '../aiRecipeGenerator';
import { AiTaskError } from '../ai/run';
import { buildSystemPrompt } from '../prompts/recipeGeneration';
import { GeneratedRecipes } from '../ai/schemas';
import { validGeneratedRecipe } from '../ai/__tests__/fixtures';

const request = { familySettings: DEFAULT_FAMILY_SETTINGS, numberOfRecipes: 1 };

const generated = (recipes = [validGeneratedRecipe()]) => ({ blocked: false, output: { recipes }, rawFinishReason: 'STOP' });

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
    runAiTask.mockResolvedValue(generated([validGeneratedRecipe(), validGeneratedRecipe()]));
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

  it.each(['timeout', 'invalid_output', 'unavailable', 'rate_limited', 'error'] as const)(
    'rethrows %s for the route to map to a friendly response (#96)',
    async (code) => {
      const error = new AiTaskError(code, 'x');
      runAiTask.mockRejectedValue(error);
      await expect(generateRecipes(request, { userId: 'user-1' })).rejects.toBe(error);
    }
  );

  it('reports a blocked response without recipes', async () => {
    runAiTask.mockResolvedValue({ blocked: true, output: undefined, rawFinishReason: 'SAFETY' });
    await expect(generateRecipes(request, { userId: 'user-1' })).resolves.toEqual({
      blocked: true,
      rawFinishReason: 'SAFETY',
    });
  });

  it('returns each recipe\'s "why this meal" line keyed by its ID, not on the recipe (#94)', async () => {
    runAiTask.mockResolvedValue(
      generated([
        validGeneratedRecipe({ whyThisMeal: '  Uses your  broccoli before it wilts. ' }),
        validGeneratedRecipe({ whyThisMeal: 'A perfect weeknight dinner.' }),
      ])
    );
    const result = await generateRecipes(request, { userId: 'user-1' });
    if (!('recipes' in result)) throw new Error('expected recipes');
    const [first, second] = result.recipes;
    expect(result.explanations).toEqual({ [first.id]: 'Uses your broccoli before it wilts.' });
    expect(second.id in result.explanations).toBe(false);
    expect(first).not.toHaveProperty('whyThisMeal');
  });
});

describe('cleanExplanation (#94)', () => {
  it.each([
    'A delicious midweek curry.',
    'Personalised for your family.',
    'Personalized for your family.',
    'The perfect Tuesday dinner.',
    'Our AI picked this for you.',
    '   ',
  ])('drops %j', (text) => {
    expect(cleanExplanation(text)).toBeUndefined();
  });

  it('keeps a specific line, tidied, and does not trip on words that merely contain a banned one', () => {
    expect(cleanExplanation(' Uses your  basil in a Thai   curry, ready in 30 minutes. ')).toBe(
      'Uses your basil in a Thai curry, ready in 30 minutes.'
    );
  });
});
