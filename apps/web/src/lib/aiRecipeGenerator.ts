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
  const recipes: Recipe[] = [];
  const explanations: Record<string, string> = {};
  for (const generated of result.output.recipes) {
    const recipe = toRecipe(generated, 'ai-generated');
    recipes.push(recipe);
    const explanation = cleanExplanation(generated.whyThisMeal);
    if (explanation) explanations[recipe.id] = explanation;
  }
  console.log(`✅ Generated ${recipes.length} valid recipes`);
  return { recipes, explanations };
}
