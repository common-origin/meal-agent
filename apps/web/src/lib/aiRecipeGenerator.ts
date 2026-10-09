/**
 * AI Recipe Generator using Google Gemini
 * 
 * This service handles communication with the Gemini API to generate
 * personalized recipe suggestions based on family settings.
 */

import type { Recipe } from './types/recipe';
import type { RecipeGenerationRequest } from './prompts/recipeGeneration';
import { buildSystemPrompt, buildRecipeGenerationPrompt } from './prompts/recipeGeneration';
import { AiTaskError, isAiInvalidOutput, isAiTimeout, runAiTask } from './ai/run';
import { GeneratedRecipes } from './ai/schemas';
import { toRecipe } from './ai/normalizeRecipe';

export interface GeneratedRecipeResponse {
  recipes: Recipe[];
}

export interface GenerationError {
  error: string;
  details?: string;
}

/**
 * Generate recipes using Gemini AI with retry logic
 */
export async function generateRecipes(
  request: RecipeGenerationRequest,
  /** The signed-in user, for usage logging and the daily AI cap (#85). */
  { userId }: { userId: string }
): Promise<GeneratedRecipeResponse | GenerationError> {
  try {
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
    if (result.blocked) {
      return {
        error: 'Failed to generate recipes',
        details: `The AI declined to generate recipes for these settings (${result.rawFinishReason ?? 'content filtered'}). Please try again or adjust your preferences.`,
      };
    }

    // Validated against the schema already; normalise into Recipes (IDs, tags, cost).
    const recipes = result.output.recipes.map((recipe) => toRecipe(recipe, 'ai-generated'));
    console.log(`✅ Generated ${recipes.length} valid recipes`);
    return { recipes };

  } catch (error) {
    // The route turns these into its 504 and 502 responses.
    if (isAiTimeout(error) || isAiInvalidOutput(error)) throw error;

    console.error('❌ Error generating recipes:', error);

    if (error instanceof AiTaskError) {
      // Provide user-friendly error messages for common issues
      const details =
        error.code === 'unavailable'
          ? "The AI service is temporarily overloaded. We tried 3 times but it's still busy. Please wait a minute and try again."
          : error.code === 'rate_limited'
            ? 'Rate limit reached. Please wait a minute before generating more recipes.'
            : error.message;
      return { error: 'Failed to generate recipes', details };
    }

    if (error instanceof Error) {
      return { error: 'Failed to generate recipes', details: error.message };
    }

    return {
      error: 'Unknown error occurred',
      details: 'An unexpected error occurred while generating recipes',
    };
  }
}
