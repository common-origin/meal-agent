/**
 * API Route: Extract Recipe from Image
 * POST /api/extract-recipe-from-image
 * 
 * Reads a recipe from a cookbook, magazine or handwritten photo. The method is
 * paraphrased; after a copyright block it falls back to ingredients only (#92).
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { readImageUpload, requireUserWithinLimit } from '@/lib/api/guard';
import { runAiTask } from '@/lib/ai/run';
import { aiErrorResponse, aiFailureResponse } from '@/lib/ai/errors';
import { PhotoIngredients, PhotoRecipe } from '@/lib/ai/schemas';
import { toPartialRecipe, toRecipe } from '@/lib/ai/normalizeRecipe';
import { CUISINE_FORMAT_RULE, INGREDIENT_FORMAT_RULES } from '@/lib/prompts/recipeFormat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.recipeFromImage.deadlineMs, so the route can return its 504 first.
// A copyright block can mean two calls (#92), so leave room for both.
export const maxDuration = 100;

const RECIPE_PROMPT = `You are a recipe extraction assistant. Read the recipe in this image.

The image may be a page from a cookbook or magazine, or a handwritten recipe card.

RULES:
- Extract the ingredients with the quantities shown, converted to the units below.
- Rewrite the method in your own words as concise numbered steps, at most 10. Keep every quantity, temperature and time. Don't copy sentences from the page.
- If servings or time are not visible, estimate reasonably.
- Estimate nutrition per serve.
- Put the book title and/or author in "source" if visible.
- If you can't read something clearly, make your best guess or omit it.
${CUISINE_FORMAT_RULE}

${INGREDIENT_FORMAT_RULES}`;

const INGREDIENTS_PROMPT = `Read the recipe in this image and list only its facts: the title, the servings, and the ingredients with the quantities shown, converted to the units below. Put the book title and/or author in "source" if visible. Don't include the method.

${INGREDIENT_FORMAT_RULES}`;

const PARTIAL_NOTICE = 'We filled in the ingredients. Add the method in your own words.';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.extractRecipeFromImage);
    if (!auth.ok) return auth.response;

    const upload = await readImageUpload(request, 'extract-recipe-from-image');
    if (!upload.ok) return upload.response;
    const image = upload.value;

    console.log('📸 Extracting recipe from image:', {
      size: `${(image.size / 1024).toFixed(1)}KB`,
      type: image.type,
    });

    const imageData = new Uint8Array(await image.arrayBuffer());
    const askAbout = (text: string) => [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text },
          { type: 'file' as const, data: imageData, mediaType: image.type },
        ],
      },
    ];

    // Model and limits: lib/ai/models.ts
    const result = await runAiTask('recipeFromImage', {
      userId: auth.value.id,
      schema: PhotoRecipe,
      messages: askAbout(RECIPE_PROMPT),
    });

    if (!result.blocked) {
      // Validated against the schema already; normalise into a Recipe.
      const recipe = toRecipe(result.output, 'user-added');
      console.log('✅ Recipe extracted:', recipe.title);
      return NextResponse.json({ success: true, recipe });
    }

    const reason = result.rawFinishReason ?? 'content filtered';
    console.log(`⚠️ Response blocked: ${reason}`);
    if (reason !== 'RECITATION') {
      return aiErrorResponse('blocked');
    }

    // Copyright block: ingredients are facts, so ask for those alone, once.
    const fallback = await runAiTask('recipeFromImage', {
      userId: auth.value.id,
      schema: PhotoIngredients,
      messages: askAbout(INGREDIENTS_PROMPT),
    });

    if (fallback.blocked) {
      console.log(`⚠️ Ingredients-only retry blocked: ${fallback.rawFinishReason ?? 'content filtered'}`);
      return aiErrorResponse('recitation');
    }

    const recipe = toPartialRecipe(fallback.output);
    console.log('✅ Ingredients extracted after a copyright block:', recipe.title || '(untitled)');
    return NextResponse.json({ success: true, recipe, partial: true, notice: PARTIAL_NOTICE });

  } catch (error) {
    return aiFailureResponse(error, 'extract-recipe-from-image');
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with image data.' },
    { status: 405 }
  );
}
