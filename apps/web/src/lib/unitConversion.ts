/**
 * Unified Unit Conversion Module
 * Single source of truth for all unit conversions across the app
 * Handles weight, volume, and count units with proper type safety
 */

export enum UnitType {
  WEIGHT = 'weight',
  VOLUME = 'volume',
  COUNT = 'count',
}

export interface UnitInfo {
  type: UnitType;
  baseUnit: string;
  toBase: number; // Multiplier to convert to base unit
}

/**
 * Comprehensive unit definitions
 * Base units: g (weight), ml (volume), unit (count)
 */
export const UNIT_DEFINITIONS: Record<string, UnitInfo> = {
  // Weight units
  'g': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1 },
  'gram': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1 },
  'grams': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1 },
  'kg': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1000 },
  'kilogram': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1000 },
  'kilograms': { type: UnitType.WEIGHT, baseUnit: 'g', toBase: 1000 },
  
  // Volume units
  'ml': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1 },
  'milliliter': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1 },
  'millilitre': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1 },
  'l': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1000 },
  'liter': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1000 },
  'litre': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 1000 },
  'tsp': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 5 },
  'teaspoon': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 5 },
  'tbsp': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 15 },
  'tablespoon': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 15 },
  'cup': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 250 },
  'cups': { type: UnitType.VOLUME, baseUnit: 'ml', toBase: 250 },
  
  // Count units
  'unit': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'units': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'piece': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'pieces': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'whole': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'bunch': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
  'bunches': { type: UnitType.COUNT, baseUnit: 'unit', toBase: 1 },
};

/**
 * Get unit info from unit string (case-insensitive)
 */
export function getUnitInfo(unit: string): UnitInfo | undefined {
  if (!unit || typeof unit !== 'string') return undefined;
  const normalized = unit.toLowerCase().trim();
  return UNIT_DEFINITIONS[normalized];
}

/**
 * Get the type of a unit (weight, volume, or count)
 */
export function getUnitType(unit: string): UnitType | undefined {
  const info = getUnitInfo(unit);
  return info?.type;
}

/**
 * Check if two units are compatible (same type)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const type1 = getUnitType(unit1);
  const type2 = getUnitType(unit2);
  
  if (!type1 || !type2) return false;
  return type1 === type2;
}

/**
 * Normalize quantity to base unit (g, ml, or unit)
 * This is used for aggregation and deduplication
 */
export function normalizeToBaseUnit(
  quantity: number,
  unit: string
): { quantity: number; unit: string } {
  // Handle missing or invalid unit
  if (!unit || typeof unit !== 'string') {
    return { quantity, unit: unit || '' };
  }
  
  const unitInfo = getUnitInfo(unit);
  
  if (!unitInfo) {
    // Unknown unit, return as-is
    return { quantity, unit };
  }
  
  return {
    quantity: quantity * unitInfo.toBase,
    unit: unitInfo.baseUnit,
  };
}

/**
 * Convert quantity between compatible units
 * Returns original quantity if conversion is not possible
 */
export function convertUnit(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number {
  // If units match, no conversion needed
  const fromNormalized = fromUnit.toLowerCase().trim();
  const toNormalized = toUnit.toLowerCase().trim();
  
  if (fromNormalized === toNormalized) {
    return quantity;
  }
  
  // Check if units are compatible
  if (!areUnitsCompatible(fromUnit, toUnit)) {
    console.warn(`Cannot convert between incompatible units: ${fromUnit} -> ${toUnit}`);
    return quantity; // Return original if conversion not possible
  }
  
  // Convert to base unit, then to target unit
  const fromInfo = getUnitInfo(fromUnit);
  const toInfo = getUnitInfo(toUnit);
  
  if (!fromInfo || !toInfo) {
    return quantity;
  }
  
  // Convert to base unit
  const baseQuantity = quantity * fromInfo.toBase;
  
  // Convert from base to target unit
  const targetQuantity = baseQuantity / toInfo.toBase;
  
  return targetQuantity;
}

/**
 * Format quantity for display (e.g., convert 1000g to 1kg, 1000ml to 1L)
 * This is display-only and should NOT affect data storage or API calls
 */
export function formatForDisplay(
  quantity: number,
  unit: string
): { quantity: number; unit: string } {
  const unitInfo = getUnitInfo(unit);
  
  if (!unitInfo) {
    return { quantity, unit };
  }
  
  // Convert large quantities to larger units for readability
  if (unitInfo.baseUnit === 'g' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'kg' };
  }
  
  if (unitInfo.baseUnit === 'ml' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'L' };
  }
  
  return { quantity, unit };
}

