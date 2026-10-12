/**
 * Recipe pages: structured data first, stripped text as a fallback (#93).
 *
 * Most recipe sites embed a schema.org `Recipe` block as JSON-LD with the
 * exact title, steps and ingredient lines, often well past the first 50k
 * characters of HTML. `extractJsonLdRecipe` reads it with no AI; only the
 * ingredient lines still need the model, to fit the five-unit schema.
 * `htmlToText` is for pages without one. Regex only, no HTML parser
 * dependency.
 */

export interface JsonLdRecipe {
  title: string;
  /** First integer in `recipeYield`. */
  serves?: number;
  /** `totalTime`, or `prepTime` + `cookTime`. */
  timeMins?: number;
  instructions: string[];
  /** Raw lines, e.g. "2 cups plain flour, sifted". */
  ingredientLines: string[];
  /** `author.name`, else `publisher.name`. */
  source?: string;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const LD_JSON_BLOCK = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

export function extractJsonLdRecipe(html: string): JsonLdRecipe | null {
  for (const match of html.matchAll(LD_JSON_BLOCK)) {
    let data: Json;
    try {
      data = JSON.parse(match[1].trim()) as Json;
    } catch {
      continue; // Malformed blocks are common; skip them.
    }
    const node = findRecipeNode(data);
    if (node) return toJsonLdRecipe(node);
  }
  return null;
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRecipeType(type: Json | undefined): boolean {
  if (typeof type === 'string') return type === 'Recipe';
  return Array.isArray(type) && type.includes('Recipe');
}

/** Searches top-level objects, arrays and `@graph` (depth-limited). */
function findRecipeNode(data: Json, depth = 0): JsonObject | null {
  if (depth > 4) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(data)) return null;
  if (isRecipeType(data['@type'])) return data;
  return data['@graph'] !== undefined ? findRecipeNode(data['@graph'], depth + 1) : null;
}

function toJsonLdRecipe(node: JsonObject): JsonLdRecipe | null {
  const title = text(node.name);
  if (!title) return null;
  const total = parseDuration(node.totalTime);
  const prep = parseDuration(node.prepTime);
  const cook = parseDuration(node.cookTime);
  const timeMins = total ?? (prep !== undefined || cook !== undefined ? (prep ?? 0) + (cook ?? 0) : undefined);

  return {
    title,
    serves: parseYield(node.recipeYield),
    timeMins: timeMins && timeMins > 0 ? timeMins : undefined,
    instructions: parseInstructions(node.recipeInstructions),
    ingredientLines: toArray(node.recipeIngredient).map(text).filter((line) => line.length > 0),
    source: personName(node.author) ?? personName(node.publisher),
  };
}

function toArray(value: Json | undefined): Json[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Plain text from a JSON-LD string: tags stripped, entities decoded, whitespace collapsed. */
function text(value: Json | undefined): string {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '';
  return collapse(decodeEntities(value.replace(/<[^>]*>/g, ' ')));
}

/** ISO 8601 duration (`PT45M`, `PT1H20M`, `P0DT2H`) → minutes. */
export function parseDuration(value: Json | undefined): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(
    value.trim()
  );
  if (!match || match.slice(1).every((part) => part === undefined)) return undefined;
  const [, days, hours, minutes, seconds] = match.map((part) => Number(part ?? 0));
  return Math.round(days * 24 * 60 + hours * 60 + minutes + seconds / 60);
}

/** `"4 servings"`, `["4", "4 servings"]` or `6` → the first integer. */
export function parseYield(value: Json | undefined): number | undefined {
  for (const item of toArray(value)) {
    const match = /\d+/.exec(text(item));
    if (match) {
      const serves = Number(match[0]);
      if (serves > 0) return serves;
    }
  }
  return undefined;
}

/** A string, `HowToStep[]`, or `HowToSection[]` with `itemListElement`, as plain steps. */
function parseInstructions(value: Json | undefined): string[] {
  if (typeof value === 'string') {
    return value
      .split(/<\/?(?:p|li|br)\b[^>]*>|\n+/i)
      .map((step) => text(step))
      .filter((step) => step.length > 0);
  }
  const steps: string[] = [];
  for (const item of toArray(value)) {
    if (typeof item === 'string') {
      const step = text(item);
      if (step) steps.push(step);
    } else if (isObject(item)) {
      if (item.itemListElement !== undefined) {
        steps.push(...parseInstructions(item.itemListElement));
      } else {
        const step = text(item.text) || text(item.name);
        if (step) steps.push(step);
      }
    }
  }
  return steps;
}

function personName(value: Json | undefined): string | undefined {
  for (const item of toArray(value)) {
    const name = isObject(item) ? text(item.name) : text(item);
    if (name) return name;
  }
  return undefined;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  deg: '°',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  middot: '·',
  copy: '©',
  times: '×',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return ENTITIES[code.toLowerCase()] ?? entity;
  });
}

/** Collapses whitespace, including the gap a stripped inline tag leaves before punctuation. */
function collapse(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/ ([.,;:!?)])/g, '$1').trim();
}

/** The most page text sent to the model when a page has no JSON-LD recipe. */
export const MAX_PAGE_TEXT_CHARS = 20_000;

const NOISE_BLOCKS = /<(script|style|noscript|svg|nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi;
/** Elements that end a line of text. */
const BLOCK_BREAKS = /<\/?(?:p|div|li|ul|ol|h[1-6]|br|tr|section|article|table)\b[^>]*>/gi;

/**
 * Readable page text for the no-JSON-LD fallback: noise blocks removed, tags
 * stripped, entities decoded, whitespace collapsed (keeping line breaks
 * between blocks), cut to `maxChars`.
 */
export function htmlToText(html: string, maxChars = MAX_PAGE_TEXT_CHARS): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(NOISE_BLOCKS, ' ')
    .replace(BLOCK_BREAKS, '\n')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(stripped)
    .split('\n')
    .map(collapse)
    .filter((line) => line.length > 0)
    .join('\n')
    .slice(0, maxChars);
}
