/**
 * Seasonal Ingredient Awareness
 * Provides seasonal scoring for recipes based on hemisphere and current month
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Hemisphere = 'northern' | 'southern';

/**
 * Seasonal ingredient categories with their peak months (Northern Hemisphere)
 */
const SEASONAL_INGREDIENTS: Record<string, number[]> = {
  // Spring (March, April, May = months 2, 3, 4)
  'asparagus': [2, 3, 4],
  'artichoke': [2, 3, 4],
  'peas': [2, 3, 4],
  'spring onion': [2, 3, 4],
  'radish': [2, 3, 4],
  'spinach': [2, 3, 4],
  'lettuce': [2, 3, 4, 5],
  'strawberry': [3, 4, 5],
  'rhubarb': [2, 3, 4],
  
  // Summer (June, July, August = months 5, 6, 7)
  'tomato': [5, 6, 7, 8],
  'cucumber': [5, 6, 7],
  'zucchini': [5, 6, 7],
  'courgette': [5, 6, 7],
  'eggplant': [5, 6, 7],
  'aubergine': [5, 6, 7],
  'capsicum': [5, 6, 7],
  'bell pepper': [5, 6, 7],
  'corn': [6, 7, 8],
  'stone fruit': [5, 6, 7],
  'peach': [5, 6, 7],
  'nectarine': [5, 6, 7],
  'plum': [6, 7, 8],
  'cherry': [5, 6],
  'berry': [5, 6, 7],
  'raspberry': [5, 6, 7],
  'blueberry': [5, 6, 7],
  'blackberry': [6, 7, 8],
  'watermelon': [6, 7, 8],
  'basil': [5, 6, 7, 8],
  
  // Autumn (September, October, November = months 8, 9, 10)
  'pumpkin': [8, 9, 10],
  'squash': [8, 9, 10],
  'butternut': [8, 9, 10],
  'beetroot': [8, 9, 10],
  'carrot': [8, 9, 10, 11],
  'parsnip': [8, 9, 10],
  'sweet potato': [8, 9, 10],
  'brussels sprout': [9, 10, 11],
  'apple': [8, 9, 10],
  'pear': [8, 9, 10],
  'grape': [8, 9],
  'fig': [8, 9],
  'mushroom': [8, 9, 10],
  'cauliflower': [8, 9, 10, 11],
  'broccoli': [8, 9, 10, 11],
  
  // Winter (December, January, February = months 11, 0, 1)
  'cabbage': [11, 0, 1],
  'kale': [11, 0, 1, 2],
  'leek': [11, 0, 1],
  'turnip': [11, 0, 1],
  'swede': [11, 0, 1],
  'citrus': [11, 0, 1],
  'orange': [11, 0, 1],
  'lemon': [11, 0, 1],
  'mandarin': [11, 0, 1],
  'grapefruit': [11, 0, 1],
  'pomegranate': [11, 0, 1],
  'potato': [0, 1, 2, 8, 9, 10, 11], // Available year-round but best in winter/autumn
  'onion': [0, 1, 2, 8, 9, 10, 11], // Available year-round
  'garlic': [0, 1, 2, 8, 9, 10, 11], // Available year-round
};

/**
 * Get current season based on month and hemisphere
 */
export function getCurrentSeason(hemisphere: Hemisphere = 'southern'): Season {
  const month = new Date().getMonth(); // 0-11
  
  if (hemisphere === 'northern') {
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  } else {
    // Southern hemisphere - opposite seasons
    if (month >= 2 && month <= 4) return 'autumn';
    if (month >= 5 && month <= 7) return 'winter';
    if (month >= 8 && month <= 10) return 'spring';
    return 'summer';
  }
}

/**
 * Adjust month for hemisphere (flip by 6 months for southern hemisphere)
 */
function adjustMonthForHemisphere(month: number, hemisphere: Hemisphere): number {
  if (hemisphere === 'southern') {
    return (month + 6) % 12;
  }
  return month;
}

/**
 * Check if an ingredient is in season
 */
export function isIngredientInSeason(
  ingredientName: string, 
  hemisphere: Hemisphere = 'southern',
  month?: number
): boolean {
  const currentMonth = month ?? new Date().getMonth();
  const adjustedMonth = adjustMonthForHemisphere(currentMonth, hemisphere);
  
  const lowerName = ingredientName.toLowerCase();
  
  // Check exact matches and partial matches
  for (const [ingredient, months] of Object.entries(SEASONAL_INGREDIENTS)) {
    if (lowerName.includes(ingredient) || ingredient.includes(lowerName)) {
      return months.includes(adjustedMonth);
    }
  }
  
  // Unknown ingredients are considered neutral (not penalized)
  return false;
}

/**
 * Calculate seasonal score for a recipe (0-1)
 * Higher score = more seasonal ingredients
 */
export function calculateSeasonalScore(
  ingredients: Array<{ name: string }>,
  hemisphere: Hemisphere = 'southern'
): number {
  if (ingredients.length === 0) return 0;
  
  let seasonalCount = 0;
  let totalCount = 0;
  
  for (const ingredient of ingredients) {
    totalCount++;
    if (isIngredientInSeason(ingredient.name, hemisphere)) {
      seasonalCount++;
    }
  }
  
  return seasonalCount / totalCount;
}

/**
 * Get seasonal tags for an ingredient
 */
export function getSeasonalTag(
  ingredientName: string,
  hemisphere: Hemisphere = 'southern'
): string | null {
  if (isIngredientInSeason(ingredientName, hemisphere)) {
    return 'seasonal';
  }
  return null;
}

/**
 * Get seasonal description for display
 */
export function getSeasonalDescription(hemisphere: Hemisphere = 'southern'): string {
  const season = getCurrentSeason(hemisphere);
  const seasonCapitalized = season.charAt(0).toUpperCase() + season.slice(1);
  return `${seasonCapitalized} favourites`;
}

/**
 * Get seasonal emoji for current season
 */
export function getSeasonalEmoji(hemisphere: Hemisphere = 'southern'): string {
  const season = getCurrentSeason(hemisphere);
  const emojis = {
    spring: '🌸',
    summer: '☀️',
    autumn: '🍂',
    winter: '❄️'
  };
  return emojis[season];
}
