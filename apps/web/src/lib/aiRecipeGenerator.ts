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
import { GeneratedRecipes } from './ai/schemas';
import { toRecipe } from './ai/normalizeRecipe';

export interface GeneratedRecipeResponse {
  recipes: Recipe[];
}

/** The model withheld its answer (safety and so on); there are no recipes. */
export interface GenerationBlocked {
  blocked: true;
  rawFinishReason: string | undefined;
}

/**
 * Generate recipes. AI failures (timeout, invalid output, provider errors)
 * are thrown as AiTaskError for the route to map to a friendly response (#96).
 */
export async function generateRecipes(
  request: RecipeGenerationRequest,
  /** The signed-in user, for usage logging and the daily AI cap (#85). */
  { userId }: { userId: string }
): Promise<GeneratedRecipeResponse | GenerationBlocked> {
  const system = buildSystemPrompt();
  const prompt = buildRecipeGenerationPrompt(request);

  console.log('🤖 Generating recipes with Gemini...');
  console.log('📝 Request:', {
    numberOfRecipes: request.numberOfRecipes,
    cuisines: request.familySettings.cuisines,
    servings: request.familySettings.totalServings,
  });

  // Model, thinking, deadline, retries and usage logging: lib/ai (#83).
  const result = await runAiTask('generation', { system, prompt, userId, schema: GeneratedRecipes });

  // A withheld response has no recipes; say so rather than reporting a format problem.
  if (result.blocked) return { blocked: true, rawFinishReason: result.rawFinishReason };

  // Validated against the schema already; normalise into Recipes (IDs, tags, cost).
  const recipes = result.output.recipes.map((recipe) => toRecipe(recipe, 'ai-generated'));
  console.log(`✅ Generated ${recipes.length} valid recipes`);
  return { recipes };
}
