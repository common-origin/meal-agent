/**
 * API Route: Scan Pantry/Fridge Image
 * POST /api/scan-pantry-image
 * 
 * Uses Google Gemini Vision to identify ingredients from a photo
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { invalidOutputResponse, readImageUpload, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { AiTaskError, isAiInvalidOutput, isAiTimeout, runAiTask } from '@/lib/ai/run';
import { PantryScan } from '@/lib/ai/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.pantryScan.deadlineMs, so the route can return its 504 first.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.scanPantryImage);
    if (!auth.ok) return auth.response;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const upload = await readImageUpload(request, 'scan-pantry-image');
    if (!upload.ok) return upload.response;
    const image = upload.value;

    console.log('📸 Scanning pantry/fridge image:', {
      name: image.name,
      size: `${(image.size / 1024).toFixed(1)}KB`,
      type: image.type,
    });

    const imageData = new Uint8Array(await image.arrayBuffer());

    const prompt = `Analyze this photo of a fridge/pantry and identify all visible food items and ingredients.

INSTRUCTIONS:
- List each ingredient as a simple, concise name (e.g., "chicken breast", "tomatoes", "milk")
- Focus on raw ingredients and perishable items
- Include visible produce, meats, dairy, packaged items
- Ignore condiments, spices, and seasonings unless they're prominent
- Be specific but brief (e.g., "cherry tomatoes" not just "tomatoes" if you can tell)
- Only include items you can clearly see and identify with reasonable confidence

Return the ingredient names in "ingredients", e.g.:
{ "ingredients": ["chicken breast", "cherry tomatoes", "bell peppers", "milk", "cheddar cheese", "ground beef", "carrots", "broccoli"] }`;

    // Use Gemini Vision to identify ingredients (model and limits: lib/ai/models.ts)
    const result = await runAiTask('pantryScan', {
      userId: auth.value.id,
      schema: PantryScan,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'file', data: imageData, mediaType: image.type },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    if (result.blocked) {
      return NextResponse.json(
        {
          error: 'Content Blocked',
          details: `The AI couldn't process this photo (Reason: ${result.rawFinishReason ?? 'content filtered'}). Please try a different photo or add ingredients manually.`,
          blocked: true,
        },
        { status: 422 }
      );
    }

    const ingredients = [
      ...new Set(result.output.ingredients.map((item) => item.trim().toLowerCase()).filter((item) => item.length > 0)),
    ];
    console.log('✅ Extracted ingredients:', ingredients);

    return NextResponse.json({
      success: true,
      ingredients,
      count: ingredients.length,
      confidence: ingredients.length > 0 ? 'medium-high' : 'low',
      message: ingredients.length > 0
        ? `Found ${ingredients.length} ingredients. Please review and edit as needed.`
        : 'No ingredients detected. Try taking a clearer photo with better lighting.',
    });

  } catch (error) {
    if (isAiTimeout(error)) return timeoutResponse('scan-pantry-image');
    if (isAiInvalidOutput(error)) return invalidOutputResponse('scan-pantry-image');

    console.error('❌ Error scanning pantry image:', error);

    if (error instanceof AiTaskError && error.code === 'rate_limited') {
      return NextResponse.json(
        {
          error: 'API rate limit exceeded',
          details: 'You\'ve reached the API usage limit. Please try again in a few minutes, or enter ingredients manually.',
          isRateLimit: true,
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      {
        error: 'Failed to scan image',
        details: error instanceof Error ? error.message : 'Unknown error',
        isRateLimit: false,
      },
      { status: 500 }
    );
  }
}
