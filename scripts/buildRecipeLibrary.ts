/**
 * Build-time script to generate static recipe library
 * Runs during build to convert indexed recipes to app format
 */
import fs from "fs";
import path from "path";

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
    recipeYield?: string | number | string[];
    recipeIngredient?: string[];
    recipeInstructions?: unknown;
    nutrition?: unknown;
    [key: string]: unknown;
  };
}

interface Recipe {
  id: string;
  title: string;
  source: {
    url: string;
    domain: string;
    chef: 'jamie_oliver' | 'recipe_tin_eats';
    license: 'permitted';
    fetchedAt: string;
  };
  timeMins: number;
  serves: number;
  tags: string[];
  ingredients: Array<{
    qty?: number;
    unit?: string;
    name: string;
  }>;
  costPerServeEst: number;
}

function normalizeChefName(chef: string): 'jamie_oliver' | 'recipe_tin_eats' {
  if (chef === 'nagi') return 'recipe_tin_eats';
  if (chef === 'jamie-oliver') return 'jamie_oliver';
  return 'recipe_tin_eats';
}

function parseDuration(duration?: string): number {
  if (!duration) return 30;
  
  const hourMatch = duration.match(/(\d+)H/);
  const minMatch = duration.match(/(\d+)M/);
  
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
  const minutes = minMatch ? parseInt(minMatch[1]) : 0;
  
  return hours * 60 + minutes || 30;
}

function parseServings(yield_?: string | number | string[]): number {
  if (typeof yield_ === 'number') return yield_;
  if (!yield_) return 4;
  
  // Handle array (take first element)
  if (Array.isArray(yield_)) {
    const first = yield_[0];
    if (!first) return 4;
    const match = String(first).match(/(\d+)/);
    return match ? parseInt(match[1]) : 4;
  }
  
  // Handle string
  const match = String(yield_).match(/(\d+)/);
  return match ? parseInt(match[1]) : 4;
}

function extractTags(recipe: IndexedRecipe['recipe']): string[] {
  const tags: string[] = [];
  
  if (recipe.recipeCategory) {
    const categories = Array.isArray(recipe.recipeCategory) 
      ? recipe.recipeCategory 
      : [recipe.recipeCategory];
    
    categories.forEach((cat: string) => {
      const normalized = cat.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      tags.push(normalized);
    });
  }
  
  const time = parseDuration(recipe.totalTime);
  if (time <= 40) tags.push('quick');
  
  const ingredientCount = recipe.recipeIngredient?.length || 0;
  if (ingredientCount <= 12) tags.push('simple');
  
  return tags;
}

function parseIngredients(ingredientList?: string[]): Array<{qty?: number; unit?: string; name: string}> {
  if (!ingredientList || ingredientList.length === 0) {
    return [{ name: 'See source recipe for ingredients' }];
  }

  return ingredientList.map(ing => {
    const qtyMatch = ing.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*([a-zA-Z]+)?\s+(.+)/);
    
    if (qtyMatch) {
      const [, qty, unit, name] = qtyMatch;
      return {
        qty: parseFloat(qty),
        unit: unit || undefined,
        name: name.trim()
      };
    }
    
    return { name: ing };
  });
}

function estimateCost(recipe: IndexedRecipe['recipe']): number {
  const ingredientCount = recipe.recipeIngredient?.length || 10;
  const serves = parseServings(recipe.recipeYield);
  
  const totalCost = 2.50 + (ingredientCount * 0.35);
  const perServe = totalCost / serves;
  
  return Math.max(2.0, Math.min(8.0, Math.round(perServe * 100) / 100));
}

function convertToAppFormat(indexed: IndexedRecipe): Recipe {
  const recipe = indexed.recipe;
  
  return {
    id: indexed.id,
    title: recipe.name || "Untitled Recipe",
    source: {
      url: indexed.sourceUrl,
      domain: indexed.domain,
      chef: normalizeChefName(indexed.chef),
      license: 'permitted',
      fetchedAt: indexed.indexedAt
    },
    timeMins: parseDuration(recipe.totalTime),
    serves: parseServings(recipe.recipeYield),
    tags: extractTags(recipe),
    ingredients: parseIngredients(recipe.recipeIngredient || []),
    costPerServeEst: estimateCost(recipe)
  };
}

// Main build function
function buildRecipeLibrary() {
  const libraryPath = path.join(process.cwd(), "data/library");
  const outputPath = path.join(process.cwd(), "apps/web/src/lib/recipes.generated.json");

  if (!fs.existsSync(libraryPath)) {
    console.error(`❌ Recipe library not found at ${libraryPath}`);
    process.exit(1);
  }

  const recipes: Recipe[] = [];

  const chefs = fs.readdirSync(libraryPath).filter(item => {
    const itemPath = path.join(libraryPath, item);
    return fs.statSync(itemPath).isDirectory();
  });

  chefs.forEach(chef => {
    const chefPath = path.join(libraryPath, chef);
    const files = fs.readdirSync(chefPath).filter(f => f.endsWith('.json'));

    files.forEach(file => {
      try {
        const content = fs.readFileSync(path.join(chefPath, file), 'utf-8');
        const indexed: IndexedRecipe = JSON.parse(content);
        const recipe = convertToAppFormat(indexed);
        recipes.push(recipe);
      } catch (error) {
        console.warn(`⚠️  Failed to process ${chef}/${file}:`, error);
      }
    });
  });

  // Write to output file
  fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));

  console.log(`✅ Built recipe library: ${recipes.length} recipes`);
  console.log(`   Output: ${outputPath}`);
}

// Run build
buildRecipeLibrary();
