/**
 * Ingredient Search Term Mapping
 * Improves product search by mapping recipe ingredient names to better Coles search terms
 * Handles synonyms, brands, compound ingredients, and category-specific optimizations
 */

/**
 * Common ingredient synonyms and alternate names
 * Maps recipe terms to better Coles product search terms
 */
const INGREDIENT_SYNONYMS: Record<string, string> = {
  // Proteins
  'chicken breast': 'chicken breast',
  'chicken breast fillet': 'chicken breast',
  'chicken breast fillets': 'chicken breast',
  'chicken thigh': 'chicken thigh',
  'chicken thighs': 'chicken thigh',
  'chicken drumstick': 'chicken drumstick',
  'chicken drumsticks': 'chicken drumstick',
  'beef mince': 'beef mince',
  'minced beef': 'beef mince',
  'ground beef': 'beef mince',
  'pork mince': 'pork mince',
  'minced pork': 'pork mince',
  'lamb chop': 'lamb chop',
  'lamb chops': 'lamb chop',
  'bacon rashers': 'bacon',
  'bacon strips': 'bacon',
  
  // Seafood
  'salmon fillet': 'salmon fillet',
  'salmon fillets': 'salmon fillet',
  'white fish': 'fish fillet',
  'white fish fillet': 'fish fillet',
  'prawns': 'prawn',
  'king prawns': 'prawn',
  'shrimp': 'prawn',
  
  // Dairy
  'cheddar cheese': 'cheddar cheese',
  'grated cheese': 'cheese shredded',
  'shredded cheese': 'cheese shredded',
  'mozzarella cheese': 'mozzarella',
  'parmesan cheese': 'parmesan',
  'greek yoghurt': 'greek yogurt',
  'greek yogurt': 'greek yogurt',
  'natural yoghurt': 'natural yogurt',
  'plain yogurt': 'natural yogurt',
  'thickened cream': 'cream',
  'heavy cream': 'cream',
  'double cream': 'cream',
  
  // Produce
  'brown onion': 'onion',
  'yellow onion': 'onion',
  'white onion': 'onion',
  'red onion': 'red onion',
  'spring onion': 'spring onion',
  'green onion': 'spring onion',
  'scallion': 'spring onion',
  'cherry tomato': 'cherry tomato',
  'cherry tomatoes': 'cherry tomato',
  'roma tomato': 'tomato',
  'roma tomatoes': 'tomato',
  'grape tomato': 'cherry tomato',
  'grape tomatoes': 'cherry tomato',
  'red capsicum': 'capsicum',
  'green capsicum': 'capsicum',
  'yellow capsicum': 'capsicum',
  'bell pepper': 'capsicum',
  'red bell pepper': 'capsicum',
  'green bell pepper': 'capsicum',
  'cos lettuce': 'cos lettuce',
  'romaine lettuce': 'cos lettuce',
  'iceberg lettuce': 'iceberg lettuce',
  'butter lettuce': 'lettuce',
  'sweet potato': 'sweet potato',
  'kumara': 'sweet potato',
  
  // Pantry
  'arborio rice': 'arborio rice',
  'jasmine rice': 'jasmine rice',
  'basmati rice': 'basmati rice',
  'long grain rice': 'rice',
  'brown rice': 'brown rice',
  'white rice': 'rice',
  'pasta': 'pasta',
  'spaghetti': 'spaghetti',
  'penne': 'penne pasta',
  'fettuccine': 'fettuccine',
  'olive oil': 'olive oil',
  'extra virgin olive oil': 'olive oil extra virgin',
  'vegetable oil': 'vegetable oil',
  'canola oil': 'canola oil',
  'sesame oil': 'sesame oil',
  'soy sauce': 'soy sauce',
  'dark soy sauce': 'soy sauce',
  'light soy sauce': 'soy sauce',
  'fish sauce': 'fish sauce',
  'oyster sauce': 'oyster sauce',
  'tomato paste': 'tomato paste',
  'tomato puree': 'tomato paste',
  'crushed tomato': 'tomatoes crushed',
  'crushed tomatoes': 'tomatoes crushed',
  'diced tomato': 'tomatoes diced',
  'diced tomatoes': 'tomatoes diced',
  'coconut milk': 'coconut milk',
  'coconut cream': 'coconut cream',
  'chicken stock': 'stock chicken',
  'beef stock': 'stock beef',
  'vegetable stock': 'stock vegetable',
  'chicken broth': 'stock chicken',
  'beef broth': 'stock beef',
  
  // Herbs & Spices
  'fresh basil': 'basil',
  'fresh parsley': 'parsley',
  'fresh coriander': 'coriander',
  'fresh cilantro': 'coriander',
  'fresh mint': 'mint',
  'fresh thyme': 'thyme',
  'fresh rosemary': 'rosemary',
  'dried oregano': 'oregano',
  'dried basil': 'basil dried',
  'dried thyme': 'thyme dried',
  'ground cumin': 'cumin',
  'ground coriander': 'coriander ground',
  'ground cinnamon': 'cinnamon',
  'curry powder': 'curry powder',
  'chili powder': 'chilli powder',
  'chilli powder': 'chilli powder',
  'paprika': 'paprika',
  'smoked paprika': 'paprika smoked',
  'cayenne pepper': 'cayenne pepper',
  'black pepper': 'pepper black',
  'white pepper': 'pepper white',
  
  // Bakery
  'bread rolls': 'bread rolls',
  'dinner rolls': 'bread rolls',
  'white bread': 'bread white',
  'wholemeal bread': 'bread wholemeal',
  'sourdough bread': 'sourdough',
  'pita bread': 'pita bread',
  'tortilla': 'tortilla',
  'flour tortilla': 'tortilla',
};

