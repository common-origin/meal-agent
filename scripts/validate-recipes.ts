#!/usr/bin/env tsx
/**
 * Recipe Validation Script
 * 
 * Validates the integrity of generated recipes to catch issues early.
 * Run this as part of the build process to ensure recipe data quality.
 * 
 * Checks:
 * - No duplicate recipe IDs
 * - All required fields present
 * - Valid URLs
 * - Valid time values
 * - Valid serving counts
 * - Non-empty titles
 * - Valid tags and ingredients arrays
 */

import { readFileSync } from "fs";
import { join } from "path";

interface ValidationError {
  recipeId?: string;
  field: string;
  issue: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  recipesChecked: number;
}

interface Recipe {
  id: string;
  title: string;
  source: {
    url: string;
    domain: string;
    chef: string;
    license: string;
    image?: string;
    fetchedAt: string;
  };
  timeMins?: number;
  tags: string[];
  ingredients: Array<{
    name: string;
    qty: number;
    unit: string;
  }>;
  serves?: number;
  costPerServeEst?: number;
}

/**
 * Validate generated recipes
 */
function validateRecipes(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    recipesChecked: 0
  };

  // Load generated recipes
  const recipesPath = join(__dirname, "../apps/web/src/lib/recipes.generated.json");
  
  let recipes: Recipe[];
  try {
    const content = readFileSync(recipesPath, "utf-8");
    recipes = JSON.parse(content);
  } catch (error) {
    result.errors.push({
      field: "file",
      issue: `Failed to load recipes.generated.json: ${error}`
    });
    result.valid = false;
    return result;
  }

  if (!Array.isArray(recipes)) {
    result.errors.push({
      field: "file",
      issue: "recipes.generated.json must contain an array of recipes"
    });
    result.valid = false;
    return result;
  }

  result.recipesChecked = recipes.length;

  // Check for duplicate IDs
  const idCounts = new Map<string, number>();
  recipes.forEach(recipe => {
    const count = idCounts.get(recipe.id) || 0;
    idCounts.set(recipe.id, count + 1);
  });

  idCounts.forEach((count, id) => {
    if (count > 1) {
      result.errors.push({
        recipeId: id,
        field: "id",
        issue: `Duplicate recipe ID found ${count} times`
      });
      result.valid = false;
    }
  });

  // Validate each recipe
  recipes.forEach(recipe => {
    validateRecipe(recipe, result);
  });

  return result;
}

/**
 * Validate a single recipe
 */
