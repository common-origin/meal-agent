/**
 * Canonical ingredient catalogue (#183).
 *
 * One entry per thing you'd actually buy. Keys match `normalizedName` in
 * `COLES_INGREDIENT_MAPPINGS` wherever a Coles mapping exists, so a resolved
 * key prices directly. Every mapped Coles ingredient gets a basic entry
 * automatically; the hand-written entries below add aliases, recipe-unit
 * conversions and buy units for the ingredients that need them.
 */

import { COLES_INGREDIENT_MAPPINGS } from '../colesMapping';

/** What an ingredient's quantities are counted in: grams, millilitres, or items. */
export type Measure = 'mass' | 'volume' | 'count';

export interface CatalogueEntry {
  key: string;
  /** Display name on the shopping list. */
  name: string;
  /** Generated from a Coles mapping key: its name is the bare key, so the recipe's own wording reads better. */
  generated?: boolean;
  /** Other names that mean this ingredient: lowercase, singular, no prep words. */
  aliases?: string[];
  /** Shopping-list category; derived from the name when omitted. */
  category?: string;
  measure: Measure;
  /** For count entries: what one item is called ("clove", "bunch"). Omitted for plain items ("2 limes"). */
  countNoun?: string;
  /**
   * Recipe units this ingredient converts from, as base amounts per unit
   * (g for mass, ml for volume, items for count). Overrides the generic
   * mass/volume conversions. '' is a bare number ("2 onions").
   */
  units?: Record<string, number>;
  /** How it's sold, when that isn't just its measure: one pack holds `size` base amounts. */
  buy?: { size: number; one: string; many: string };
}

