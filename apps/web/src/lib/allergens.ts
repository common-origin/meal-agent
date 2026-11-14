/**
 * Checks a generated recipe against the household's allergies. The prompt
 * already says "MUST AVOID", but nothing enforced it: this is the check on
 * the model's answer.
 *
 * It errs towards flagging: a false alarm costs one regeneration, a miss
 * puts an allergen on the table. Each allergy the household types is matched
 * against every ingredient's name and prep. Common allergens expand to the
 * ingredients that contain them ("shellfish" → prawns, crab, oyster sauce);
 * anything else is matched as typed, singular or plural.
 */

import type { Recipe } from './types/recipe';

interface AllergenGroup {
  /** What a household might type for this allergy, lower case. */
  aliases: string[];
  /** Ingredient words that contain the allergen. Plurals are matched too. */
  terms: string[];
  /** Phrases that contain a term but are safe ("coconut milk" for dairy). */
  safe?: string[];
}

const PEANUT_TERMS = ['peanut', 'groundnut', 'satay', 'monkey nut'];
const TREE_NUT_TERMS = [
  'nut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia',
  'pine nut', 'brazil nut', 'praline', 'marzipan', 'frangipane', 'pesto', 'nutella', 'dukkah',
];
const FISH_TERMS = [
  'fish', 'salmon', 'tuna', 'cod', 'barramundi', 'snapper', 'trout', 'mackerel', 'sardine',
  'anchovy', 'anchovies', 'whiting', 'flathead', 'hake', 'haddock', 'basa', 'ling', 'bream',
  'kingfish', 'swordfish', 'halibut', 'tilapia', 'worcestershire',
];
const SHELLFISH_TERMS = [
  'shellfish', 'prawn', 'shrimp', 'crab', 'lobster', 'crayfish', 'yabby', 'yabbies', 'scallop',
  'mussel', 'oyster', 'clam', 'cockle', 'squid', 'calamari', 'octopus', 'cuttlefish',
  'langoustine', 'scampi', 'xo sauce',
];

const GROUPS: AllergenGroup[] = [
  { aliases: ['peanut', 'peanuts', 'groundnut', 'groundnuts'], terms: PEANUT_TERMS },
  // "Nuts" on its own is taken to include peanuts, since that's usually what's meant.
  { aliases: ['nut', 'nuts'], terms: [...TREE_NUT_TERMS, ...PEANUT_TERMS] },
  { aliases: ['tree nut', 'tree nuts'], terms: TREE_NUT_TERMS },
  { aliases: ['fish'], terms: FISH_TERMS },
  { aliases: ['shellfish', 'crustacean', 'crustaceans', 'molluscs', 'mollusks'], terms: SHELLFISH_TERMS },
  { aliases: ['seafood'], terms: [...FISH_TERMS, ...SHELLFISH_TERMS] },
  {
    aliases: ['egg', 'eggs'],
    terms: ['egg', 'mayonnaise', 'mayo', 'aioli', 'meringue', 'custard', 'hollandaise', 'frittata', 'omelette'],
  },
  {
    aliases: ['dairy', 'milk', 'lactose', 'cow milk', "cow's milk"],
    terms: [
      'milk', 'cheese', 'butter', 'cream', 'yoghurt', 'yogurt', 'ghee', 'parmesan', 'cheddar',
      'mozzarella', 'feta', 'ricotta', 'mascarpone', 'halloumi', 'haloumi', 'paneer', 'buttermilk',
      'creme fraiche', 'crème fraîche', 'whey', 'labneh', 'bocconcini', 'burrata', 'gruyere',
      'pecorino', 'brie', 'camembert', 'kefir', 'custard', 'bechamel', 'béchamel',
    ],
    safe: [
      'coconut milk', 'coconut cream', 'almond milk', 'oat milk', 'soy milk', 'rice milk',
      'peanut butter', 'nut butter', 'almond butter', 'cashew butter', 'cocoa butter',
      'butter bean', 'cream of tartar',
    ],
  },
  { aliases: ['sesame', 'sesame seed', 'sesame seeds'], terms: ['sesame', 'tahini', 'halva', 'gomasio', "za'atar", 'zaatar', 'dukkah'] },
  { aliases: ['soy', 'soya', 'soybean', 'soybeans'], terms: ['soy', 'soya', 'tofu', 'edamame', 'miso', 'tamari', 'tempeh'] },
  {
    aliases: ['gluten', 'wheat', 'coeliac', 'celiac'],
    terms: [
      'wheat', 'flour', 'bread', 'breadcrumb', 'panko', 'pasta', 'spaghetti', 'linguine', 'fettuccine',
      'penne', 'rigatoni', 'lasagne', 'lasagna', 'macaroni', 'orzo', 'gnocchi', 'noodle', 'udon',
      'ramen', 'couscous', 'barley', 'rye', 'semolina', 'bulgur', 'burghul', 'freekeh', 'spelt',
      'farro', 'tortilla', 'pita', 'naan', 'pastry', 'filo', 'phyllo', 'soy sauce',
      'seitan', 'beer', 'crouton', 'cracker',
    ],
    safe: [
      'rice flour', 'corn flour', 'almond flour', 'coconut flour', 'chickpea flour', 'buckwheat flour',
      'rice noodle', 'rice vermicelli', 'glass noodle', 'rice paper', 'corn tortilla',
    ],
  },
];

