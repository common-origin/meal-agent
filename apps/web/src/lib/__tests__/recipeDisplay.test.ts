import { describe, it, expect } from 'vitest';
import { recipeSourceLabel } from '../recipeDisplay';
import type { Recipe } from '../types/recipe';

const recipe = (id: string, domain: string, chef?: string) => ({ id, source: { domain, chef } }) as unknown as Recipe;

describe('recipeSourceLabel (#181)', () => {
  it.each([
    ['an AI recipe', recipe('ai-soup-1', 'ai-generated'), 'AI generated'],
    ['an older AI recipe id', recipe('custom-ai-2', 'user-added'), 'AI generated'],
    ['a recipe you added without a chef', recipe('custom-3', 'user-added'), 'Added by you'],
    ['a recipe you added with a chef', recipe('custom-4', 'user-added', 'Nan'), 'Nan'],
    ['a library recipe', recipe('lib-5', 'taste.com.au', 'Jamie Oliver'), 'Jamie Oliver'],
  ])('labels %s', (_label, r, expected) => {
    expect(recipeSourceLabel(r)).toBe(expected);
  });

  it('is null when the source is unknown, so the card shows nothing', () => {
    expect(recipeSourceLabel(recipe('lib-6', 'taste.com.au'))).toBeNull();
  });
});
