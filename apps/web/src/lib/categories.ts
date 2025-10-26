// Coles grocery store aisle mapping for Australian shoppers
export const GROCERY_CATEGORIES = {
  "Produce": {
    displayName: "Fresh Produce",
    aisleNumber: 1,
    description: "Fresh fruits, vegetables, herbs"
  },
  "Meat & Seafood": {
    displayName: "Meat & Seafood",
    aisleNumber: 2,
    description: "Fresh and frozen meat, poultry, seafood"
  },
  "Dairy": {
    displayName: "Dairy & Eggs",
    aisleNumber: 3,
    description: "Milk, cheese, yogurt, eggs, butter"
  },
  "Bakery": {
    displayName: "Bakery",
    aisleNumber: 4,
    description: "Fresh bread, pastries, cakes"
  },
  "Pantry": {
    displayName: "Pantry Staples",
    aisleNumber: 5,
    description: "Pasta, rice, oils, canned goods, spices"
  },
  "Frozen": {
    displayName: "Frozen Foods",
    aisleNumber: 6,
    description: "Frozen vegetables, meals, ice cream"
  },
  "Health & Beauty": {
    displayName: "Health & Beauty",
    aisleNumber: 7,
    description: "Personal care, vitamins, pharmacy"
  },
  "Household": {
    displayName: "Household",
    aisleNumber: 8,
    description: "Cleaning supplies, paper products"
  }
} as const;

export type CategoryKey = keyof typeof GROCERY_CATEGORIES;

export function getCategoryInfo(categoryKey: string) {
  return GROCERY_CATEGORIES[categoryKey as CategoryKey] || {
    displayName: categoryKey,
    aisleNumber: 99,
    description: "Other items"
  };
}

export function sortCategoriesByAisle(categories: string[]): string[] {
  return categories.sort((a, b) => {
    const aisleA = getCategoryInfo(a).aisleNumber;
    const aisleB = getCategoryInfo(b).aisleNumber;
    return aisleA - aisleB;
  });
}