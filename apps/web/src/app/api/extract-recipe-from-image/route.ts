/**
 * API Route: Extract Recipe from Image
 * POST /api/extract-recipe-from-image
 * 
 * Uses Gemini Vision to extract recipe data from cookbook/magazine photos
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { invalidOutputResponse, readImageUpload, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { isAiInvalidOutput, isAiTimeout, runAiTask } from '@/lib/ai/run';
import { ExtractedRecipe } from '@/lib/ai/schemas';
import { toRecipe } from '@/lib/ai/normalizeRecipe';
import { CUISINE_FORMAT_RULE, INGREDIENT_FORMAT_RULES } from '@/lib/prompts/recipeFormat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.recipeFromImage.deadlineMs, so the route can return its 504 first.
export const maxDuration = 60;

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

    // Build the prompt for recipe extraction
    const prompt = `You are a recipe extraction assistant. Extract all recipe information from this image.

The image may contain a recipe from a cookbook, magazine, or handwritten recipe card.

RULES:
- Extract the ingredients with the quantities shown, converted to the units below
- Extract all instruction steps in order
- If servings or time are not visible, estimate reasonably
- Estimate nutrition per serve
- Put the book title or source in "source" if it is visible
- If you can't read something clearly, make your best guess or omit it
${CUISINE_FORMAT_RULE}

${INGREDIENT_FORMAT_RULES}`;

    // Process image (model and limits: lib/ai/models.ts)
    const imageData = new Uint8Array(await image.arrayBuffer());

    const result = await runAiTask('recipeFromImage', {
      userId: auth.value.id,
      schema: ExtractedRecipe,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'file', data: imageData, mediaType: image.type },
          ],
        },
      ],
    });

    // Check for blocked responses (RECITATION, SAFETY, ...)
    if (result.blocked) {
      const reason = result.rawFinishReason ?? 'content filtered';
      console.log(`⚠️ Response blocked: ${reason}`);

      if (reason === 'RECITATION') {
        return NextResponse.json(
          {
            error: 'Copyright Detection',
            details: 'The image appears to contain copyrighted content. Please try:\n• Taking a photo of a handwritten recipe\n• Manually typing the recipe instead\n• Using a recipe you created yourself',
            blocked: true,
            reason: 'RECITATION'
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          error: 'Content Blocked',
          details: `The AI couldn't process this image (Reason: ${reason}). Please try a different image.`,
          blocked: true,
          reason
        },
        { status: 422 }
      );
    }

    // Validated against the schema already; normalise into a Recipe.
    const recipe = toRecipe(result.output, 'user-added');

    console.log('✅ Recipe extracted:', recipe.title);

    return NextResponse.json({
      success: true,
      recipe,
    });

  } catch (error) {
    console.error('❌ Error extracting recipe from image:', error);
    if (isAiTimeout(error)) return timeoutResponse('extract-recipe-from-image');
    if (isAiInvalidOutput(error)) return invalidOutputResponse('extract-recipe-from-image');

    
    return NextResponse.json(
      {
        error: 'Failed to extract recipe',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with image data.' },
    { status: 405 }
  );
}
