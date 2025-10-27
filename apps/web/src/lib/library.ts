import type { Recipe, Ingredient } from "./types/recipe";
import fs from "fs";
import path from "path";

// Indexed recipe format (JSON-LD from data/library/)
interface IndexedRecipe {
  id: string;
  sourceUrl: string;
  chef: string;
  domain: string;
  indexedAt: string;
  recipe: {
    "@type": string;
    name?: string;
    recipeCategory?: string | string[];
    totalTime?: string;
    prepTime?: string;
    cookTime?: string;
    recipeYield?: string | number;
    recipeIngredient?: string[];
    recipeInstructions?: unknown;
    nutrition?: unknown;
    [key: string]: unknown;
  };
}

// Library search interface (same as MockLibrary for compatibility)
export interface LibrarySearchOptions {
  chef?: string;
  tags?: string[];
  maxTime?: number;
  excludeIds?: string[];
  limit?: number;
}

/**
 * Real Recipe Library
 * Loads indexed recipes from data/library/ directory
 */
export class RecipeLibrary {
  private static recipes: Recipe[] | null = null;

  /**
   * Load all indexed recipes from filesystem
   */
  static loadAll(): Recipe[] {
    if (this.recipes) return this.recipes;

    try {
      // Path to recipe library (relative to web app root)
      const libraryPath = path.join(process.cwd(), "../../data/library");
      
      if (!fs.existsSync(libraryPath)) {
        console.warn(`Recipe library not found at ${libraryPath}`);
        return [];
      }

      const chefs = fs.readdirSync(libraryPath).filter(item => {
        const itemPath = path.join(libraryPath, item);
        return fs.statSync(itemPath).isDirectory();
      });

      this.recipes = chefs.flatMap(chef => {
        const chefPath = path.join(libraryPath, chef);
        const files = fs.readdirSync(chefPath).filter(f => f.endsWith('.json'));

        return files.map(file => {
          try {
            const content = fs.readFileSync(path.join(chefPath, file), 'utf-8');
            const data = JSON.parse(content);
            return this.convertToAppFormat(data);
          } catch (error) {
            console.error(`Error loading ${chef}/${file}:`, error);
            return null;
          }
        }).filter((recipe): recipe is Recipe => recipe !== null);
      });

      console.log(`✓ Loaded ${this.recipes.length} recipes from library`);
      return this.recipes;
    } catch (error) {
      console.error("Error loading recipe library:", error);
      return [];
    }
  }

  /**
   * Convert indexed JSON-LD format to app Recipe type
   */
  private static convertToAppFormat(indexed: IndexedRecipe): Recipe {
    const recipe = indexed.recipe;
    
    return {
      id: indexed.id,
      title: recipe.name || "Untitled Recipe",
      source: {
        url: indexed.sourceUrl,
        domain: indexed.domain,
        chef: this.normalizeChefName(indexed.chef),
        license: 'permitted',
        fetchedAt: indexed.indexedAt
      },
      timeMins: this.parseDuration(recipe.totalTime),
      serves: this.parseServings(recipe.recipeYield),
      tags: this.extractTags(recipe),
      ingredients: this.parseIngredients(recipe.recipeIngredient || []),
      costPerServeEst: this.estimateCost(recipe)
    };
  }

  /**
   * Normalize chef names to app format
   */
  private static normalizeChefName(chef: string): 'jamie_oliver' | 'recipe_tin_eats' {
    if (chef === 'nagi') return 'recipe_tin_eats';
    if (chef === 'jamie-oliver') return 'jamie_oliver';
    return 'recipe_tin_eats'; // Default fallback
  }

  /**
   * Parse ISO 8601 duration (PT45M, PT1H30M) to minutes
   */
  private static parseDuration(duration?: string): number | undefined {
    if (!duration) return undefined;
    
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return undefined;
    
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    return hours * 60 + minutes;
  }

  /**
   * Parse recipe yield/servings
   */
  private static parseServings(recipeYield?: string | number): number {
    if (!recipeYield) return 4; // Default
    
    if (typeof recipeYield === 'number') return recipeYield;
    
    // Extract number from strings like "4 servings", "Serves 6", etc.
    const match = recipeYield.match(/\d+/);
    return match ? parseInt(match[0], 10) : 4;
  }

