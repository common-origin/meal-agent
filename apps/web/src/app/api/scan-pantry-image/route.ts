/**
 * API Route: Scan Pantry/Fridge Image
 * POST /api/scan-pantry-image
 * 
 * Uses Google Gemini Vision to identify ingredients from a photo
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { readImageUpload, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { AiTaskError, isAiTimeout, runAiTask } from '@/lib/ai/run';

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

Return ONLY a JSON array of ingredient names, nothing else:
["ingredient 1", "ingredient 2", "ingredient 3"]

Example output:
["chicken breast", "cherry tomatoes", "bell peppers", "milk", "cheddar cheese", "ground beef", "carrots", "broccoli"]`;

    // Use Gemini Vision to identify ingredients (model and limits: lib/ai/models.ts)
    const { text: rawText } = await runAiTask('pantryScan', {
      userId: auth.value.id,
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
    const text = rawText.trim();

    console.log('🤖 Raw Gemini response:', text);

    // Parse the JSON array
    let ingredients: string[];
    try {
      // Remove markdown code blocks if present
      const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      ingredients = JSON.parse(cleanedText);

      if (!Array.isArray(ingredients)) {
        throw new Error('Response is not an array');
      }

      // Validate and clean ingredients
      ingredients = ingredients
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim().toLowerCase());

      console.log('✅ Extracted ingredients:', ingredients);

    } catch (parseError) {
      console.error('❌ Failed to parse Gemini response as JSON:', parseError);
      return NextResponse.json(
        {
          error: 'Failed to parse AI response',
          details: 'The AI response was not in the expected format',
          rawResponse: text,
        },
        { status: 500 }
      );
    }

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
