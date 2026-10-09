/**
 * Prompt rules that match the recipe schema in lib/ai/schemas.ts (#84).
 * Shared by generation, the recipe photo and URL import so the model gets
 * the same unit and naming instructions everywhere.
 */

import { CUISINE_OPTIONS } from '@/lib/types/settings';

export const INGREDIENT_FORMAT_RULES = `INGREDIENT FORMAT (the response schema enforces this):
- "unit" must be one of: g, ml, tsp, tbsp, unit. Convert anything else:
  - cups to ml (1 cup = 250 ml); other volumes to ml, weights to g;
  - countable items use "unit", with the name saying what is counted, e.g. { "name": "garlic clove", "qty": 3, "unit": "unit" } or { "name": "canned diced tomatoes (400g)", "qty": 1, "unit": "unit" }.
- "qty" is a number greater than 0 (use decimals, e.g. 0.5, never fractions like "1/2"). For "to taste" items use a small realistic amount, e.g. 1 tsp salt.
- "name" is short and searchable (e.g. "chicken thigh fillets"); put preparation in "prep" (e.g. "cut into 3cm pieces"), not in the name.`;

export const CUISINE_FORMAT_RULE = `- "cuisine" is one of: ${CUISINE_OPTIONS.map((option) => option.id).join(', ')} (pick the closest).`;