  /**
   * Extract tags from recipe metadata
   */
  private static extractTags(recipe: IndexedRecipe['recipe']): string[] {
    const tags: string[] = [];
    
    // From recipeCategory
    if (recipe.recipeCategory) {
      const categories = Array.isArray(recipe.recipeCategory) 
        ? recipe.recipeCategory 
        : [recipe.recipeCategory];
      
      categories.forEach((cat: string) => {
        const normalized = cat.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        tags.push(normalized);
      });
    }
    
    // Add time-based tags
    const timeMins = this.parseDuration(recipe.totalTime);
    if (timeMins) {
      if (timeMins <= 30) tags.push('quick');
      if (timeMins <= 40) tags.push('kid_friendly');
      if (timeMins >= 60) tags.push('bulk_cook');
    }
    
    // Extract protein type from ingredients
    const ingredients = recipe.recipeIngredient || [];
    const ingredientsStr = ingredients.join(' ').toLowerCase();
    
    if (ingredientsStr.includes('chicken')) tags.push('chicken');
    if (ingredientsStr.includes('beef') || ingredientsStr.includes('steak')) tags.push('beef');
    if (ingredientsStr.includes('pork')) tags.push('pork');
    if (ingredientsStr.includes('fish') || ingredientsStr.includes('salmon')) tags.push('fish');
    if (ingredientsStr.includes('pasta') || ingredientsStr.includes('spaghetti')) tags.push('pasta');
    
    // Check for vegetarian (no meat keywords)
    const hasMeat = ['chicken', 'beef', 'pork', 'fish', 'lamb', 'turkey'].some(
      meat => ingredientsStr.includes(meat)
    );
    if (!hasMeat) tags.push('vegetarian');
    
    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Parse ingredient strings to structured format
   */
  private static parseIngredients(ingredientStrs: string[]): Ingredient[] {
    return ingredientStrs.map(str => this.parseIngredient(str));
  }

  /**
   * Parse single ingredient string
   * Examples: "500g chicken breast", "2 cups flour", "1 onion"
   */
  private static parseIngredient(ingredientStr: string): Ingredient {
    // Try to extract quantity, unit, and name
    // Pattern: number + optional unit + ingredient name
    const match = ingredientStr.match(/^(\d+(?:\.\d+)?|\d+\/\d+)\s*([a-zA-Z]+)?\s+(.+)$/i);
    
    if (match) {
      const qtyStr = match[1];
      const unit = match[2]?.toLowerCase() || 'unit';
      const name = match[3];
      
      // Parse fraction quantities (1/2 cup)
      let qty: number;
      if (qtyStr.includes('/')) {
        const [num, denom] = qtyStr.split('/').map(Number);
        qty = num / denom;
      } else {
        qty = parseFloat(qtyStr);
      }
      
      // Normalize units
      const normalizedUnit = this.normalizeUnit(unit);
      
      return {
        name: name.trim(),
        qty,
        unit: normalizedUnit
      };
    }
    
    // If no pattern match, treat as single unit item
    return {
      name: ingredientStr.trim(),
      qty: 1,
      unit: 'unit'
    };
  }

  /**
   * Normalize units to app standard
   */
  private static normalizeUnit(unit: string): Ingredient['unit'] {
    const unitMap: Record<string, Ingredient['unit']> = {
      'g': 'g',
      'gram': 'g',
      'grams': 'g',
      'kg': 'g', // Convert to grams
      'ml': 'ml',
      'milliliter': 'ml',
      'milliliters': 'ml',
      'l': 'ml', // Convert to ml
      'liter': 'ml',
      'cup': 'ml',
      'cups': 'ml',
      'tsp': 'tsp',
      'teaspoon': 'tsp',
      'teaspoons': 'tsp',
      'tbsp': 'tbsp',
      'tablespoon': 'tbsp',
      'tablespoons': 'tbsp',
      'oz': 'g',
      'ounce': 'g',
      'ounces': 'g',
      'lb': 'g',
      'pound': 'g',
      'pounds': 'g'
    };
    
    return unitMap[unit.toLowerCase()] || 'unit';
  }

  /**
   * Estimate cost per serve based on ingredients
   */
  private static estimateCost(recipe: IndexedRecipe['recipe']): number {
    const ingredientCount = recipe.recipeIngredient?.length || 10;
    const serves = this.parseServings(recipe.recipeYield);
    
    // Simple heuristic:
    // Base cost: $2.50/serve
    // Add $0.35 per ingredient
    // Cap between $2.00 and $8.00
    const totalCost = 2.50 + (ingredientCount * 0.35);
    const perServe = totalCost / serves;
    
    return Math.max(2.0, Math.min(8.0, Math.round(perServe * 100) / 100));
  }

  /**
   * Search recipes by various criteria
   */
  static search(options: LibrarySearchOptions = {}): Recipe[] {
    let results = this.loadAll();

    // Filter by chef
    if (options.chef) {
      results = results.filter(r => r.source.chef === options.chef);
    }

    // Filter by tags (must have ALL specified tags)
    if (options.tags && options.tags.length > 0) {
      results = results.filter(r =>
        options.tags!.every(tag => r.tags.includes(tag))
      );
    }

    // Filter by max time
    if (options.maxTime !== undefined) {
      results = results.filter(r => 
        r.timeMins === undefined || r.timeMins <= options.maxTime!
      );
    }

    // Exclude specific IDs
    if (options.excludeIds && options.excludeIds.length > 0) {
      results = results.filter(r => !options.excludeIds!.includes(r.id));
    }

    // Limit results
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get recipe by ID
   */
  static getById(id: string): Recipe | null {
    return this.loadAll().find(r => r.id === id) || null;
  }

  /**
   * Get all recipes
   */
  static getAll(): Recipe[] {
    return this.loadAll();
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    this.recipes = null;
  }
}
