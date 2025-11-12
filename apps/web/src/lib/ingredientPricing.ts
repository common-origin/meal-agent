/**
 * Ingredient Pricing System
 * Categorizes ingredients and provides accurate price estimates
 */

export type IngredientCategory = 
  | 'protein'
  | 'seafood'
  | 'vegetables'
  | 'dairy'
  | 'pantry'
  | 'herbs'
  | 'spices'
  | 'fruit'
  | 'bakery'
  | 'condiments';

export type PriceConfidence = 'high' | 'medium' | 'low';
export type PriceSource = 'mapped' | 'scraped' | 'user' | 'estimated';

export interface PriceEstimate {
  price: number;
  confidence: PriceConfidence;
  source: PriceSource;
  category?: IngredientCategory;
  lastUpdated?: string;
}

/**
 * Base price rates per category (AUD per kilogram or liter)
 * Based on average Coles prices as of November 2025
 */
const CATEGORY_BASE_RATES: Record<IngredientCategory, { rate: number; unit: 'kg' | 'l' | 'bunch' | 'unit' }> = {
  protein: { rate: 15.00, unit: 'kg' },      // Chicken, beef, pork (avg)
  seafood: { rate: 30.00, unit: 'kg' },      // Fish, prawns, salmon
  vegetables: { rate: 5.00, unit: 'kg' },    // Fresh produce
  dairy: { rate: 8.00, unit: 'kg' },         // Milk, cheese, yogurt
  pantry: { rate: 3.00, unit: 'kg' },        // Rice, pasta, canned goods
  herbs: { rate: 3.50, unit: 'bunch' },      // Fresh herbs (per bunch)
  spices: { rate: 8.00, unit: 'unit' },      // Dried spices (per jar/packet)
  fruit: { rate: 6.00, unit: 'kg' },         // Fresh fruit
  bakery: { rate: 4.00, unit: 'unit' },      // Bread, rolls
  condiments: { rate: 12.00, unit: 'l' },    // Oils, sauces, vinegars
};

/**
 * Categorize an ingredient based on its name
 * Uses keyword matching for common ingredients
 */
export function categorizeIngredient(ingredientName: string): IngredientCategory {
  const normalized = ingredientName.toLowerCase();
  
  // Proteins
  if (/(chicken|beef|pork|lamb|turkey|duck|mince|steak|chop|fillet)/.test(normalized)) {
    return 'protein';
  }
  
  // Seafood
  if (/(fish|salmon|tuna|prawn|shrimp|crab|lobster|mussel|oyster|calamari|barramundi)/.test(normalized)) {
    return 'seafood';
  }
  
  // Dairy
  if (/(milk|cream|cheese|butter|yogurt|yoghurt|sour cream|creme fraiche|mascarpone)/.test(normalized)) {
    return 'dairy';
  }
  
  // Herbs (fresh)
  if (/(basil|parsley|coriander|cilantro|mint|rosemary|thyme|oregano|dill|chives|sage)/.test(normalized) && 
      /(fresh|bunch)/.test(normalized)) {
    return 'herbs';
  }
  
  // Spices (dried)
  if (/(cumin|paprika|turmeric|cinnamon|nutmeg|cardamom|curry|garam|powder|dried|ground)/.test(normalized)) {
    return 'spices';
  }
  
  // Vegetables
  if (/(onion|garlic|tomato|potato|carrot|capsicum|pepper|broccoli|cauliflower|zucchini|eggplant|lettuce|spinach|kale|cabbage|celery|cucumber|mushroom|pumpkin|squash|beetroot|bean|pea)/.test(normalized)) {
    return 'vegetables';
  }
  
  // Fruit
  if (/(apple|banana|orange|lemon|lime|grape|berry|strawberry|blueberry|mango|pineapple|melon|peach|pear|plum|cherry|kiwi|avocado)/.test(normalized)) {
    return 'fruit';
  }
  
  // Bakery
  if (/(bread|roll|bun|pita|tortilla|wrap|baguette|loaf)/.test(normalized)) {
    return 'bakery';
  }
  
  // Condiments
  if (/(oil|vinegar|sauce|paste|mayo|mustard|ketchup|relish|dressing)/.test(normalized)) {
    return 'condiments';
  }
  
  // Default to pantry for anything else (rice, pasta, canned goods, etc.)
  return 'pantry';
}

/**
 * Convert units to kilograms for standardized pricing
 * Handles common cooking units
 */
