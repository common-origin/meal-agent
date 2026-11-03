/**
 * Ingredient quantities (#183): converts recipe quantities into one measure
 * per ingredient, works out how many packs to buy, and formats both for the
 * shopping list.
 */

import type { CatalogueEntry, Measure } from './catalogue';
import { resolveIngredient } from './resolve';

/** Base amounts per unit that hold for any ingredient of that measure. */
const GENERIC_UNITS: Record<Measure, Record<string, number>> = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 },
  count: { '': 1 },
};

const UNIT_SYNONYMS: Record<string, string> = {
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg',
  millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  teaspoon: 'tsp', teaspoons: 'tsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbsps: 'tbsp',
  cups: 'cup', cloves: 'clove', bunches: 'bunch', bulbs: 'bulb', heads: 'head', stalks: 'stalk',
  sprigs: 'sprig', handfuls: 'handful', fillets: 'fillet', pieces: 'piece', slices: 'slice',
  cans: 'can', tin: 'can', tins: 'can',
  unit: '', units: '', whole: '', each: '', x: '', small: '', medium: '', large: '',
};

/** Units that mean "one of these" when the ingredient doesn't define them itself. */
const ITEM_UNITS = new Set(['piece', 'fillet', 'slice']);

/**
 * Canonical unit for a recipe unit string, plus how many of it one recipe unit
 * holds: "x 400g tins" is 400 g per tin.
 */
export function parseUnit(raw: string | undefined): { unit: string; multiplier: number } {
  const text = (raw ?? '').toLowerCase().replace(/\./g, '').trim();
  const sized = text.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (sized) return { unit: sized[2], multiplier: parseFloat(sized[1]) };
  return { unit: UNIT_SYNONYMS[text] ?? text, multiplier: 1 };
}

function measureOfUnit(unit: string): Measure | undefined {
  return (Object.keys(GENERIC_UNITS) as Measure[]).find(measure => unit in GENERIC_UNITS[measure]);
}

export interface BaseQuantity {
  measure: Measure;
  /** In g, ml or items. */
  amount: number;
}

/**
 * Convert a recipe quantity into the ingredient's measure, or null when it
 * can't be (e.g. "1 sprig" of something with no sprig conversion). Without a
 * catalogue entry, the measure follows the unit.
 */
export function toBaseQuantity(entry: CatalogueEntry | undefined, qty: number, rawUnit: string | undefined): BaseQuantity | null {
  if (!Number.isFinite(qty)) return null;
  const { unit, multiplier } = parseUnit(rawUnit);
  const measure = entry?.measure ?? measureOfUnit(ITEM_UNITS.has(unit) ? '' : unit);
  if (!measure) return null;

  const factorFor = (u: string) => entry?.units?.[u] ?? GENERIC_UNITS[measure][u];
  const factor = factorFor(unit) ?? (ITEM_UNITS.has(unit) ? factorFor('') : undefined);
  if (factor === undefined) return null;
  return { measure, amount: qty * multiplier * factor };
}

function formatNumber(value: number): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

function plural(noun: string): string {
  return /(?:ch|sh|s|x)$/.test(noun) ? `${noun}es` : `${noun}s`;
}

/** "1.2 kg", "250 ml", "6 cloves", "3". */
export function formatBaseQuantity(measure: Measure, amount: number, countNoun?: string): string {
  if (measure === 'mass') return amount >= 1000 ? `${formatNumber(amount / 1000)} kg` : `${formatNumber(amount)} g`;
  if (measure === 'volume') return amount >= 1000 ? `${formatNumber(amount / 1000)} L` : `${formatNumber(amount)} ml`;
  if (!countNoun) return formatNumber(amount);
  return `${formatNumber(amount)} ${amount === 1 ? countNoun : plural(countNoun)}`;
}

/** Display quantity and unit, with mass and volume scaled to kg and L. */
export function displayQuantity(measure: Measure, amount: number, countNoun?: string): { qty: number; unit: string } {
  if (measure === 'mass') return amount >= 1000 ? { qty: amount / 1000, unit: 'kg' } : { qty: amount, unit: 'g' };
  if (measure === 'volume') return amount >= 1000 ? { qty: amount / 1000, unit: 'L' } : { qty: amount, unit: 'ml' };
  return { qty: amount, unit: countNoun ?? '' };
}

/**
 * How many to buy, rounded up to whole packs: "1 bulb", "2 × 400 g cans".
 * Plain items ("1.5 onions") round up to whole items. Null when the
 * ingredient is just bought by weight or volume.
 */
export function buyQuantity(entry: CatalogueEntry | undefined, measure: Measure, amount: number): { qty: number; label: string } | null {
  const buy = entry?.buy ?? (measure === 'count' && !entry?.countNoun ? { size: 1, one: '', many: '' } : undefined);
  if (!buy || amount <= 0) return null;
  // Tolerance so 2.0000001 packs from float maths doesn't round up to 3.
  const qty = Math.max(1, Math.ceil(amount / buy.size - 1e-6));
  const noun = qty === 1 ? buy.one : buy.many;
  return { qty, label: noun ? `${qty} ${noun}` : String(qty) };
}

/**
 * The quantity to price with `estimateIngredientCost`, in a unit the Coles
 * pack sizes understand: grams or ml, or grams for counted items with a
 * known weight (6 garlic cloves → 30 g).
 */
export function pricingQuantity(entry: CatalogueEntry | undefined, measure: Measure, amount: number): { qty: number; unit: string } {
  if (measure === 'mass') return { qty: amount, unit: 'g' };
  if (measure === 'volume') return { qty: amount, unit: 'ml' };
  const itemsPerGram = entry?.units?.g;
  return itemsPerGram ? { qty: amount / itemsPerGram, unit: 'g' } : { qty: amount, unit: 'unit' };
}

/**
 * Canonical key and priceable quantity for one recipe ingredient, as used by
 * recipe costing. Falls back to the recipe's own quantity and unit when it
 * can't be converted.
 */
export function pricingForIngredient(name: string, qty: number, unit: string): { key: string; qty: number; unit: string } {
  const resolved = resolveIngredient(name);
  const key = resolved?.key ?? '';
  const base = toBaseQuantity(resolved?.entry, qty, unit);
  if (!base) return { key, qty, unit };
  return { key, ...pricingQuantity(resolved?.entry, base.measure, base.amount) };
}
