/**
 * Prompts for matching past Coles order lines to the ingredient catalogue
 * (#185). Only lines the catalogue's own names couldn't match get here, and
 * every suggestion is confirmed by the user before it's remembered.
 */

export interface OrderMatchProduct {
  productId: string;
  /** Brand and name, as Coles shows them. */
  name: string;
  size: string | null;
}

export interface OrderMatchIngredient {
  key: string;
  name: string;
}

export function buildOrderMatchSystemPrompt(): string {
  return `You match an Australian household's past Coles grocery purchases to the ingredients its meal planner knows.

RULES
- For each product, return the key of the ingredient it is, copied exactly from the ingredient list, or null.
- Match what the product is, not what it contains: "Mexican Cheese Blend Grated" is grated cheese, "Tasty Cheese Block" is cheese, but "Cheese & Bacon Rolls" is not cheese.
- Return null for anything that isn't a cooking ingredient (drinks, snacks, toiletries, cleaning, pet food) and when no ingredient fits.
- Only use keys from the list. Never invent one.
- Return one entry per product, using its productId.`;
}

export function buildOrderMatchPrompt(products: OrderMatchProduct[], ingredients: OrderMatchIngredient[]): string {
  const ingredientLines = ingredients.map(({ key, name }) => (name.toLowerCase() === key ? key : `${key} (${name})`)).join('\n');
  const productLines = products.map(({ productId, name, size }) => `${productId}: ${name}${size ? `, ${size}` : ''}`).join('\n');
  return `INGREDIENTS (key, then display name where different)
${ingredientLines}

PRODUCTS (productId: name, size)
${productLines}`;
}
