import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { extractRecipeFromUrlSchema } from '@/lib/api/schemas';
import { parseBody, readJson, requireUserWithinLimit } from '@/lib/api/guard';
import { runAiTask } from '@/lib/ai/run';
import { aiErrorResponse, aiFailureResponse, unreadablePageResponse } from '@/lib/ai/errors';
import { ExtractedRecipe, PageIngredients } from '@/lib/ai/schemas';
import { toPageRecipe, toRecipe } from '@/lib/ai/normalizeRecipe';
import { extractJsonLdRecipe, htmlToText, MAX_PAGE_TEXT_CHARS } from '@/lib/recipeJsonLd';
import { CUISINE_FORMAT_RULE, INGREDIENT_FORMAT_RULES } from '@/lib/prompts/recipeFormat';
import { safeFetchHtml, SafeFetchError } from '@/lib/api/safeFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.recipeFromUrl.deadlineMs plus the 10 s page fetch, so the route can return its 504 first.
export const maxDuration = 60;


function ingredientLinesPrompt(lines: string[]): string {
  return `Convert these recipe ingredient lines into structured ingredients, one per line, in the same order. Skip lines that are only section headings (e.g. "For the sauce:").

${INGREDIENT_FORMAT_RULES}

INGREDIENT LINES:
${lines.map((line) => `- ${line}`).join('\n')}`;
}

function pageTextPrompt(pageText: string): string {
  return `You are a recipe extraction expert. Extract the recipe from this web page's text.

RULES:
- Extract the recipe's title, ingredients and all instruction steps (keep each step concise and clear)
- If you can't find servings or total time, use reasonable defaults (e.g. 4 servings)
- Estimate nutrition per serve if the page doesn't give it
- Put the site or author in "source" if shown
${CUISINE_FORMAT_RULE}

${INGREDIENT_FORMAT_RULES}

PAGE TEXT:
${pageText}`;
}

function blockedResponse(rawFinishReason: string | undefined) {
  console.warn(`extract-recipe-from-url: response blocked (${rawFinishReason ?? 'content filtered'})`);
  return aiErrorResponse('blocked', {
    message: "We couldn't read that page. Check the link or add the recipe manually.",
  });
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.extractRecipeFromUrl);
    if (!auth.ok) return auth.response;

    const parsed = parseBody(extractRecipeFromUrlSchema, await readJson(req), 'extract-recipe-from-url');
    if (!parsed.ok) return parsed.response;
    const { url } = parsed.value;

    if (!process.env.GEMINI_API_KEY) {
      console.error('extract-recipe-from-url: GEMINI_API_KEY is not configured');
      return aiErrorResponse('unknown');
    }

    console.log('📥 Fetching recipe from URL:', url);

    let html: string;
    let finalUrl: string;
    try {
      ({ html, finalUrl } = await safeFetchHtml(url));
    } catch (error) {
      if (error instanceof SafeFetchError) {
        console.warn(`extract-recipe-from-url: fetch refused (${error.code}):`, error.message);
        return unreadablePageResponse(error.code);
      }
      throw error;
    }
    console.log('✅ Webpage fetched, length:', html.length);

    // Structured recipe data first (#93): title, steps, time and servings come
    // from the page; only the ingredient lines go to the model.
    const page = extractJsonLdRecipe(html);
    if (page) {
      console.log(`📋 Found JSON-LD recipe "${page.title}" with ${page.ingredientLines.length} ingredient lines`);
      let ingredients: PageIngredients['ingredients'] = [];
      if (page.ingredientLines.length > 0) {
        const result = await runAiTask('recipeFromUrl', {
          userId: auth.value.id,
          prompt: ingredientLinesPrompt(page.ingredientLines),
          schema: PageIngredients,
        });
        if (result.blocked) return blockedResponse(result.rawFinishReason);
        ingredients = result.output.ingredients;
      }
      const recipe = toPageRecipe(page, ingredients, { sourceUrl: finalUrl });
      console.log('✅ Extracted recipe from structured data:', recipe.title);
      return NextResponse.json({ recipe });
    }

    // No structured data: send the page's readable text, not raw HTML.
    const pageText = htmlToText(html, MAX_PAGE_TEXT_CHARS);
    console.log('🤖 No JSON-LD recipe; extracting from page text, length:', pageText.length);
    // Model and limits: lib/ai/models.ts
    const result = await runAiTask('recipeFromUrl', { userId: auth.value.id, prompt: pageTextPrompt(pageText), schema: ExtractedRecipe });
    if (result.blocked) return blockedResponse(result.rawFinishReason);

    // Validated against the schema already; normalise into a Recipe.
    const recipe = toRecipe(result.output, 'user-added', { sourceUrl: finalUrl });
    console.log('✅ Extracted recipe:', recipe.title);

    return NextResponse.json({ recipe });
  } catch (error) {
    return aiFailureResponse(error, 'extract-recipe-from-url');
  }
}