/**
 * Descriptors to remove from ingredient names for better search
 * These words add specificity but may reduce search results
 */
const DESCRIPTORS_TO_REMOVE = [
  // Preparation methods
  'chopped', 'diced', 'sliced', 'minced', 'grated', 'shredded',
  'crushed', 'ground', 'whole', 'halved', 'quartered',
  'julienned', 'cubed', 'peeled', 'deseeded', 'trimmed',
  
  // Quality descriptors
  'fresh', 'dried', 'frozen', 'canned', 'tinned', 'jarred',
  'organic', 'free range', 'grass fed', 'wild caught',
  'raw', 'cooked', 'roasted', 'smoked', 'salted', 'unsalted',
  'plain', 'natural', 'pure', 'authentic', 'premium',
  
  // Quantities (already handled by unit system)
  'large', 'small', 'medium', 'bunch', 'handful',
  
  // Common recipe phrases
  'for serving', 'to taste', 'optional', 'if needed',
  'or substitute', 'or as needed', 'approximately',
];

/**
 * Brand names that can confuse searches
 * Remove these to get generic product results
 */
const BRAND_NAMES = [
  'coles', 'woolworths', 'aldi', 'iga',
  'masterfoods', 'continental', 'mckenzie',
  'praised', 'fountain', 'eta', 'heinz',
  'maggi', 'knorr', 'campbells',
];

/**
 * Compound ingredients that should be simplified
 * Maps complex ingredient names to simpler search terms
 */
const COMPOUND_SIMPLIFICATIONS: Record<string, string> = {
  // Multiple ingredients in one
  'salt and pepper': 'salt',
  'herbs and spices': 'mixed herbs',
  'oil and butter': 'oil',
  'milk and cream': 'milk',
  
  // Specific preparations
  'lemon juice and zest': 'lemon',
  'lime juice and zest': 'lime',
  'orange juice and zest': 'orange',
  
  // Prepared mixes
  'mixed vegetables': 'vegetables frozen mixed',
  'stir fry vegetables': 'vegetables stir fry',
  'asian vegetables': 'vegetables asian',
  'italian herbs': 'herbs italian mixed',
  'mixed herbs': 'herbs mixed',
  'cajun spice': 'spice cajun',
  'taco seasoning': 'taco seasoning',
  'fajita seasoning': 'fajita seasoning',
};

/**
 * Category-specific search optimizations
 * Adds category keywords to improve relevance
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'protein': ['meat', 'fresh'],
  'seafood': ['fresh', 'seafood'],
  'dairy': ['dairy', 'milk'],
  'produce': ['fresh', 'produce'],
  'pantry': [],
  'herbs': ['fresh', 'herb'],
  'spices': ['spice'],
};

/**
 * Normalize and improve an ingredient name for Coles product search
 * Applies multiple transformations to maximize search success
 */