function validateRecipe(recipe: Recipe, result: ValidationResult): void {
  const recipeId = recipe.id || "unknown";

  // Required field: id
  if (!recipe.id || typeof recipe.id !== "string" || recipe.id.trim() === "") {
    result.errors.push({
      recipeId,
      field: "id",
      issue: "Recipe ID is required and must be a non-empty string"
    });
    result.valid = false;
  }

  // Required field: title
  if (!recipe.title || typeof recipe.title !== "string" || recipe.title.trim() === "") {
    result.errors.push({
      recipeId,
      field: "title",
      issue: "Recipe title is required and must be a non-empty string"
    });
    result.valid = false;
  }

  // Required field: source
  if (!recipe.source || typeof recipe.source !== "object") {
    result.errors.push({
      recipeId,
      field: "source",
      issue: "Recipe source is required and must be an object"
    });
    result.valid = false;
  } else {
    // Validate source.url
    if (!recipe.source.url || typeof recipe.source.url !== "string") {
      result.errors.push({
        recipeId,
        field: "source.url",
        issue: "Source URL is required and must be a string"
      });
      result.valid = false;
    } else if (!recipe.source.url.match(/^https?:\/\/.+/)) {
      result.errors.push({
        recipeId,
        field: "source.url",
        issue: `Invalid URL format: ${recipe.source.url}`
      });
      result.valid = false;
    }

    // Validate source.domain
    if (!recipe.source.domain || typeof recipe.source.domain !== "string") {
      result.errors.push({
        recipeId,
        field: "source.domain",
        issue: "Source domain is required"
      });
      result.valid = false;
    }

    // Validate source.chef
    if (!recipe.source.chef || typeof recipe.source.chef !== "string") {
      result.errors.push({
        recipeId,
        field: "source.chef",
        issue: "Source chef is required"
      });
      result.valid = false;
    }

    // Validate source.license
    if (!recipe.source.license || typeof recipe.source.license !== "string") {
      result.errors.push({
        recipeId,
        field: "source.license",
        issue: "Source license is required"
      });
      result.valid = false;
    }

    // Validate source.fetchedAt
    if (!recipe.source.fetchedAt || typeof recipe.source.fetchedAt !== "string") {
      result.errors.push({
        recipeId,
        field: "source.fetchedAt",
        issue: "Source fetchedAt timestamp is required"
      });
      result.valid = false;
    }
  }

  // Optional field: timeMins (but must be valid if present)
  if (recipe.timeMins !== undefined) {
    if (typeof recipe.timeMins !== "number" || recipe.timeMins < 0) {
      result.errors.push({
        recipeId,
        field: "timeMins",
        issue: `Invalid time: ${recipe.timeMins}. Must be a non-negative number`
      });
      result.valid = false;
    }
    
    if (recipe.timeMins > 240) {
      result.warnings.push({
        recipeId,
        field: "timeMins",
        issue: `Very long recipe: ${recipe.timeMins} minutes (${(recipe.timeMins / 60).toFixed(1)} hours)`
      });
    }
  }

  // Required field: tags
  if (!Array.isArray(recipe.tags)) {
    result.errors.push({
      recipeId,
      field: "tags",
      issue: "Tags must be an array"
    });
    result.valid = false;
  } else if (recipe.tags.length === 0) {
    result.warnings.push({
      recipeId,
      field: "tags",
      issue: "Recipe has no tags (consider adding for better filtering)"
    });
  }

  // Required field: ingredients
  if (!Array.isArray(recipe.ingredients)) {
    result.errors.push({
      recipeId,
      field: "ingredients",
      issue: "Ingredients must be an array"
    });
    result.valid = false;
  } else if (recipe.ingredients.length === 0) {
    result.errors.push({
      recipeId,
      field: "ingredients",
      issue: "Recipe must have at least one ingredient"
    });
    result.valid = false;
  } else {
    // Validate each ingredient
    recipe.ingredients.forEach((ingredient, index) => {
      if (!ingredient.name || typeof ingredient.name !== "string") {
        result.errors.push({
          recipeId,
          field: `ingredients[${index}].name`,
          issue: "Ingredient name is required"
        });
        result.valid = false;
      }

      if (typeof ingredient.qty !== "number" || ingredient.qty < 0) {
        result.errors.push({
          recipeId,
          field: `ingredients[${index}].qty`,
          issue: `Invalid quantity: ${ingredient.qty}`
        });
        result.valid = false;
      }

      if (!ingredient.unit || typeof ingredient.unit !== "string") {
        result.errors.push({
          recipeId,
          field: `ingredients[${index}].unit`,
          issue: "Ingredient unit is required"
        });
        result.valid = false;
      }
    });
  }

  // Optional field: serves (but must be valid if present)
  if (recipe.serves !== undefined) {
    if (typeof recipe.serves !== "number" || recipe.serves <= 0 || !Number.isInteger(recipe.serves)) {
      result.errors.push({
        recipeId,
        field: "serves",
        issue: `Invalid serves value: ${recipe.serves}. Must be a positive integer`
      });
      result.valid = false;
    }
  }

  // Optional field: costPerServeEst (but must be valid if present)
  if (recipe.costPerServeEst !== undefined) {
    if (typeof recipe.costPerServeEst !== "number" || recipe.costPerServeEst < 0) {
      result.errors.push({
        recipeId,
        field: "costPerServeEst",
        issue: `Invalid cost estimate: ${recipe.costPerServeEst}`
      });
      result.valid = false;
    }
  }
}

/**
 * Print validation results
 */
function printResults(result: ValidationResult): void {
  console.log("\n📋 Recipe Validation Report");
  console.log("━".repeat(60));
  console.log(`Recipes checked: ${result.recipesChecked}`);
  console.log(`Errors: ${result.errors.length}`);
  console.log(`Warnings: ${result.warnings.length}`);
  console.log(`Status: ${result.valid ? "✅ PASS" : "❌ FAIL"}`);
  console.log("━".repeat(60));

  if (result.errors.length > 0) {
    console.log("\n❌ Errors:");
    result.errors.forEach(error => {
      const recipePrefix = error.recipeId ? `[${error.recipeId}] ` : "";
      console.log(`  ${recipePrefix}${error.field}: ${error.issue}`);
    });
  }

  if (result.warnings.length > 0) {
    console.log("\n⚠️  Warnings:");
    result.warnings.forEach(warning => {
      const recipePrefix = warning.recipeId ? `[${warning.recipeId}] ` : "";
      console.log(`  ${recipePrefix}${warning.field}: ${warning.issue}`);
    });
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    console.log("\n✨ All recipes are valid! No issues found.");
  }

  console.log();
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Validating recipe data...\n");
  
  const result = validateRecipes();
  printResults(result);

  // Exit with non-zero code if validation failed
  if (!result.valid) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { validateRecipes, ValidationResult };
