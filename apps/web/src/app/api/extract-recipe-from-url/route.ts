import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { extractRecipeFromUrlSchema } from '@/lib/api/schemas';
import { invalidOutputResponse, parseBody, readJson, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { isAiInvalidOutput, isAiTimeout, runAiTask } from '@/lib/ai/run';
import { ExtractedRecipe } from '@/lib/ai/schemas';
import { toRecipe } from '@/lib/ai/normalizeRecipe';
import { CUISINE_FORMAT_RULE, INGREDIENT_FORMAT_RULES } from '@/lib/prompts/recipeFormat';
import { safeFetchHtml, SafeFetchError } from '@/lib/api/safeFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.recipeFromUrl.deadlineMs plus the 10 s page fetch, so the route can return its 504 first.
export const maxDuration = 60;

const UNREADABLE_PAGE_MESSAGE = "We couldn't read that page. Check the link or add the recipe manually.";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.extractRecipeFromUrl);
    if (!auth.ok) return auth.response;

    const parsed = parseBody(extractRecipeFromUrlSchema, await readJson(req), 'extract-recipe-from-url');
    if (!parsed.ok) return parsed.response;
    const { url } = parsed.value;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    console.log('📥 Fetching recipe from URL:', url);

    let html: string;
    let finalUrl: string;
    try {
      ({ html, finalUrl } = await safeFetchHtml(url));
    } catch (error) {
      if (error instanceof SafeFetchError) {
        console.warn(`extract-recipe-from-url: fetch refused (${error.code}):`, error.message);
        const status = error.code === 'invalid_url' || error.code === 'blocked_host' ? 400 : 422;
        return NextResponse.json({ error: UNREADABLE_PAGE_MESSAGE, code: error.code }, { status });
      }
      throw error;
    }
    console.log('✅ Webpage fetched, length:', html.length);


    const prompt = `You are a recipe extraction expert. Extract recipe information from the following HTML content.

HTML Content:
${html.substring(0, 50000)}

RULES:
- Extract the recipe's title, ingredients and all instruction steps (keep each step concise and clear)
- If you can't find servings or total time, use reasonable defaults (e.g. 4 servings)
- Estimate nutrition per serve if the page doesn't give it
- Put the site or author in "source" if shown
${CUISINE_FORMAT_RULE}

${INGREDIENT_FORMAT_RULES}

Extract the recipe now:`;

    console.log('🤖 Calling Gemini API to extract recipe...');
    // Model and limits: lib/ai/models.ts
    const result = await runAiTask('recipeFromUrl', { userId: auth.value.id, prompt, schema: ExtractedRecipe });
    if (result.blocked) {
      return NextResponse.json(
        { error: UNREADABLE_PAGE_MESSAGE, code: 'blocked', reason: result.rawFinishReason ?? 'content filtered' },
        { status: 422 }
      );
    }

    // Validated against the schema already; normalise into a Recipe.
    const recipe = toRecipe(result.output, 'user-added', { sourceUrl: finalUrl });
    console.log('✅ Extracted recipe:', recipe.title);

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('❌ Error extracting recipe from URL:', error);
    if (isAiTimeout(error)) return timeoutResponse('extract-recipe-from-url');
    if (isAiInvalidOutput(error)) return invalidOutputResponse('extract-recipe-from-url');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract recipe' },
      { status: 500 }
    );
  }
}
