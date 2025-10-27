import type { Recipe } from "./types/recipe";

// Mock recipe library for meal planning
const RECIPE_LIBRARY: Recipe[] = [
  // Quick weeknight meals (≤40m, kid-friendly)
  {
    id: "spaghetti-bolognese",
    title: "Spaghetti Bolognese",
    source: { 
      url: "https://jamieoliver.com/spaghetti-bolognese",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 45,
    serves: 4,
    tags: ["kid_friendly", "pasta", "beef", "italian"],
    ingredients: [
      { name: "Ground beef", qty: 500, unit: "g" },
      { name: "Spaghetti", qty: 400, unit: "g" },
      { name: "Tomatoes", qty: 800, unit: "g" }
    ],
    costPerServeEst: 4.50
  },
  {
    id: "chicken-stir-fry",
    title: "Quick Chicken Stir Fry",
    source: { 
      url: "https://jamieoliver.com/chicken-stir-fry",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 25,
    serves: 4,
    tags: ["kid_friendly", "quick", "chicken", "asian"],
    ingredients: [
      { name: "Chicken breast", qty: 600, unit: "g" },
      { name: "Vegetables", qty: 500, unit: "g" },
      { name: "Rice", qty: 300, unit: "g" }
    ],
    costPerServeEst: 4.00
  },
  {
    id: "fish-and-chips",
    title: "Fish and Chips",
    source: { 
      url: "https://recipetineats.com/fish-and-chips",
      domain: "recipetineats.com",
      chef: "recipe_tin_eats",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 40,
    serves: 4,
    tags: ["kid_friendly", "quick", "fish"],
    ingredients: [
      { name: "Fish fillets", qty: 800, unit: "g" },
      { name: "Potatoes", qty: 1000, unit: "g" },
      { name: "Flour", qty: 200, unit: "g" }
    ],
    costPerServeEst: 5.50
  },
  {
    id: "veggie-pasta-primavera",
    title: "Veggie Pasta Primavera",
    source: { 
      url: "https://jamieoliver.com/pasta-primavera",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 25,
    serves: 4,
    tags: ["kid_friendly", "quick", "vegetarian", "pasta"],
    ingredients: [
      { name: "Pasta", qty: 400, unit: "g" },
      { name: "Vegetables", qty: 600, unit: "g" },
      { name: "Olive oil", qty: 50, unit: "ml" }
    ],
    costPerServeEst: 3.00
  },
  {
    id: "beef-tacos",
    title: "Easy Beef Tacos",
    source: { 
      url: "https://jamieoliver.com/beef-tacos",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 30,
    serves: 4,
    tags: ["kid_friendly", "quick", "beef", "mexican"],
    ingredients: [
      { name: "Ground beef", qty: 500, unit: "g" },
      { name: "Taco shells", qty: 12, unit: "unit" },
      { name: "Cheese", qty: 200, unit: "g" }
    ],
    costPerServeEst: 3.75
  },

  // Weekend/special meals (>40m or more complex)
  {
    id: "chicken-tikka-masala",
    title: "Chicken Tikka Masala",
    source: { 
      url: "https://recipetineats.com/chicken-tikka-masala",
      domain: "recipetineats.com",
      chef: "recipe_tin_eats",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 60,
    serves: 6,
    tags: ["bulk_cook", "chicken", "indian"],
    ingredients: [
      { name: "Chicken thighs", qty: 1000, unit: "g" },
      { name: "Yogurt", qty: 200, unit: "ml" },
      { name: "Rice", qty: 400, unit: "g" }
    ],
    costPerServeEst: 3.30
  },
  {
    id: "roast-chicken",
    title: "Classic Roast Chicken",
    source: { 
      url: "https://jamieoliver.com/roast-chicken",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 90,
    serves: 6,
    tags: ["chicken", "roast", "bulk_cook"],
    ingredients: [
      { name: "Whole chicken", qty: 1800, unit: "g" },
      { name: "Potatoes", qty: 1000, unit: "g" },
      { name: "Carrots", qty: 500, unit: "g" }
    ],
    costPerServeEst: 4.00
  },
  {
    id: "pork-chops",
    title: "Pork Chops with Apples",
    source: { 
      url: "https://jamieoliver.com/pork-chops",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 35,
    serves: 4,
    tags: ["quick", "pork"],
    ingredients: [
      { name: "Pork chops", qty: 4, unit: "unit" },
      { name: "Apples", qty: 3, unit: "unit" },
      { name: "Cream", qty: 100, unit: "ml" }
    ],
    costPerServeEst: 4.75
  },
  {
    id: "shakshuka",
    title: "Shakshuka",
    source: { 
      url: "https://recipetineats.com/shakshuka",
      domain: "recipetineats.com",
      chef: "recipe_tin_eats",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 30,
    serves: 4,
    tags: ["quick", "vegetarian", "budget"],
    ingredients: [
      { name: "Eggs", qty: 8, unit: "unit" },
      { name: "Tomatoes", qty: 600, unit: "g" },
      { name: "Peppers", qty: 2, unit: "unit" }
    ],
    costPerServeEst: 2.25
  },
  {
    id: "salmon-bake",
    title: "Mediterranean Baked Salmon",
    source: { 
      url: "https://jamieoliver.com/salmon",
      domain: "jamieoliver.com",
      chef: "jamie_oliver",
      license: "permitted",
      fetchedAt: "2025-01-15"
    },
    timeMins: 35,
    serves: 4,
    tags: ["quick", "fish", "healthy"],
    ingredients: [
      { name: "Salmon fillets", qty: 800, unit: "g" },
      { name: "Tomatoes", qty: 300, unit: "g" },
      { name: "Olives", qty: 100, unit: "g" }
    ],
    costPerServeEst: 7.00
  }
];

// Library search interface
export interface LibrarySearchOptions {
  tags?: string[];
  maxTime?: number;
  chef?: 'jamie_oliver' | 'recipe_tin_eats';
  excludeIds?: string[];
  limit?: number;
}

export class MockLibrary {
  /**
   * Search recipes by various criteria
   */
  static search(options: LibrarySearchOptions = {}): Recipe[] {
    let results = [...RECIPE_LIBRARY];

    // Filter by tags (must have ALL specified tags)
    if (options.tags && options.tags.length > 0) {
      results = results.filter(recipe =>
        options.tags!.every(tag => recipe.tags.includes(tag))
      );
    }

    // Filter by max time
    if (options.maxTime !== undefined) {
      results = results.filter(recipe => 
        recipe.timeMins ? recipe.timeMins <= options.maxTime! : false
      );
    }

    // Filter by chef
    if (options.chef) {
      results = results.filter(recipe => recipe.source.chef === options.chef);
    }

    // Exclude specific IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      results = results.filter(recipe => !options.excludeIds!.includes(recipe.id));
    }

    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get a recipe by ID
   */
  static getById(id: string): Recipe | null {
    return RECIPE_LIBRARY.find(recipe => recipe.id === id) || null;
  }

  /**
   * Get all recipes
   */
  static getAll(): Recipe[] {
    return [...RECIPE_LIBRARY];
  }

  /**
   * Get recipes by multiple IDs
   */
  static getByIds(ids: string[]): Recipe[] {
    return RECIPE_LIBRARY.filter(recipe => ids.includes(recipe.id));
  }
}