const HAND_WRITTEN: CatalogueEntry[] = [
  // Produce
  {
    key: 'garlic', name: 'Garlic', aliases: ['garlic clove', 'garlic bulb', 'garlic head'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'clove',
    units: { '': 1, clove: 1, bulb: 10, head: 10, tsp: 1, tbsp: 3, g: 0.2 },
    buy: { size: 10, one: 'bulb', many: 'bulbs' },
  },
  {
    key: 'onion', name: 'Brown onion', aliases: ['brown onion', 'yellow onion', 'white onion'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 150, cup: 1 },
  },
  {
    key: 'red onion', name: 'Red onion', aliases: ['purple onion', 'spanish onion'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 150, cup: 1 },
  },
  {
    key: 'spring onion', name: 'Spring onions', aliases: ['green onion', 'scallion'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'stalk',
    units: { '': 1, stalk: 1, bunch: 6, cup: 6, g: 1 / 15 },
    buy: { size: 6, one: 'bunch', many: 'bunches' },
  },
  {
    key: 'tomato', name: 'Tomatoes', aliases: ['roma tomato', 'truss tomato'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 125 },
  },
  {
    key: 'potato', name: 'Potatoes', category: 'Fresh Produce', measure: 'count',
    units: { '': 1, g: 1 / 200 },
  },
  {
    key: 'carrot', name: 'Carrots', category: 'Fresh Produce', measure: 'count',
    units: { '': 1, g: 1 / 100, cup: 1 },
  },
  {
    key: 'capsicum', name: 'Capsicum', aliases: ['red capsicum', 'green capsicum', 'yellow capsicum', 'bell pepper', 'red bell pepper'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 150 },
  },
  {
    key: 'zucchini', name: 'Zucchini', aliases: ['courgette'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 200 },
  },
  {
    key: 'avocado', name: 'Avocados', category: 'Fresh Produce', measure: 'count',
    units: { '': 1, g: 1 / 180 },
  },
  {
    key: 'lime', name: 'Limes', aliases: ['lime juice', 'juice of lime', 'lime zest', 'zest of lime'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 50, tbsp: 0.5, ml: 1 / 30 },
  },
  {
    key: 'lemon', name: 'Lemons', aliases: ['lemon juice', 'juice of lemon', 'lemon zest', 'zest of lemon'],
    category: 'Fresh Produce', measure: 'count', units: { '': 1, g: 1 / 100, tbsp: 1 / 3, ml: 1 / 45 },
  },
  {
    key: 'coriander', name: 'Coriander', aliases: ['coriander leaf', 'cilantro', 'coriander sprig'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'bunch',
    units: { '': 1, bunch: 1, cup: 1, handful: 0.5, tbsp: 1 / 16, g: 1 / 35, sprig: 0.05 },
    buy: { size: 1, one: 'bunch', many: 'bunches' },
  },
  {
    key: 'parsley', name: 'Parsley', aliases: ['flat leaf parsley', 'italian parsley', 'curly parsley'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'bunch',
    units: { '': 1, bunch: 1, cup: 1, handful: 0.5, tbsp: 1 / 16, g: 1 / 35, sprig: 0.05 },
    buy: { size: 1, one: 'bunch', many: 'bunches' },
  },
  {
    key: 'basil', name: 'Basil', aliases: ['basil leaf', 'thai basil'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'bunch',
    units: { '': 1, bunch: 1, cup: 1, handful: 0.5, tbsp: 1 / 16, g: 1 / 35, sprig: 0.05 },
    buy: { size: 1, one: 'bunch', many: 'bunches' },
  },
  {
    key: 'mint', name: 'Mint', aliases: ['mint leaf'],
    category: 'Fresh Produce', measure: 'count', countNoun: 'bunch',
    units: { '': 1, bunch: 1, cup: 1, handful: 0.5, tbsp: 1 / 16, g: 1 / 35, sprig: 0.05 },
    buy: { size: 1, one: 'bunch', many: 'bunches' },
  },
  {
    key: 'ginger', name: 'Ginger', category: 'Fresh Produce', measure: 'mass',
    units: { cm: 5, tsp: 5, tbsp: 15, '': 30 },
  },
  // Kept apart from the fresh herbs they'd otherwise strip down to.
  { key: 'ground coriander', name: 'Ground coriander', category: 'Pantry', measure: 'mass', units: { tsp: 2, tbsp: 6 } },
  { key: 'ground ginger', name: 'Ground ginger', category: 'Pantry', measure: 'mass', units: { tsp: 2, tbsp: 6 } },
  { key: 'dried basil', name: 'Dried basil', category: 'Pantry', measure: 'mass', units: { tsp: 1, tbsp: 3 } },
  { key: 'dried parsley', name: 'Dried parsley', category: 'Pantry', measure: 'mass', units: { tsp: 1, tbsp: 3 } },

  // Meat
  {
    key: 'chicken thigh', name: 'Chicken thigh fillets', aliases: ['chicken thigh fillet', 'boneless chicken thigh'],
    category: 'Meat & Seafood', measure: 'mass', units: { '': 150, fillet: 150, piece: 150 },
  },
  {
    key: 'chicken breast', name: 'Chicken breast fillets', aliases: ['chicken breast fillet'],
    category: 'Meat & Seafood', measure: 'mass', units: { '': 250, fillet: 250, piece: 250 },
  },
  {
    key: 'beef mince', name: 'Beef mince', aliases: ['minced beef', 'ground beef', 'lean beef mince'],
    category: 'Meat & Seafood', measure: 'mass',
  },

  // Dairy & eggs
  {
    key: 'parmesan', name: 'Parmesan', aliases: ['parmesan cheese', 'parmigiano reggiano'],
    category: 'Dairy & Eggs', measure: 'mass', units: { cup: 100, tbsp: 6 },
  },
  {
    key: 'cheese', name: 'Tasty cheese', aliases: ['cheddar', 'cheddar cheese', 'tasty cheese'],
    category: 'Dairy & Eggs', measure: 'mass', units: { cup: 100, tbsp: 6 },
  },
  {
    key: 'butter', name: 'Butter', category: 'Dairy & Eggs', measure: 'mass',
    units: { tbsp: 14, tsp: 5, cup: 225 },
  },
  {
    key: 'egg', name: 'Eggs', category: 'Dairy & Eggs', measure: 'count',
    units: { '': 1 }, buy: { size: 12, one: 'dozen', many: 'dozen' },
  },

  // Pantry
  {
    key: 'canned tomato', name: 'Tinned tomatoes',
    aliases: ['tinned tomato', 'diced tomato', 'chopped tomato', 'crushed tomato', 'canned diced tomato', 'tinned diced tomato', 'canned chopped tomato', 'tinned chopped tomato', 'canned crushed tomato'],
    category: 'Canned & Packaged', measure: 'mass', units: { '': 400, can: 400, cup: 250, ml: 1 },
    buy: { size: 400, one: '× 400 g can', many: '× 400 g cans' },
  },
  {
    key: 'coconut milk', name: 'Coconut milk', aliases: ['light coconut milk'],
    category: 'Canned & Packaged', measure: 'volume', units: { '': 400, can: 400 },
    buy: { size: 400, one: '× 400 ml can', many: '× 400 ml cans' },
  },
  {
    key: 'chickpea', name: 'Chickpeas', aliases: ['canned chickpea', 'tinned chickpea'],
    category: 'Canned & Packaged', measure: 'mass', units: { '': 400, can: 400, cup: 160 },
    buy: { size: 400, one: '× 400 g can', many: '× 400 g cans' },
  },
  { key: 'rice', name: 'Rice', aliases: ['white rice', 'long grain rice'], category: 'Pantry', measure: 'mass', units: { cup: 200 } },
  { key: 'flour', name: 'Plain flour', aliases: ['all purpose flour'], category: 'Pantry', measure: 'mass', units: { cup: 150, tbsp: 9, tsp: 3 } },
  { key: 'sugar', name: 'Sugar', aliases: ['white sugar', 'caster sugar'], category: 'Pantry', measure: 'mass', units: { cup: 220, tbsp: 12, tsp: 4 } },
  { key: 'soy sauce', name: 'Soy sauce', aliases: ['light soy sauce', 'dark soy sauce', 'tamari'], category: 'Pantry', measure: 'volume' },
  { key: 'olive oil', name: 'Olive oil', aliases: ['extra virgin olive oil'], category: 'Pantry', measure: 'volume' },
];

function titleCase(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function measureForPackUnit(packUnit: string): Measure {
  const unit = packUnit.toLowerCase();
  if (unit === 'ml' || unit === 'l') return 'volume';
  if (unit === 'unit') return 'count';
  return 'mass';
}

/** Basic entries for every Coles-mapped ingredient without a hand-written one. */
function entriesFromColesMappings(handWrittenKeys: Set<string>): CatalogueEntry[] {
  return COLES_INGREDIENT_MAPPINGS
    .filter(mapping => !handWrittenKeys.has(mapping.normalizedName))
    .map(mapping => ({
      key: mapping.normalizedName,
      name: titleCase(mapping.normalizedName),
      generated: true,
      measure: measureForPackUnit(mapping.colesProducts[0]?.packUnit ?? 'g'),
    }));
}

export const INGREDIENT_CATALOGUE: CatalogueEntry[] = [
  ...HAND_WRITTEN,
  ...entriesFromColesMappings(new Set(HAND_WRITTEN.map(entry => entry.key))),
];

const BY_KEY = new Map(INGREDIENT_CATALOGUE.map(entry => [entry.key, entry]));

export function getCatalogueEntry(key: string): CatalogueEntry | undefined {
  return BY_KEY.get(key);
}

/**
 * Every key and alias, mapped to its entry, with hyphens as spaces to match
 * resolved names ("sun-dried tomato" → "sun dried tomato"). Keys win over
 * another entry's alias.
 */
export const CATALOGUE_NAME_INDEX: ReadonlyMap<string, CatalogueEntry> = (() => {
  const index = new Map<string, CatalogueEntry>();
  const nameOf = (text: string) => text.replace(/-/g, ' ');
  for (const entry of INGREDIENT_CATALOGUE) {
    for (const alias of entry.aliases ?? []) {
      if (!index.has(nameOf(alias))) index.set(nameOf(alias), entry);
    }
  }
  for (const entry of INGREDIENT_CATALOGUE) index.set(nameOf(entry.key), entry);
  return index;
})();
