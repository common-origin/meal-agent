/**
 * Ingredient name resolution (#183): maps a recipe's ingredient text to one
 * canonical key, so the shopping list, recipe costs and analytics all agree on
 * what counts as the same ingredient.
 */

import { CATALOGUE_NAME_INDEX, type CatalogueEntry } from './catalogue';

export interface ResolvedIngredient {
  /** Catalogue key, or the cleaned singular name when the catalogue has no match. */
  key: string;
  displayName: string;
  entry?: CatalogueEntry;
}

/** Prep and quality words that don't change what you buy. Matched as whole words at either end. */
const DESCRIPTORS = [
  'fresh', 'dried', 'ground', 'finely', 'roughly', 'coarsely', 'thinly', 'chopped', 'sliced',
  'diced', 'minced', 'grated', 'crushed', 'shredded', 'torn', 'picked', 'peeled',
  'halved', 'quartered', 'cubed', 'trimmed', 'deseeded', 'julienned', 'mashed', 'softened', 'melted',
  'raw', 'cooked', 'ripe', 'large', 'medium', 'small', 'whole', 'mild', 'organic', 'free range',
  'boneless', 'skinless', 'lean', 'plain', 'greek', 'full cream', 'low fat', 'reduced fat',
  'extra virgin', 'unsalted', 'salted', 'canned', 'tinned', 'frozen',
];
// Longest first, so "free range" is tried before shorter overlaps.
const DESCRIPTOR_PATTERN = DESCRIPTORS.slice().sort((a, b) => b.length - a.length).join('|');
const LEADING_DESCRIPTOR = new RegExp(`^(?:${DESCRIPTOR_PATTERN})\\s+`);
const TRAILING_DESCRIPTOR = new RegExp(`\\s+(?:${DESCRIPTOR_PATTERN})$`);

/** Lowercase, and drop notes, alternatives and anything after a comma. */
function clean(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/,.*$/, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|ml|l)\b/g, ' ')
    .replace(/\s+(?:and\/)?or\s+.*$/, '')
    .replace(/[^a-z\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip every leading and trailing descriptor, not just the first. */
function stripDescriptors(name: string): string {
  let current = name;
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = current.replace(LEADING_DESCRIPTOR, '').replace(TRAILING_DESCRIPTOR, '').trim();
  }
  return current;
}

/** Plurals the suffix rules below get wrong. */
const IRREGULAR_PLURALS: Record<string, string> = { leaves: 'leaf', halves: 'half', loaves: 'loaf' };

/** Singularise the last word ("garlic cloves" → "garlic clove", "tomatoes" → "tomato"). */
export function singularise(name: string): string {
  return name.replace(/(\S+)$/, word => {
    if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word];
    if (/(?:ss|us|is)$/.test(word) || word.length <= 3) return word;
    if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
    if (/(?:oes|ches|shes|xes)$/.test(word)) return word.slice(0, -2);
    if (word.endsWith('s')) return word.slice(0, -1);
    return word;
  });
}

function lookup(name: string): CatalogueEntry | undefined {
  return CATALOGUE_NAME_INDEX.get(name) ?? CATALOGUE_NAME_INDEX.get(singularise(name));
}

function capitalise(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Resolve a recipe ingredient name to its canonical ingredient. Aliases are
 * matched before descriptors are stripped, so "diced tomatoes" finds tinned
 * tomatoes rather than collapsing to fresh "tomato".
 */
export function resolveIngredient(rawName: string): ResolvedIngredient | null {
  if (!rawName || typeof rawName !== 'string') return null;
  const cleaned = clean(rawName);
  if (!cleaned) return null;

  const stripped = stripDescriptors(cleaned) || cleaned;
  const entry = lookup(cleaned) ?? lookup(stripped);
  if (entry) return { key: entry.key, displayName: entry.generated ? capitalise(stripped) : entry.name, entry };

  return { key: singularise(stripped), displayName: capitalise(stripped) };
}

/** The canonical key for an ingredient name, or '' when there's nothing to resolve. */
export function ingredientKey(rawName: string): string {
  return resolveIngredient(rawName)?.key ?? '';
}
