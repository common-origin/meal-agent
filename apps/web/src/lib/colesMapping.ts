/**
 * Coles Product SKU Mapping v0
 * Manual mapping table for common ingredients to Coles products
 * Includes pack sizes, prices, and confidence levels
 */

export interface ColesProduct {
  sku: string;
  name: string;
  brand?: string;
  packSize: number;
  packUnit: string; // g, ml, unit
  price: number; // AUD
  pricePerUnit?: number; // calculated
  aisle?: string;
  lastUpdated: string; // ISO date
}

export interface IngredientMapping {
  normalizedName: string; // matches shoppingListAggregator normalized names
  colesProducts: ColesProduct[];
  confidence: 'high' | 'medium' | 'low'; // mapping confidence
  requiresChoice: boolean; // true if multiple products need user selection
  notes?: string;
}

// PACK_SIZE_MULTIPLIER from constants - ingredients needed >1.5x pack size trigger multi-pack
export const PACK_SIZE_MULTIPLIER = 1.5;

/**
 * Manual SKU mapping table
 * ~50 most common ingredients from recipe library
 */
export const COLES_INGREDIENT_MAPPINGS: IngredientMapping[] = [
  // === PROTEINS ===
  {
    normalizedName: 'chicken breast',
    colesProducts: [
      {
        sku: 'COL-CHKBRST-500',
        name: 'Chicken Breast Fillets',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 7.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-10-27'
      },
      {
        sku: 'COL-CHKBRST-1KG',
        name: 'Chicken Breast Fillets Family Pack',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 14.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'chicken thigh',
    colesProducts: [
      {
        sku: 'COL-CHKTHGH-600',
        name: 'Chicken Thigh Fillets',
        brand: 'Coles',
        packSize: 600,
        packUnit: 'g',
        price: 8.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'beef mince',
    colesProducts: [
      {
        sku: 'COL-BEEFMNC-500',
        name: 'Beef Mince',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 6.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'salmon',
    colesProducts: [
      {
        sku: 'COL-SALMON-200',
        name: 'Salmon Fillets',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 9.00,
        aisle: 'Seafood',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Fresh vs frozen option'
  },

  // === DAIRY & EGGS ===
  {
    normalizedName: 'milk',
    colesProducts: [
      {
        sku: 'COL-MILK-2L',
        name: 'Full Cream Milk',
        brand: 'Coles',
        packSize: 2000,
        packUnit: 'ml',
        price: 3.40,
        aisle: 'Dairy',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cheese',
    colesProducts: [
      {
        sku: 'COL-CHEDDAR-500',
        name: 'Tasty Cheese Block',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 7.00,
        aisle: 'Dairy',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Multiple cheese types available'
  },
  {
    normalizedName: 'butter',
    colesProducts: [
      {
        sku: 'COL-BUTTER-500',
        name: 'Salted Butter',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 5.50,
        aisle: 'Dairy',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cream',
    colesProducts: [
      {
        sku: 'COL-CREAM-300',
        name: 'Thickened Cream',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'ml',
        price: 3.50,
        aisle: 'Dairy',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'yogurt',
    colesProducts: [
      {
        sku: 'COL-YOGURT-1KG',
        name: 'Natural Yogurt',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Dairy',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Greek vs natural vs flavored'
  },

  // === VEGETABLES ===
  {
    normalizedName: 'onion',
    colesProducts: [
      {
        sku: 'COL-ONION-1KG',
        name: 'Brown Onions',
        brand: 'Coles',
        packSize: 1,
        packUnit: 'kg',
        price: 2.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'garlic',
    colesProducts: [
      {
        sku: 'COL-GARLIC-250',
        name: 'Garlic Bulbs',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'tomato',
    colesProducts: [
      {
        sku: 'COL-TOMATO-1KG',
        name: 'Tomatoes',
        brand: 'Coles',
        packSize: 1,
        packUnit: 'kg',
        price: 5.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'potato',
    colesProducts: [
      {
        sku: 'COL-POTATO-2KG',
        name: 'Washed Potatoes',
        brand: 'Coles',
        packSize: 2,
        packUnit: 'kg',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'carrot',
    colesProducts: [
      {
        sku: 'COL-CARROT-1KG',
        name: 'Carrots',
        brand: 'Coles',
        packSize: 1,
        packUnit: 'kg',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'capsicum',
    colesProducts: [
      {
        sku: 'COL-CAPSICUM-500',
        name: 'Red Capsicum',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Red vs green vs yellow'
  },
  {
    normalizedName: 'broccoli',
    colesProducts: [
      {
        sku: 'COL-BROCCOLI-500',
        name: 'Broccoli',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'spinach',
    colesProducts: [
      {
        sku: 'COL-SPINACH-120',
        name: 'Baby Spinach',
        brand: 'Coles',
        packSize: 120,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mushroom',
    colesProducts: [
      {
        sku: 'COL-MUSHROOM-200',
        name: 'White Mushrooms',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === PANTRY ===
  {
    normalizedName: 'pasta',
    colesProducts: [
      {
        sku: 'COL-PASTA-500',
        name: 'Spaghetti',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 1.50,
        aisle: 'Pantry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Multiple pasta shapes available'
  },
  {
    normalizedName: 'rice',
    colesProducts: [
      {
        sku: 'COL-RICE-1KG',
        name: 'Long Grain White Rice',
        brand: 'Coles',
        packSize: 1,
        packUnit: 'kg',
        price: 2.50,
        aisle: 'Pantry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'White vs brown vs basmati'
  },
  {
    normalizedName: 'olive oil',
    colesProducts: [
      {
        sku: 'COL-OLIVEOIL-500',
        name: 'Extra Virgin Olive Oil',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'ml',
        price: 8.00,
        aisle: 'Pantry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'soy sauce',
    colesProducts: [
      {
        sku: 'COL-SOYSAUCE-250',
        name: 'Soy Sauce',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 2.50,
        aisle: 'Pantry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'stock',
    colesProducts: [
      {
        sku: 'COL-STOCK-1L',
        name: 'Chicken Stock',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'ml',
        price: 2.00,
        aisle: 'Pantry',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Chicken vs beef vs vegetable'
  },

  // === CANNED/PACKAGED ===
  {
    normalizedName: 'canned tomato',
    colesProducts: [
      {
        sku: 'COL-TOMCAN-400',
        name: 'Diced Tomatoes',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 1.00,
        aisle: 'Canned Goods',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'coconut milk',
    colesProducts: [
      {
        sku: 'COL-COCONUTMILK-400',
        name: 'Coconut Milk',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'ml',
        price: 2.50,
        aisle: 'International Foods',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === BAKERY ===
  {
    normalizedName: 'bread',
    colesProducts: [
      {
        sku: 'COL-BREAD-700',
        name: 'White Sandwich Bread',
        brand: 'Coles',
        packSize: 700,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Bakery',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'White vs wholemeal vs sourdough'
  },

  // === HERBS & SPICES ===
  {
    normalizedName: 'basil',
    colesProducts: [
      {
        sku: 'COL-BASIL-25',
        name: 'Fresh Basil',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'parsley',
    colesProducts: [
      {
        sku: 'COL-PARSLEY-25',
        name: 'Fresh Parsley',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'coriander',
    colesProducts: [
      {
        sku: 'COL-CORIANDER-25',
        name: 'Fresh Coriander',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-10-27'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  }
];

/**
 * Find Coles product mapping for an ingredient
 */
export function findColesMapping(normalizedName: string): IngredientMapping | undefined {
  return COLES_INGREDIENT_MAPPINGS.find(
    mapping => mapping.normalizedName === normalizedName
  );
}

/**
 * Calculate number of packs needed based on quantity and pack size
 * Uses PACK_SIZE_MULTIPLIER threshold to determine if multiple packs needed
 */
export function calculatePacksNeeded(
  quantityNeeded: number,
  packSize: number
): number {
  if (quantityNeeded <= packSize) {
    return 1;
  }
  
  // If quantity > 1.5x pack size, buy multiple packs
  if (quantityNeeded > packSize * PACK_SIZE_MULTIPLIER) {
    return Math.ceil(quantityNeeded / packSize);
  }
  
  // Otherwise, buy single larger pack (user can choose)
  return 1;
}

/**
 * Select best product from multiple options based on quantity needed
 */
export function selectBestProduct(
  products: ColesProduct[],
  quantityNeeded: number,
  unit: string
): ColesProduct {
  // Filter to products with matching unit
  const matchingUnit = products.filter(p => p.packUnit === unit);
  
  if (matchingUnit.length === 0) {
    // No matching unit, return first product
    return products[0];
  }
  
  if (matchingUnit.length === 1) {
    return matchingUnit[0];
  }
  
  // Find the most cost-effective option
  // Prefer smallest pack that covers quantity, or best price per unit for bulk
  const sorted = matchingUnit.sort((a, b) => {
    const aPricePerUnit = a.price / a.packSize;
    const bPricePerUnit = b.price / b.packSize;
    
    // If quantity fits in single pack, prefer smaller pack
    if (quantityNeeded <= a.packSize && quantityNeeded <= b.packSize) {
      return a.packSize - b.packSize;
    }
    
    // Otherwise prefer best price per unit
    return aPricePerUnit - bPricePerUnit;
  });
  
  return sorted[0];
}

/**
 * Estimate total cost for an ingredient at Coles
 */
export function estimateIngredientCost(
  normalizedName: string,
  quantity: number,
  unit: string
): {
  mapped: boolean;
  estimatedCost: number;
  product?: ColesProduct;
  packsNeeded: number;
  requiresChoice: boolean;
  confidence?: 'high' | 'medium' | 'low';
} {
  const mapping = findColesMapping(normalizedName);
  
  if (!mapping) {
    return {
      mapped: false,
      estimatedCost: 0,
      packsNeeded: 0,
      requiresChoice: false
    };
  }
  
  const bestProduct = selectBestProduct(mapping.colesProducts, quantity, unit);
  const packsNeeded = calculatePacksNeeded(quantity, bestProduct.packSize);
  
  return {
    mapped: true,
    estimatedCost: bestProduct.price * packsNeeded,
    product: bestProduct,
    packsNeeded,
    requiresChoice: mapping.requiresChoice,
    confidence: mapping.confidence
  };
}