function convertToKg(quantity: number, unit: string): number {
  const normalized = unit.toLowerCase();
  
  // Already in kg
  if (/kg|kilogram/.test(normalized)) {
    return quantity;
  }
  
  // Grams to kg
  if (/^g$|gram/.test(normalized)) {
    return quantity / 1000;
  }
  
  // Liters/ml (assume 1L = 1kg for liquids)
  if (/l|liter|litre/.test(normalized)) {
    return quantity;
  }
  if (/ml|milliliter|millilitre/.test(normalized)) {
    return quantity / 1000;
  }
  
  // Tablespoons (approx 15ml)
  if (/tbsp|tablespoon/.test(normalized)) {
    return (quantity * 15) / 1000;
  }
  
  // Teaspoons (approx 5ml)
  if (/tsp|teaspoon/.test(normalized)) {
    return (quantity * 5) / 1000;
  }
  
  // Cups (approx 250ml)
  if (/cup/.test(normalized)) {
    return (quantity * 250) / 1000;
  }
  
  // Units (treat as 100g average for items like onions, tomatoes)
  if (/unit|whole|piece/.test(normalized) || normalized === '') {
    return quantity * 0.1; // 100g per unit
  }
  
  // Bunches (for herbs, typically 25-50g)
  if (/bunch/.test(normalized)) {
    return quantity * 0.035; // 35g per bunch
  }
  
  // Default fallback: assume small quantity
  return quantity * 0.05; // 50g default
}

/**
 * Estimate ingredient cost using category-based pricing
 * Much more accurate than the old formula
 */
export function estimateIngredientCostByCategory(
  ingredientName: string,
  quantity: number,
  unit: string
): PriceEstimate {
  const category = categorizeIngredient(ingredientName);
  const baseRate = CATEGORY_BASE_RATES[category];
  
  let estimatedPrice = 0;
  
  // Handle special cases based on unit type
  if (baseRate.unit === 'bunch' && /bunch/.test(unit.toLowerCase())) {
    // Direct bunch pricing (e.g., fresh herbs)
    estimatedPrice = baseRate.rate * quantity;
  } else if (baseRate.unit === 'unit' && (/unit|whole|piece/.test(unit.toLowerCase()) || unit === '')) {
    // Per-unit pricing (e.g., bread, spice jars)
    estimatedPrice = baseRate.rate * quantity;
  } else {
    // Weight/volume based pricing
    const kgEquivalent = convertToKg(quantity, unit);
    estimatedPrice = baseRate.rate * kgEquivalent;
  }
  
  // Round to 2 decimal places
  estimatedPrice = Math.round(estimatedPrice * 100) / 100;
  
  // Minimum price of $0.10 (for very small quantities like spices)
  estimatedPrice = Math.max(0.10, estimatedPrice);
  
  return {
    price: estimatedPrice,
    confidence: 'low', // Category-based is still an estimate
    source: 'estimated',
    category,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get price estimate with fallback chain
 * Priority: mapped > scraped > user-reported > category-estimated
 */
export async function getIngredientPrice(
  ingredientName: string,
  quantity: number,
  unit: string,
  mappedPrice?: { price: number; lastUpdated: string },
  scrapedPrice?: { price: number; lastUpdated: string },
  userReportedPrice?: { avgPrice: number; reportCount: number; lastUpdated: string }
): Promise<PriceEstimate> {
  // 1. Check manual mappings (highest confidence if recent)
  if (mappedPrice && !isStale(mappedPrice.lastUpdated, 30)) {
    return {
      price: mappedPrice.price,
      confidence: 'high',
      source: 'mapped',
      lastUpdated: mappedPrice.lastUpdated,
    };
  }
  
  // 2. Check scraped prices (high confidence if within 7 days)
  if (scrapedPrice && !isStale(scrapedPrice.lastUpdated, 7)) {
    return {
      price: scrapedPrice.price,
      confidence: 'high',
      source: 'scraped',
      lastUpdated: scrapedPrice.lastUpdated,
    };
  }
  
  // 3. Check user-reported prices (medium confidence if 3+ reports within 14 days)
  if (userReportedPrice && 
      userReportedPrice.reportCount >= 3 && 
      !isStale(userReportedPrice.lastUpdated, 14)) {
    return {
      price: userReportedPrice.avgPrice,
      confidence: 'medium',
      source: 'user',
      lastUpdated: userReportedPrice.lastUpdated,
    };
  }
  
  // 4. Fall back to category-based estimation (low confidence)
  return estimateIngredientCostByCategory(ingredientName, quantity, unit);
}

/**
 * Check if a price is stale based on days since last update
 */
function isStale(lastUpdated: string, maxDays: number): boolean {
  const updated = new Date(lastUpdated);
  const now = new Date();
  const daysDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > maxDays;
}

/**
 * Calculate confidence score as a percentage
 * Used for UI display
 */
export function getConfidenceScore(estimate: PriceEstimate): number {
  switch (estimate.confidence) {
    case 'high': return 90;
    case 'medium': return 60;
    case 'low': return 30;
  }
}

/**
 * Get human-readable description of price source
 */
export function getPriceSourceDescription(source: PriceSource): string {
  switch (source) {
    case 'mapped': return 'Verified product price';
    case 'scraped': return 'Recent Coles price';
    case 'user': return 'Community reported';
    case 'estimated': return 'Estimated price';
  }
}
