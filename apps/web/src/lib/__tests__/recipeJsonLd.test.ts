import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractJsonLdRecipe, htmlToText, MAX_PAGE_TEXT_CHARS, parseDuration, parseYield } from '../recipeJsonLd';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const ldPage = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe('extractJsonLdRecipe (#93)', () => {
  it('reads a Recipe from @graph, skipping malformed blocks, with HowToSection steps', () => {
    expect(extractJsonLdRecipe(fixture('jsonld-recipe.html'))).toEqual({
      title: 'Weeknight Lemon Chicken & Potato Traybake',
      serves: 4,
      timeMins: 60,
      instructions: [
        'Heat the oven to 200°C.',
        'Toss the chicken with the lemon juice.',
        'Roast for 45 minutes, adding the stock halfway.',
      ],
      ingredientLines: ['800 g chicken thigh fillets, cut into 3cm pieces', '1 ½ cups chicken stock', '2 lemons, juiced'],
      source: 'Sam Example',
    });
  });

  it('reads a Recipe from a top-level array, with string instructions and the publisher as source', () => {
    expect(extractJsonLdRecipe(fixture('jsonld-array.html'))).toEqual({
      title: 'Simple Tomato Soup',
      serves: 6,
      timeMins: 120,
      instructions: ['Soften the onion.', 'Add the tomatoes and simmer.'],
      ingredientLines: ['1 kg ripe tomatoes', '1 brown onion, diced'],
      source: 'Example Recipes',
    });
  });

  it('returns null for a page with no JSON-LD recipe', () => {
    expect(extractJsonLdRecipe(fixture('no-jsonld.html'))).toBeNull();
  });

  it('ignores malformed JSON-LD and non-Recipe nodes', () => {
    const html = `<script type="application/ld+json">{ broken</script>${ldPage({ '@type': 'Article', name: 'News' })}`;
    expect(extractJsonLdRecipe(html)).toBeNull();
  });

  it('adds prepTime and cookTime when there is no totalTime', () => {
    const recipe = extractJsonLdRecipe(ldPage({ '@type': 'Recipe', name: 'Soup', prepTime: 'PT10M', cookTime: 'PT1H20M' }));
    expect(recipe?.timeMins).toBe(90);
  });

  it('returns empty lists when the page has no ingredients or steps', () => {
    expect(extractJsonLdRecipe(ldPage({ '@type': 'Recipe', name: 'Mystery' }))).toEqual({
      title: 'Mystery',
      serves: undefined,
      timeMins: undefined,
      instructions: [],
      ingredientLines: [],
      source: undefined,
    });
  });

  it('accepts plain-string HowToStep lists and author arrays', () => {
    const recipe = extractJsonLdRecipe(
      ldPage({
        '@type': 'Recipe',
        name: 'Toast',
        recipeInstructions: ['Toast the bread.', { '@type': 'HowToStep', name: 'Butter it.' }],
        author: [{ '@type': 'Person', name: 'Jo' }],
      })
    );
    expect(recipe).toMatchObject({ instructions: ['Toast the bread.', 'Butter it.'], source: 'Jo' });
  });
});

describe('parseDuration', () => {
  it.each([
    ['PT45M', 45],
    ['PT1H20M', 80],
    ['P0DT2H', 120],
    ['PT90S', 2],
    ['P1D', 1440],
  ])('%s → %i minutes', (value, minutes) => {
    expect(parseDuration(value)).toBe(minutes);
  });

  it.each(['', 'P', 'PT', '45 minutes', undefined, 45])('ignores %j', (value) => {
    expect(parseDuration(value as string)).toBeUndefined();
  });
});

describe('parseYield', () => {
  it.each([
    ['4 servings', 4],
    [['4', '4 servings'], 4],
    [6, 6],
    ['Makes 12 muffins', 12],
  ] as const)('%j → %i', (value, serves) => {
    expect(parseYield(value as never)).toBe(serves);
  });

  it.each(['a few', [], undefined])('ignores %j', (value) => {
    expect(parseYield(value as never)).toBeUndefined();
  });
});

describe('htmlToText', () => {
  it('keeps the readable recipe and drops scripts, styles, nav, header, footer, aside, svg and noscript', () => {
    const text = htmlToText(fixture('no-jsonld.html'));
    expect(text).toContain('Pantry Pasta');
    expect(text).toContain('Serves 4 · Ready in 25 minutes');
    expect(text).toContain('400 g spaghetti');
    expect(text).toContain('toss through the pasta & serve.');
    for (const noise of ['window.analytics', 'color: #333', 'Home', 'newsletter', 'enable JavaScript', 'footer', 'M0 0L10']) {
      expect(text).not.toContain(noise);
    }
  });

  it(`is cut to ${MAX_PAGE_TEXT_CHARS} chars by default`, () => {
    const html = `<p>${'word '.repeat(10_000)}</p>`;
    expect(htmlToText(html).length).toBe(MAX_PAGE_TEXT_CHARS);
  });
});
