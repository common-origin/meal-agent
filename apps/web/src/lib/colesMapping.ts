/**
 * Coles Product SKU Mapping v0
 * Manual mapping table for common ingredients to Coles products
 * Includes pack sizes, prices, and confidence levels
 */

import { estimateIngredientCostByCategory, type PriceEstimate } from './ingredientPricing';
import { convertUnit, calculatePacksNeeded, areUnitsCompatible } from './unitConversion';

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
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'ghee',
    colesProducts: [
      {
        sku: 'COL-GHEE-400',
        name: 'Ghee',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 8.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
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
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL PROTEINS ===
  {
    normalizedName: 'pork',
    colesProducts: [
      {
        sku: 'COL-PORK-500',
        name: 'Pork Loin Steaks',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 8.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'lamb',
    colesProducts: [
      {
        sku: 'COL-LAMB-500',
        name: 'Lamb Leg Steaks',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 10.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bacon',
    colesProducts: [
      {
        sku: 'COL-BACON-250',
        name: 'Bacon Rashers',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 6.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sausage',
    colesProducts: [
      {
        sku: 'COL-SAUSAGE-500',
        name: 'Beef Sausages',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 6.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'prawn',
    colesProducts: [
      {
        sku: 'COL-PRAWN-500',
        name: 'Cooked Prawns',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 18.00,
        aisle: 'Seafood',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'egg',
    colesProducts: [
      {
        sku: 'COL-EGGS-12',
        name: 'Free Range Eggs',
        brand: 'Coles',
        packSize: 12,
        packUnit: 'unit',
        price: 7.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL VEGETABLES ===
  {
    normalizedName: 'zucchini',
    colesProducts: [
      {
        sku: 'COL-ZUCCHINI-500',
        name: 'Zucchini',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'eggplant',
    colesProducts: [
      {
        sku: 'COL-EGGPLANT-400',
        name: 'Eggplant',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cauliflower',
    colesProducts: [
      {
        sku: 'COL-CAULIFLOWER-800',
        name: 'Cauliflower',
        brand: 'Coles',
        packSize: 800,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'pumpkin',
    colesProducts: [
      {
        sku: 'COL-PUMPKIN-1KG',
        name: 'Butternut Pumpkin',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sweet potato',
    colesProducts: [
      {
        sku: 'COL-SWEETPOTATO-1KG',
        name: 'Sweet Potato',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cucumber',
    colesProducts: [
      {
        sku: 'COL-CUCUMBER-400',
        name: 'Lebanese Cucumber',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'lettuce',
    colesProducts: [
      {
        sku: 'COL-LETTUCE-350',
        name: 'Iceberg Lettuce',
        brand: 'Coles',
        packSize: 350,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'corn',
    colesProducts: [
      {
        sku: 'COL-CORN-2PK',
        name: 'Sweet Corn',
        brand: 'Coles',
        packSize: 2,
        packUnit: 'unit',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'avocado',
    colesProducts: [
      {
        sku: 'COL-AVOCADO-200',
        name: 'Hass Avocado',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'green bean',
    colesProducts: [
      {
        sku: 'COL-GREENBEAN-250',
        name: 'Green Beans',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL HERBS & SPICES ===
  {
    normalizedName: 'ginger',
    colesProducts: [
      {
        sku: 'COL-GINGER-100',
        name: 'Fresh Ginger',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'chilli',
    colesProducts: [
      {
        sku: 'COL-CHILLI-100',
        name: 'Red Chilli',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mint',
    colesProducts: [
      {
        sku: 'COL-MINT-25',
        name: 'Fresh Mint',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'thyme',
    colesProducts: [
      {
        sku: 'COL-THYME-15',
        name: 'Fresh Thyme',
        brand: 'Coles',
        packSize: 15,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cumin',
    colesProducts: [
      {
        sku: 'COL-CUMIN-40',
        name: 'Ground Cumin',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'paprika',
    colesProducts: [
      {
        sku: 'COL-PAPRIKA-40',
        name: 'Paprika',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'curry powder',
    colesProducts: [
      {
        sku: 'COL-CURRY-50',
        name: 'Curry Powder',
        brand: 'Coles',
        packSize: 50,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === PANTRY STAPLES ===
  {
    normalizedName: 'flour',
    colesProducts: [
      {
        sku: 'COL-FLOUR-1KG',
        name: 'Plain Flour',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sugar',
    colesProducts: [
      {
        sku: 'COL-SUGAR-1KG',
        name: 'White Sugar',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 2.00,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'brown sugar',
    colesProducts: [
      {
        sku: 'COL-BROWNSUGAR-500',
        name: 'Brown Sugar',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'honey',
    colesProducts: [
      {
        sku: 'COL-HONEY-500',
        name: 'Australian Honey',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 7.00,
        aisle: 'Spreads & Honey',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'vinegar',
    colesProducts: [
      {
        sku: 'COL-VINEGAR-500',
        name: 'White Vinegar',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'ml',
        price: 2.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'White vs apple cider vs balsamic'
  },
  {
    normalizedName: 'tomato paste',
    colesProducts: [
      {
        sku: 'COL-TOMPASTE-200',
        name: 'Tomato Paste',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 1.50,
        aisle: 'Canned Goods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'peanut butter',
    colesProducts: [
      {
        sku: 'COL-PEANUTBUTTER-375',
        name: 'Smooth Peanut Butter',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Spreads & Honey',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'chickpea',
    colesProducts: [
      {
        sku: 'COL-CHICKPEA-400',
        name: 'Chickpeas',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 1.50,
        aisle: 'Canned Goods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'kidney bean',
    colesProducts: [
      {
        sku: 'COL-KIDNEYBEAN-400',
        name: 'Red Kidney Beans',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 1.50,
        aisle: 'Canned Goods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'lentil',
    colesProducts: [
      {
        sku: 'COL-LENTIL-500',
        name: 'Red Lentils',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'couscous',
    colesProducts: [
      {
        sku: 'COL-COUSCOUS-500',
        name: 'Couscous',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'noodle',
    colesProducts: [
      {
        sku: 'COL-NOODLE-400',
        name: 'Egg Noodles',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Egg vs rice vs udon'
  },
  {
    normalizedName: 'tortilla',
    colesProducts: [
      {
        sku: 'COL-TORTILLA-375',
        name: 'Flour Tortillas',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Bakery',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === CONDIMENTS & SAUCES ===
  {
    normalizedName: 'fish sauce',
    colesProducts: [
      {
        sku: 'COL-FISHSAUCE-200',
        name: 'Fish Sauce',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'ml',
        price: 3.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'oyster sauce',
    colesProducts: [
      {
        sku: 'COL-OYSTERSAUCE-250',
        name: 'Oyster Sauce',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 3.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sesame oil',
    colesProducts: [
      {
        sku: 'COL-SESAMEOIL-250',
        name: 'Sesame Oil',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 5.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sriracha',
    colesProducts: [
      {
        sku: 'COL-SRIRACHA-200',
        name: 'Sriracha Hot Sauce',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'ml',
        price: 4.00,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mayonnaise',
    colesProducts: [
      {
        sku: 'COL-MAYO-445',
        name: 'Whole Egg Mayonnaise',
        brand: 'Coles',
        packSize: 445,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mustard',
    colesProducts: [
      {
        sku: 'COL-MUSTARD-200',
        name: 'Dijon Mustard',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === FROZEN ===
  {
    normalizedName: 'peas',
    colesProducts: [
      {
        sku: 'COL-PEAS-500',
        name: 'Frozen Peas',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Frozen Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mixed vegetable',
    colesProducts: [
      {
        sku: 'COL-MIXEDVEG-500',
        name: 'Frozen Mixed Vegetables',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Frozen Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === FRUIT ===
  {
    normalizedName: 'lemon',
    colesProducts: [
      {
        sku: 'COL-LEMON-500',
        name: 'Lemons',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'lime',
    colesProducts: [
      {
        sku: 'COL-LIME-250',
        name: 'Limes',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'apple',
    colesProducts: [
      {
        sku: 'COL-APPLE-1KG',
        name: 'Royal Gala Apples',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'banana',
    colesProducts: [
      {
        sku: 'COL-BANANA-1KG',
        name: 'Cavendish Bananas',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL VEGETABLES & PRODUCE ===
  {
    normalizedName: 'spring onion',
    colesProducts: [
      {
        sku: 'COL-SPRINGONION-100',
        name: 'Spring Onions',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'leek',
    colesProducts: [
      {
        sku: 'COL-LEEK-400',
        name: 'Leeks',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'celery',
    colesProducts: [
      {
        sku: 'COL-CELERY-500',
        name: 'Celery',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cabbage',
    colesProducts: [
      {
        sku: 'COL-CABBAGE-1KG',
        name: 'Green Cabbage',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bok choy',
    colesProducts: [
      {
        sku: 'COL-BOKCHOY-300',
        name: 'Bok Choy',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'kale',
    colesProducts: [
      {
        sku: 'COL-KALE-200',
        name: 'Kale',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'snow pea',
    colesProducts: [
      {
        sku: 'COL-SNOWPEA-150',
        name: 'Snow Peas',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bean sprout',
    colesProducts: [
      {
        sku: 'COL-BEANSPROUT-250',
        name: 'Bean Sprouts',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'beetroot',
    colesProducts: [
      {
        sku: 'COL-BEETROOT-500',
        name: 'Beetroot',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'radish',
    colesProducts: [
      {
        sku: 'COL-RADISH-250',
        name: 'Radishes',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL PROTEINS & SEAFOOD ===
  {
    normalizedName: 'tuna',
    colesProducts: [
      {
        sku: 'COL-TUNA-425',
        name: 'Tuna in Springwater',
        brand: 'Coles',
        packSize: 425,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Canned Goods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'fish fillet',
    colesProducts: [
      {
        sku: 'COL-BASA-500',
        name: 'Basa Fish Fillets',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 9.00,
        aisle: 'Seafood',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Various types available'
  },
  {
    normalizedName: 'tofu',
    colesProducts: [
      {
        sku: 'COL-TOFU-300',
        name: 'Firm Tofu',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Refrigerated',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sour cream',
    colesProducts: [
      {
        sku: 'COL-SOURCREAM-300',
        name: 'Sour Cream',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'ml',
        price: 3.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'feta',
    colesProducts: [
      {
        sku: 'COL-FETA-200',
        name: 'Greek Feta',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'parmesan',
    colesProducts: [
      {
        sku: 'COL-PARMESAN-125',
        name: 'Grated Parmesan',
        brand: 'Coles',
        packSize: 125,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mozzarella',
    colesProducts: [
      {
        sku: 'COL-MOZZ-250',
        name: 'Shredded Mozzarella',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 5.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL HERBS & AROMATICS ===
  {
    normalizedName: 'rosemary',
    colesProducts: [
      {
        sku: 'COL-ROSEMARY-20',
        name: 'Fresh Rosemary',
        brand: 'Coles',
        packSize: 20,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'oregano',
    colesProducts: [
      {
        sku: 'COL-OREGANO-15',
        name: 'Dried Oregano',
        brand: 'Coles',
        packSize: 15,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bay leaf',
    colesProducts: [
      {
        sku: 'COL-BAYLEAF-5',
        name: 'Dried Bay Leaves',
        brand: 'Coles',
        packSize: 5,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'dill',
    colesProducts: [
      {
        sku: 'COL-DILL-20',
        name: 'Fresh Dill',
        brand: 'Coles',
        packSize: 20,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'turmeric',
    colesProducts: [
      {
        sku: 'COL-TURMERIC-40',
        name: 'Ground Turmeric',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cinnamon',
    colesProducts: [
      {
        sku: 'COL-CINNAMON-40',
        name: 'Ground Cinnamon',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'coriander seed',
    colesProducts: [
      {
        sku: 'COL-CORIANDERSD-40',
        name: 'Ground Coriander',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cardamom',
    colesProducts: [
      {
        sku: 'COL-CARDAMOM-25',
        name: 'Ground Cardamom',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'star anise',
    colesProducts: [
      {
        sku: 'COL-STARANISE-15',
        name: 'Star Anise',
        brand: 'Coles',
        packSize: 15,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cayenne',
    colesProducts: [
      {
        sku: 'COL-CAYENNE-30',
        name: 'Cayenne Pepper',
        brand: 'Coles',
        packSize: 30,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ASIAN PANTRY ===
  {
    normalizedName: 'rice wine',
    colesProducts: [
      {
        sku: 'COL-RICEWINE-375',
        name: 'Shaoxing Rice Wine',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'ml',
        price: 5.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mirin',
    colesProducts: [
      {
        sku: 'COL-MIRIN-250',
        name: 'Mirin',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 4.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'hoisin sauce',
    colesProducts: [
      {
        sku: 'COL-HOISIN-250',
        name: 'Hoisin Sauce',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 3.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'curry paste',
    colesProducts: [
      {
        sku: 'COL-CURRYPASTE-220',
        name: 'Thai Red Curry Paste',
        brand: 'Coles',
        packSize: 220,
        packUnit: 'g',
        price: 3.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Red vs green vs yellow'
  },
  {
    normalizedName: 'coconut cream',
    colesProducts: [
      {
        sku: 'COL-COCONUTCREAM-400',
        name: 'Coconut Cream',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'ml',
        price: 2.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'rice noodle',
    colesProducts: [
      {
        sku: 'COL-RICENOODLE-375',
        name: 'Rice Stick Noodles',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'g',
        price: 3.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'tahini',
    colesProducts: [
      {
        sku: 'COL-TAHINI-375',
        name: 'Tahini',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'g',
        price: 6.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === BAKING & SWEETENERS ===
  {
    normalizedName: 'baking powder',
    colesProducts: [
      {
        sku: 'COL-BAKINGPOWDER-125',
        name: 'Baking Powder',
        brand: 'Coles',
        packSize: 125,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'baking soda',
    colesProducts: [
      {
        sku: 'COL-BAKINGSODA-375',
        name: 'Bicarbonate of Soda',
        brand: 'Coles',
        packSize: 375,
        packUnit: 'g',
        price: 2.00,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cornflour',
    colesProducts: [
      {
        sku: 'COL-CORNFLOUR-300',
        name: 'Cornflour',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'vanilla extract',
    colesProducts: [
      {
        sku: 'COL-VANILLA-50',
        name: 'Vanilla Extract',
        brand: 'Coles',
        packSize: 50,
        packUnit: 'ml',
        price: 5.00,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cocoa powder',
    colesProducts: [
      {
        sku: 'COL-COCOA-200',
        name: 'Cocoa Powder',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Baking',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'maple syrup',
    colesProducts: [
      {
        sku: 'COL-MAPLE-250',
        name: 'Maple Syrup',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 8.00,
        aisle: 'Breakfast Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL CONDIMENTS ===
  {
    normalizedName: 'worcestershire sauce',
    colesProducts: [
      {
        sku: 'COL-WORCESTER-150',
        name: 'Worcestershire Sauce',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'ml',
        price: 3.00,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'ketchup',
    colesProducts: [
      {
        sku: 'COL-KETCHUP-500',
        name: 'Tomato Sauce',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'ml',
        price: 3.00,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bbq sauce',
    colesProducts: [
      {
        sku: 'COL-BBQ-500',
        name: 'BBQ Sauce',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'ml',
        price: 3.50,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sweet chilli sauce',
    colesProducts: [
      {
        sku: 'COL-SWEETCHILLI-250',
        name: 'Sweet Chilli Sauce',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 3.00,
        aisle: 'Sauces & Condiments',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === NUTS & SEEDS ===
  {
    normalizedName: 'almond',
    colesProducts: [
      {
        sku: 'COL-ALMOND-200',
        name: 'Raw Almonds',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 6.00,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cashew',
    colesProducts: [
      {
        sku: 'COL-CASHEW-200',
        name: 'Raw Cashews',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 7.00,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'walnut',
    colesProducts: [
      {
        sku: 'COL-WALNUT-150',
        name: 'Walnuts',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'g',
        price: 6.50,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sesame seed',
    colesProducts: [
      {
        sku: 'COL-SESAMESEED-100',
        name: 'Sesame Seeds',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'pumpkin seed',
    colesProducts: [
      {
        sku: 'COL-PUMPKINSEED-150',
        name: 'Pumpkin Seeds',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL FRUIT ===
  {
    normalizedName: 'orange',
    colesProducts: [
      {
        sku: 'COL-ORANGE-1KG',
        name: 'Navel Oranges',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'pear',
    colesProducts: [
      {
        sku: 'COL-PEAR-1KG',
        name: 'Packham Pears',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'berries',
    colesProducts: [
      {
        sku: 'COL-STRAWBERRY-250',
        name: 'Strawberries',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Strawberry vs blueberry vs raspberry'
  },
  {
    normalizedName: 'mango',
    colesProducts: [
      {
        sku: 'COL-MANGO-500',
        name: 'Mango',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-15'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL PROTEINS & MEATS (50 NEW PRODUCTS) ===
  {
    normalizedName: 'duck',
    colesProducts: [
      {
        sku: 'COL-DUCK-1KG',
        name: 'Duck Whole',
        brand: 'Coles',
        packSize: 1000,
        packUnit: 'g',
        price: 15.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'turkey',
    colesProducts: [
      {
        sku: 'COL-TURKEY-500',
        name: 'Turkey Breast',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 9.00,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'ham',
    colesProducts: [
      {
        sku: 'COL-HAM-200',
        name: 'Shaved Ham',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 5.50,
        aisle: 'Deli',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'salami',
    colesProducts: [
      {
        sku: 'COL-SALAMI-150',
        name: 'Sliced Salami',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Deli',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'chorizo',
    colesProducts: [
      {
        sku: 'COL-CHORIZO-200',
        name: 'Spanish Chorizo',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 6.00,
        aisle: 'Deli',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mince',
    colesProducts: [
      {
        sku: 'COL-PORK-MINCE-500',
        name: 'Pork Mince',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 6.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Various types available'
  },
  {
    normalizedName: 'liver',
    colesProducts: [
      {
        sku: 'COL-LIVER-400',
        name: 'Chicken Liver',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Meat & Poultry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'scallop',
    colesProducts: [
      {
        sku: 'COL-SCALLOP-300',
        name: 'Scallops',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 12.00,
        aisle: 'Seafood',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mussel',
    colesProducts: [
      {
        sku: 'COL-MUSSEL-500',
        name: 'Mussels',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 8.00,
        aisle: 'Seafood',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'squid',
    colesProducts: [
      {
        sku: 'COL-SQUID-400',
        name: 'Squid Tubes',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 9.00,
        aisle: 'Seafood',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL VEGETABLES & PRODUCE ===
  {
    normalizedName: 'asparagus',
    colesProducts: [
      {
        sku: 'COL-ASPARAGUS-250',
        name: 'Asparagus',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'brussels sprout',
    colesProducts: [
      {
        sku: 'COL-BRUSSELSSPROUT-300',
        name: 'Brussels Sprouts',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'fennel',
    colesProducts: [
      {
        sku: 'COL-FENNEL-300',
        name: 'Fennel Bulb',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'artichoke',
    colesProducts: [
      {
        sku: 'COL-ARTICHOKE-400',
        name: 'Globe Artichoke',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'silverbeet',
    colesProducts: [
      {
        sku: 'COL-SILVERBEET-300',
        name: 'Silverbeet',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'rocket',
    colesProducts: [
      {
        sku: 'COL-ROCKET-120',
        name: 'Rocket Leaves',
        brand: 'Coles',
        packSize: 120,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'watercress',
    colesProducts: [
      {
        sku: 'COL-WATERCRESS-100',
        name: 'Watercress',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'turnip',
    colesProducts: [
      {
        sku: 'COL-TURNIP-500',
        name: 'Turnip',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'parsnip',
    colesProducts: [
      {
        sku: 'COL-PARSNIP-500',
        name: 'Parsnips',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'swede',
    colesProducts: [
      {
        sku: 'COL-SWEDE-700',
        name: 'Swede',
        brand: 'Coles',
        packSize: 700,
        packUnit: 'g',
        price: 2.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL DAIRY & CHEESE ===
  {
    normalizedName: 'ricotta',
    colesProducts: [
      {
        sku: 'COL-RICOTTA-250',
        name: 'Ricotta Cheese',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'brie',
    colesProducts: [
      {
        sku: 'COL-BRIE-125',
        name: 'Brie Cheese',
        brand: 'Coles',
        packSize: 125,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'camembert',
    colesProducts: [
      {
        sku: 'COL-CAMEMBERT-125',
        name: 'Camembert Cheese',
        brand: 'Coles',
        packSize: 125,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'blue cheese',
    colesProducts: [
      {
        sku: 'COL-BLUECHEESE-150',
        name: 'Blue Cheese',
        brand: 'Coles',
        packSize: 150,
        packUnit: 'g',
        price: 5.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'halloumi',
    colesProducts: [
      {
        sku: 'COL-HALLOUMI-200',
        name: 'Halloumi Cheese',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 6.00,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'goat cheese',
    colesProducts: [
      {
        sku: 'COL-GOATCHEESE-100',
        name: 'Goats Cheese',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mascarpone',
    colesProducts: [
      {
        sku: 'COL-MASCARPONE-250',
        name: 'Mascarpone',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 5.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'cottage cheese',
    colesProducts: [
      {
        sku: 'COL-COTTAGECHEESE-250',
        name: 'Cottage Cheese',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Dairy & Eggs',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL HERBS, SPICES & AROMATICS ===
  {
    normalizedName: 'sage',
    colesProducts: [
      {
        sku: 'COL-SAGE-15',
        name: 'Fresh Sage',
        brand: 'Coles',
        packSize: 15,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'tarragon',
    colesProducts: [
      {
        sku: 'COL-TARRAGON-15',
        name: 'Fresh Tarragon',
        brand: 'Coles',
        packSize: 15,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'lemongrass',
    colesProducts: [
      {
        sku: 'COL-LEMONGRASS-100',
        name: 'Lemongrass',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'kaffir lime',
    colesProducts: [
      {
        sku: 'COL-KAFFIRLIME-10',
        name: 'Kaffir Lime Leaves',
        brand: 'Coles',
        packSize: 10,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'curry leaf',
    colesProducts: [
      {
        sku: 'COL-CURRYLEAF-10',
        name: 'Curry Leaves',
        brand: 'Coles',
        packSize: 10,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Fresh Produce',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'nutmeg',
    colesProducts: [
      {
        sku: 'COL-NUTMEG-30',
        name: 'Ground Nutmeg',
        brand: 'Coles',
        packSize: 30,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'clove',
    colesProducts: [
      {
        sku: 'COL-CLOVE-25',
        name: 'Ground Cloves',
        brand: 'Coles',
        packSize: 25,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'allspice',
    colesProducts: [
      {
        sku: 'COL-ALLSPICE-30',
        name: 'Ground Allspice',
        brand: 'Coles',
        packSize: 30,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'mustard seed',
    colesProducts: [
      {
        sku: 'COL-MUSTARDSEED-40',
        name: 'Mustard Seeds',
        brand: 'Coles',
        packSize: 40,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'fennel seed',
    colesProducts: [
      {
        sku: 'COL-FENNELSEED-35',
        name: 'Fennel Seeds',
        brand: 'Coles',
        packSize: 35,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Herbs & Spices',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL PANTRY & GRAINS ===
  {
    normalizedName: 'quinoa',
    colesProducts: [
      {
        sku: 'COL-QUINOA-400',
        name: 'Quinoa',
        brand: 'Coles',
        packSize: 400,
        packUnit: 'g',
        price: 5.00,
        aisle: 'Health Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'bulgur',
    colesProducts: [
      {
        sku: 'COL-BULGUR-500',
        name: 'Bulgur Wheat',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'barley',
    colesProducts: [
      {
        sku: 'COL-BARLEY-500',
        name: 'Pearl Barley',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'polenta',
    colesProducts: [
      {
        sku: 'COL-POLENTA-500',
        name: 'Polenta',
        brand: 'Coles',
        packSize: 500,
        packUnit: 'g',
        price: 3.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'oats',
    colesProducts: [
      {
        sku: 'COL-OATS-750',
        name: 'Rolled Oats',
        brand: 'Coles',
        packSize: 750,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Breakfast Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },

  // === ADDITIONAL CONDIMENTS & SPECIALTY ===
  {
    normalizedName: 'capers',
    colesProducts: [
      {
        sku: 'COL-CAPERS-100',
        name: 'Capers',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 3.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'olive',
    colesProducts: [
      {
        sku: 'COL-OLIVE-200',
        name: 'Kalamata Olives',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'medium',
    requiresChoice: true,
    notes: 'Various types available'
  },
  {
    normalizedName: 'anchovy',
    colesProducts: [
      {
        sku: 'COL-ANCHOVY-50',
        name: 'Anchovy Fillets',
        brand: 'Coles',
        packSize: 50,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sun-dried tomato',
    colesProducts: [
      {
        sku: 'COL-SUNDRIEDTOM-100',
        name: 'Sun-Dried Tomatoes',
        brand: 'Coles',
        packSize: 100,
        packUnit: 'g',
        price: 4.00,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'pesto',
    colesProducts: [
      {
        sku: 'COL-PESTO-190',
        name: 'Basil Pesto',
        brand: 'Coles',
        packSize: 190,
        packUnit: 'g',
        price: 4.50,
        aisle: 'Pantry',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'sambal',
    colesProducts: [
      {
        sku: 'COL-SAMBAL-200',
        name: 'Sambal Oelek',
        brand: 'Coles',
        packSize: 200,
        packUnit: 'g',
        price: 3.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'gochujang',
    colesProducts: [
      {
        sku: 'COL-GOCHUJANG-300',
        name: 'Gochujang',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 5.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'miso',
    colesProducts: [
      {
        sku: 'COL-MISO-300',
        name: 'Miso Paste',
        brand: 'Coles',
        packSize: 300,
        packUnit: 'g',
        price: 5.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'harissa',
    colesProducts: [
      {
        sku: 'COL-HARISSA-180',
        name: 'Harissa Paste',
        brand: 'Coles',
        packSize: 180,
        packUnit: 'g',
        price: 4.50,
        aisle: 'International Foods',
        lastUpdated: '2025-11-16'
      }
    ],
    confidence: 'high',
    requiresChoice: false
  },
  {
    normalizedName: 'pomegranate molasses',
    colesProducts: [
      {
        sku: 'COL-POMMOLASSES-250',
        name: 'Pomegranate Molasses',
        brand: 'Coles',
        packSize: 250,
        packUnit: 'ml',
        price: 6.00,
        aisle: 'International Foods',
        lastUpdated: '2025-11-16'
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


/**
 * Select best product from multiple options based on quantity needed
 */
export function selectBestProduct(
  products: ColesProduct[],
  quantityNeeded: number,
  unit: string
): ColesProduct {
  // Filter to products with compatible units
  const matchingUnit = products.filter(p => areUnitsCompatible(p.packUnit, unit));
  
  if (matchingUnit.length === 0) {
    // No compatible units, return first product (user may need to manually select)
    console.warn(`No compatible unit found for ${unit}, using first product`);
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
    
    // Convert quantity to product's unit for comparison
    const qtyInAUnit = convertUnit(quantityNeeded, unit, a.packUnit);
    const qtyInBUnit = convertUnit(quantityNeeded, unit, b.packUnit);
    
    // If quantity fits in single pack, prefer smaller pack
    if (qtyInAUnit <= a.packSize && qtyInBUnit <= b.packSize) {
      return a.packSize - b.packSize;
    }
    
    // Otherwise prefer best price per unit
    return aPricePerUnit - bPricePerUnit;
  });
  
  return sorted[0];
}

/**
 * Estimate total cost for an ingredient at Coles
 * Now with intelligent fallback to category-based pricing
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
  priceEstimate?: PriceEstimate;
  priceSource?: 'api' | 'static' | 'category';
} {
  // Tier 2: Static mapping (always check this synchronously)
  const mapping = findColesMapping(normalizedName);
  
  if (!mapping) {
    // Tier 3: Use category-based pricing as fallback
    const estimate = estimateIngredientCostByCategory(normalizedName, quantity, unit);
    
    return {
      mapped: false,
      estimatedCost: estimate.price,
      packsNeeded: 1,
      requiresChoice: false,
      confidence: estimate.confidence,
      priceEstimate: estimate,
      priceSource: 'category',
    };
  }
  
  const bestProduct = selectBestProduct(mapping.colesProducts, quantity, unit);
  
  // Calculate packs needed (convertUnit is called inside calculatePacksNeeded)
  const packsNeeded = calculatePacksNeeded(quantity, unit, bestProduct.packSize, bestProduct.packUnit, PACK_SIZE_MULTIPLIER);
  
  return {
    mapped: true,
    estimatedCost: bestProduct.price * packsNeeded,
    product: bestProduct,
    packsNeeded,
    requiresChoice: mapping.requiresChoice,
    confidence: mapping.confidence,
    priceSource: 'static',
  };
}

/**
 * Enhanced cost estimation with API integration (async version)
 * 3-tier fallback: Persistent cache → API → Static mapping → Category estimate
 */
export async function estimateIngredientCostWithAPI(
  normalizedName: string,
  quantity: number,
  unit: string
): Promise<{
  mapped: boolean;
  estimatedCost: number;
  product?: ColesProduct;
  packsNeeded: number;
  requiresChoice: boolean;
  confidence?: 'high' | 'medium' | 'low';
  priceEstimate?: PriceEstimate;
  priceSource: 'api' | 'static' | 'category';
  livePrice?: boolean;
}> {
  // Tier 0: Check persistent cache first
  if (typeof window !== 'undefined') {
    try {
      const { getCachedProduct } = await import('./colesApiPersistentCache');
      const cachedData = getCachedProduct(normalizedName);
      
      if (cachedData) {
        const { parsePrice, parseSize } = await import('./colesApi');
        const price = parsePrice(cachedData.product.currentPrice);
        const { value: packSize, unit: packUnit } = parseSize(cachedData.product.size);
        
        if (price > 0 && packSize > 0) {
          const packsNeeded = calculatePacksNeeded(quantity, unit, packSize, packUnit, PACK_SIZE_MULTIPLIER);
          
          const product: ColesProduct = {
            sku: `CACHE-${Date.now()}`,
            name: cachedData.product.productName,
            brand: cachedData.product.brand,
            packSize,
            packUnit,
            price,
            lastUpdated: new Date(cachedData.timestamp).toISOString(),
          };
          
          return {
            mapped: true,
            estimatedCost: price * packsNeeded,
            product,
            packsNeeded,
            requiresChoice: false,
            confidence: 'high',
            priceSource: 'api',
            livePrice: true,
          };
        }
      }
    } catch (error) {
      console.warn('Persistent cache lookup failed:', error);
    }
  }
  
  // Tier 1: Try API (only if enabled and within quota)
  if (typeof window !== 'undefined') {
    try {
      const { shouldMakeApiRequest } = await import('./apiQuota');
      const { allowed, reason } = shouldMakeApiRequest();
      
      if (!allowed) {
        console.log(`⏭️  Skipping API call: ${reason}`);
        // Fall through to static mapping
      } else {
        const { searchColesProducts, parsePrice, parseSize } = await import('./colesApi');
        const { categorizeIngredient } = await import('./ingredientPricing');
        const category = categorizeIngredient(normalizedName);
        const apiResult = await searchColesProducts(normalizedName, 3, category);
        
        if (apiResult && apiResult.results.length > 0) {
          // Use the first matching product
          const apiProduct = apiResult.results[0];
          const price = parsePrice(apiProduct.currentPrice);
          const { value: packSize, unit: packUnit } = parseSize(apiProduct.size);
          
          if (price > 0 && packSize > 0) {
            // Save to persistent cache
            try {
              const { saveProductToCache } = await import('./colesApiPersistentCache');
              saveProductToCache(normalizedName, apiProduct, quantity, unit, normalizedName);
            } catch (cacheError) {
              console.warn('Failed to save to persistent cache:', cacheError);
            }
            
            // Calculate packs needed (convertUnit is called inside calculatePacksNeeded)
            const packsNeeded = calculatePacksNeeded(quantity, unit, packSize, packUnit, PACK_SIZE_MULTIPLIER);
            
            // Create a ColesProduct-like object from API data
            const product: ColesProduct = {
              sku: `API-${Date.now()}`,
              name: apiProduct.productName,
              brand: apiProduct.brand,
              packSize,
              packUnit,
              price,
              lastUpdated: new Date().toISOString(),
            };
            
            return {
              mapped: true,
              estimatedCost: price * packsNeeded,
              product,
              packsNeeded,
              requiresChoice: false,
              confidence: 'high',
              priceSource: 'api',
              livePrice: true,
            };
          }
        }
      }
    } catch (error) {
      console.warn('API price lookup failed, falling back to static mapping:', error);
    }
  }
  
  // Tier 2 & 3: Fall back to synchronous method
  const result = estimateIngredientCost(normalizedName, quantity, unit);
  return {
    ...result,
    priceSource: result.priceSource || 'category',
    livePrice: false,
  };
}