/**
 * Validate if a unit string is recognized
 */
export function isValidUnit(unit: string): boolean {
  return getUnitInfo(unit) !== undefined;
}

/**
 * Get the base unit for a given unit
 * e.g., kg -> g, L -> ml, tbsp -> ml
 */
export function getBaseUnit(unit: string): string {
  const info = getUnitInfo(unit);
  return info?.baseUnit || unit;
}

/**
 * Calculate how many packs are needed given quantity and pack size
 * Assumes both are in the same unit or compatible units
 */
export function calculatePacksNeeded(
  quantityNeeded: number,
  quantityUnit: string,
  packSize: number,
  packUnit: string,
  packSizeMultiplier: number = 1.5
): number {
  // Convert quantityNeeded to pack's unit
  const convertedQuantity = convertUnit(quantityNeeded, quantityUnit, packUnit);
  
  // If quantity fits in single pack
  if (convertedQuantity <= packSize) {
    return 1;
  }
  
  // If quantity > multiplier × pack size, buy multiple packs
  if (convertedQuantity > packSize * packSizeMultiplier) {
    return Math.ceil(convertedQuantity / packSize);
  }
  
  // Otherwise, buy single larger pack (user can choose)
  return 1;
}

/**
 * Estimate weight in grams for count-based units
 * Used for category pricing when we need to convert "2 onions" to weight
 */
export const AVERAGE_ITEM_WEIGHTS: Record<string, number> = {
  // Vegetables (grams)
  'onion': 150,
  'onions': 150,
  'tomato': 125,
  'tomatoes': 125,
  'potato': 200,
  'potatoes': 200,
  'carrot': 100,
  'carrots': 100,
  'zucchini': 200,
  'capsicum': 150,
  'bell pepper': 150,
  'avocado': 180,
  'avocados': 180,
  'lemon': 100,
  'lemons': 100,
  'lime': 50,
  'limes': 50,
  
  // Proteins (grams)
  'chicken breast': 250,
  'chicken thigh': 150,
  'egg': 50,
  'eggs': 50,
  
  // Herbs (grams per bunch)
  'parsley': 35,
  'coriander': 35,
  'basil': 35,
  'mint': 35,
  'thyme': 20,
  'rosemary': 20,
  
  // Bakery (grams)
  'bread': 450,
  'loaf': 450,
  'roll': 50,
  'rolls': 50,
  
  // Default fallback
  'default': 100,
};

/**
 * Estimate weight for count-based ingredients
 * Useful for pricing when we need to convert "2 onions" to grams
 */
export function estimateWeightFromCount(
  ingredientName: string,
  count: number
): number {
  const normalized = ingredientName.toLowerCase().trim();
  
  // Try to find a match in average weights
  for (const [key, weight] of Object.entries(AVERAGE_ITEM_WEIGHTS)) {
    if (normalized.includes(key)) {
      return count * weight;
    }
  }
  
  // Default fallback
  return count * AVERAGE_ITEM_WEIGHTS['default'];
}

/**
 * Convert any quantity to grams for standardized pricing calculations
 * Handles weight, volume (assumes 1ml = 1g for most liquids), and count units
 */
export function convertToGrams(
  quantity: number,
  unit: string,
  ingredientName?: string
): number {
  const unitInfo = getUnitInfo(unit);
  
  if (!unitInfo) {
    // Unknown unit, assume it's grams
    return quantity;
  }
  
  switch (unitInfo.type) {
    case UnitType.WEIGHT:
      // Convert to base unit (grams)
      return normalizeToBaseUnit(quantity, unit).quantity;
      
    case UnitType.VOLUME:
      // Convert to ml first, then assume 1ml ≈ 1g
      // This is a simplification but works for most cooking liquids
      return normalizeToBaseUnit(quantity, unit).quantity;
      
    case UnitType.COUNT:
      // Estimate weight based on ingredient name
      if (ingredientName) {
        return estimateWeightFromCount(ingredientName, quantity);
      }
      // Default fallback: 100g per unit
      return quantity * 100;
      
    default:
      return quantity;
  }
}