/** Lower case, with typographic apostrophes and runs of space tidied. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `term` as a whole word or phrase, optionally plural: "nut" matches "nuts", not "nutmeg" or "coconut". */
function termPattern(term: string, flags = ''): RegExp {
  return new RegExp(`(^|[^a-zà-ÿ])${escapeRegExp(term)}(s|es)?(?![a-zà-ÿ])`, flags);
}

/** The group a typed allergy names, or one built from the allergy as typed. */
function groupFor(allergy: string): AllergenGroup {
  const known = GROUPS.find((group) => group.aliases.includes(allergy));
  if (known) return known;
  // "Kiwi fruit" or "mustard": match the words themselves, and a typed plural's singular.
  const singular = allergy.replace(/(es|s)$/, '');
  return { aliases: [allergy], terms: singular.length > 2 && singular !== allergy ? [allergy, singular] : [allergy] };
}

export interface AllergenConflict {
  /** The allergy as the household typed it. */
  allergy: string;
  /** The ingredient that contains it, as the recipe names it. */
  ingredient: string;
}

/**
 * Every ingredient in `recipe` that contains one of `allergies`. Empty when
 * the recipe is safe (or the household has no allergies).
 */
export function findAllergenConflicts(recipe: Pick<Recipe, 'ingredients'>, allergies: string[]): AllergenConflict[] {
  const conflicts: AllergenConflict[] = [];
  for (const typed of allergies) {
    const allergy = normalise(typed);
    if (!allergy) continue;
    const group = groupFor(allergy);
    const patterns = group.terms.map((term) => termPattern(term));
    // "Gluten-free soy sauce", "dairy free cheese": labelled as safe for this allergy.
    const labelledSafe = group.aliases.map((alias) => termPattern(`${alias}-free`)).concat(
      group.aliases.map((alias) => termPattern(`${alias} free`))
    );

    for (const ingredient of recipe.ingredients) {
      let text = normalise(`${ingredient.name} ${ingredient.prep ?? ''}`);
      if (labelledSafe.some((pattern) => pattern.test(text))) continue;
      for (const phrase of group.safe ?? []) text = text.replace(termPattern(phrase, 'g'), '$1');
      if (patterns.some((pattern) => pattern.test(text))) {
        conflicts.push({ allergy: typed.trim(), ingredient: ingredient.name });
      }
    }
  }
  return conflicts;
}
