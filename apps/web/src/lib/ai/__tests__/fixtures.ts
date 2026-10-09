import type { AiRecipe } from '../schemas';

/** A recipe that satisfies the AiRecipe schema. */
export function validAiRecipe(overrides: Partial<AiRecipe> = {}): AiRecipe {
  return {
    title: 'Lemon Chicken Traybake',
    cuisine: 'italian',
    totalTimeMins: 45,
    servings: 4,
    ingredients: [
      { name: 'chicken thigh fillets', qty: 800, unit: 'g', prep: 'cut into 3cm pieces' },
      { name: 'garlic clove', qty: 4, unit: 'unit' },
      { name: 'olive oil', qty: 2, unit: 'tbsp' },
    ],
    instructions: ['Heat the oven to 200°C.', 'Roast everything for 35 minutes.'],
    tags: ['chicken', 'one_pot'],
    nutrition: { calories: 520, protein: 42, carbs: 18, fat: 30 },
    ...overrides,
  };
}