export function generateSearchTerm(ingredientName: string, category?: string): string {
  let searchTerm = ingredientName.toLowerCase().trim();
  
  // 1. Check for compound simplifications first
  for (const [compound, simplified] of Object.entries(COMPOUND_SIMPLIFICATIONS)) {
    if (searchTerm.includes(compound)) {
      searchTerm = simplified;
      break;
    }
  }
  
  // 2. Check for direct synonym match
  if (INGREDIENT_SYNONYMS[searchTerm]) {
    searchTerm = INGREDIENT_SYNONYMS[searchTerm];
  }
  
  // 3. Remove brand names
  for (const brand of BRAND_NAMES) {
    const brandPattern = new RegExp(`\\b${brand}\\b`, 'gi');
    searchTerm = searchTerm.replace(brandPattern, '').trim();
  }
  
  // 4. Remove descriptors
  for (const descriptor of DESCRIPTORS_TO_REMOVE) {
    const descriptorPattern = new RegExp(`\\b${descriptor}\\b`, 'gi');
    searchTerm = searchTerm.replace(descriptorPattern, '').trim();
  }
  
  // 5. Remove parenthetical notes and alternatives
  searchTerm = searchTerm.replace(/\s*\(.*?\)\s*/g, ' ');
  searchTerm = searchTerm.replace(/\s+or\s+.*$/g, '');
  searchTerm = searchTerm.replace(/,.*$/g, '');
  
  // 6. Clean up multiple spaces
  searchTerm = searchTerm.replace(/\s+/g, ' ').trim();
  
  // 7. If we're left with very generic terms, check synonyms for partial matches
  if (searchTerm.split(' ').length === 1) {
    for (const [key, value] of Object.entries(INGREDIENT_SYNONYMS)) {
      if (key.includes(searchTerm) || searchTerm.includes(key.split(' ')[0])) {
        searchTerm = value;
        break;
      }
    }
  }
  
  // 8. Add category-specific keywords if helpful
  if (category && CATEGORY_KEYWORDS[category.toLowerCase()]) {
    const keywords = CATEGORY_KEYWORDS[category.toLowerCase()];
    // Only add if the term is short and could benefit from specificity
    if (searchTerm.split(' ').length <= 2 && keywords.length > 0) {
      // Don't add 'fresh' if already specific enough
      if (searchTerm.split(' ').length === 1 && !['milk', 'cheese', 'yogurt'].includes(searchTerm)) {
        // Add first keyword (usually 'fresh' or category name)
        searchTerm = `${keywords[0]} ${searchTerm}`;
      }
    }
  }
  
  // 9. Final cleanup
  searchTerm = searchTerm.trim();
  
  // 10. If empty after all processing, return original
  if (!searchTerm) {
    return ingredientName;
  }
  
  return searchTerm;
}

/**
 * Generate multiple search term variations for fallback searches
 * Returns array of search terms from most specific to most generic
 */
export function generateSearchTermVariations(ingredientName: string, category?: string): string[] {
  const variations: string[] = [];
  
  // 1. Enhanced search term (primary)
  const enhanced = generateSearchTerm(ingredientName, category);
  variations.push(enhanced);
  
  // 2. Without category keywords
  const withoutCategory = generateSearchTerm(ingredientName);
  if (withoutCategory !== enhanced) {
    variations.push(withoutCategory);
  }
  
  // 3. Just the core noun (last word)
  const words = enhanced.split(' ');
  if (words.length > 1) {
    variations.push(words[words.length - 1]);
  }
  
  // 4. Original ingredient name (fallback)
  const original = ingredientName.toLowerCase().trim();
  if (!variations.includes(original)) {
    variations.push(original);
  }
  
  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Score how well a product matches the ingredient search
 * Returns a confidence score from 0-100
 */
export function calculateMatchScore(
  ingredientName: string,
  productName: string,
  productBrand: string
): number {
  const ingredientLower = ingredientName.toLowerCase();
  const productLower = productName.toLowerCase();
  const brandLower = productBrand.toLowerCase();
  
  let score = 0;
  
  // Exact match (rare but perfect)
  if (productLower === ingredientLower) {
    return 100;
  }
  
  // Product contains exact ingredient name
  if (productLower.includes(ingredientLower)) {
    score += 60;
  }
  
  // Check word-by-word matching
  const ingredientWords = ingredientLower.split(' ');
  const productWords = productLower.split(' ');
  
  let matchedWords = 0;
  for (const word of ingredientWords) {
    if (word.length > 2 && productWords.some(pw => pw.includes(word) || word.includes(pw))) {
      matchedWords++;
    }
  }
  
  const wordMatchPercent = (matchedWords / ingredientWords.length) * 40;
  score += wordMatchPercent;
  
  // Brand matching (relevant for specific products)
  if (brandLower.includes(ingredientLower) || ingredientLower.includes(brandLower)) {
    score += 10;
  }
  
  // Penalize if product has too many extra words (might be wrong product)
  const extraWords = productWords.length - ingredientWords.length;
  if (extraWords > 3) {
    score -= 10;
  }
  
  // Bonus for Coles brand (usually good generic match)
  if (brandLower === 'coles') {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get user-friendly explanation of search term transformation
 * Useful for debugging and showing users why certain results appear
 */
export function explainTransformation(original: string, searchTerm: string): string | null {
  if (original.toLowerCase() === searchTerm.toLowerCase()) {
    return null;
  }
  
  const reasons: string[] = [];
  
  // Check for synonym match
  if (INGREDIENT_SYNONYMS[original.toLowerCase()]) {
    reasons.push(`Using common name: "${searchTerm}"`);
  }
  
  // Check for descriptor removal
  for (const descriptor of DESCRIPTORS_TO_REMOVE) {
    if (original.toLowerCase().includes(descriptor)) {
      reasons.push(`Removed "${descriptor}" for broader results`);
      break;
    }
  }
  
  // Check for compound simplification
  for (const [compound, simplified] of Object.entries(COMPOUND_SIMPLIFICATIONS)) {
    if (original.toLowerCase().includes(compound)) {
      reasons.push(`Simplified compound ingredient to "${simplified}"`);
      break;
    }
  }
  
  if (reasons.length === 0) {
    return `Simplified to "${searchTerm}"`;
  }
  
  return reasons.join('. ');
}
