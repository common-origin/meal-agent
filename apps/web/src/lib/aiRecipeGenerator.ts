/**
 * AI Recipe Generator using Google Gemini
 * 
 * This service handles communication with the Gemini API to generate
 * personalized recipe suggestions based on family settings.
 */

import type { Recipe } from './types/recipe';
import type { RecipeGenerationRequest } from './prompts/recipeGeneration';
import { buildSystemPrompt, buildRecipeGenerationPrompt } from './prompts/recipeGeneration';
import { runAiTask } from './ai/run';
import type { AiTaskResult } from './ai/run';
import type { z } from 'zod';
import { GeneratedRecipes } from './ai/schemas';
import { toRecipe } from './ai/normalizeRecipe';
import { findAllergenConflicts, type AllergenConflict } from './allergens';

export interface GeneratedRecipeResponse {
  recipes: Recipe[];
  /**
   * Recipe ID → one line on why it suits this household this week (#94).
   * Belongs to the week's plan, not the recipe, so it isn't on Recipe.
   */
  explanations: Record<string, string>;
}

/** Words the prompt bans in "whyThisMeal" (#94); a line that uses one anyway is dropped. */
const BANNED_EXPLANATION_WORDS = /\b(delicious|personali[sz]ed|perfect|AI)\b/i;

/** The model's line, tidied, or undefined if it breaks the prompt's word rule. */
export function cleanExplanation(text: string): string | undefined {
  const line = text.replace(/\s+/g, ' ').trim();
  return line && !BANNED_EXPLANATION_WORDS.test(line) ? line : undefined;
}

/** The model withheld its answer (safety and so on); there are no recipes. */
export interface GenerationBlocked {
  blocked: true;
  rawFinishReason: string | undefined;
}

/**
 * Every recipe the model returned used one of the household's allergies,
 * even after a retry that named them. There are no recipes to show.
 */
export interface GenerationAllergenConflict {
  allergenConflict: true;
  conflicts: AllergenConflict[];
}

/** Attempts in all, counting the first: one retry after an allergen slips through. */
const ALLERGEN_ATTEMPTS = 2;

/** The note added to a retry's prompt, naming what the last answer got wrong. */
export function allergenRetryNote(conflicts: AllergenConflict[]): string {
  const uses = conflicts.map((c) => `${c.ingredient} (${c.allergy})`).join(', ');
  return `\n\nIMPORTANT: Your previous answer used ${uses}, which this household is allergic to. ` +
    'Every ingredient, including sauces, pastes, stocks and garnishes, must be free of these allergens.';
}

/**
 * Generate recipes. AI failures (timeout, invalid output, provider errors)
 * are thrown as AiTaskError for the route to map to a friendly response (#96).
 */
export async function generateRecipes(
  request: RecipeGenerationRequest,
  /** The signed-in user, for usage logging and the daily AI cap (#85). */
  { userId }: { userId: string }
): Promise<GeneratedRecipeResponse | GenerationBlocked | GenerationAllergenConflict> {
  const system = buildSystemPrompt();
  const basePrompt = buildRecipeGenerationPrompt(request);
  const { allergies } = request.familySettings;

  console.log('🤖 Generating recipes with Gemini...');
  console.log('📝 Request:', {
    numberOfRecipes: request.numberOfRecipes,
    cuisines: request.familySettings.cuisines,
    servings: request.familySettings.totalServings,
  });

  const recipes: Recipe[] = [];
  const explanations: Record<string, string> = {};
  let conflicts: AllergenConflict[] = [];

  for (let attempt = 1; attempt <= ALLERGEN_ATTEMPTS; attempt++) {
    const prompt = conflicts.length > 0 ? basePrompt + allergenRetryNote(conflicts) : basePrompt;
    // Model, thinking, deadline, retries and usage logging: lib/ai (#83).
    let result: AiTaskResult<z.output<typeof GeneratedRecipes>>;
    try {
      result = await runAiTask('generation', { system, prompt, userId, schema: GeneratedRecipes });
    } catch (error) {
      // A failed retry keeps the safe recipes the first answer already gave.
      if (attempt > 1 && recipes.length > 0) {
        console.warn('generateRecipes: allergen retry failed, keeping the safe recipes', error);
        break;
      }
      throw error;
    }

    // A withheld response has no recipes; say so rather than reporting a format problem.
    if (result.blocked) {
      if (attempt > 1 && recipes.length > 0) break;
      return { blocked: true, rawFinishReason: result.rawFinishReason };
    }

    // Validated against the schema already; normalise into Recipes (IDs, tags, cost).
    conflicts = [];
    for (const generated of result.output.recipes) {
      // A retry only makes up the shortfall; the first answer is kept whole, as before.
      if (attempt > 1 && recipes.length >= request.numberOfRecipes) break;
      const recipe = toRecipe(generated, 'ai-generated');
      // The prompt says MUST AVOID; this makes sure (allergies are never a preference).
      const found = findAllergenConflicts(recipe, allergies);
      if (found.length > 0) {
        console.warn(`generateRecipes: dropped "${recipe.title}" for allergens (attempt ${attempt}):`, found);
        conflicts.push(...found);
        continue;
      }
      recipes.push(recipe);
      const explanation = cleanExplanation(generated.whyThisMeal);
      if (explanation) explanations[recipe.id] = explanation;
    }
    if (conflicts.length === 0 || recipes.length >= request.numberOfRecipes) break;
  }

  if (recipes.length === 0 && conflicts.length > 0) return { allergenConflict: true, conflicts };
  console.log(`✅ Generated ${recipes.length} valid recipes`);
  return { recipes, explanations };
}
