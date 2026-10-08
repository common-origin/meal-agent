/**
 * API Route: Extract Recipe from Image
 * POST /api/extract-recipe-from-image
 * 
 * Uses Gemini Vision to extract recipe data from cookbook/magazine photos
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Recipe } from '@/lib/types/recipe';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { readImageUpload, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { isTimeoutError } from '@/lib/api/aiCall';
import { trackedAiCall } from '@/lib/ai/usage';
import { AI_DEADLINES_MS } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_DEADLINES_MS.extractRecipeFromImage, so the route can return its 504 first.
export const maxDuration = 60;

const MODEL = 'gemini-3.8-flash';

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

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

    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: MODEL,
      generationConfig: {
        temperature: 0.2, // Low temperature for accurate extraction
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    // Build the prompt for recipe extraction
    const prompt = `You are a recipe extraction assistant. Extract all recipe information from this image.

The image may contain a recipe from a cookbook, magazine, or handwritten recipe card.

Extract the following information and return it as VALID JSON ONLY (no markdown, no code blocks):

{
  "name": "Recipe Title",
  "cuisine": "cuisine_type",
  "totalTime": 30,
  "prepTime": 10,
  "cookTime": 20,
  "servings": 4,
  "ingredients": [
    { "name": "ingredient name", "qty": "500", "unit": "g" }
  ],
  "instructions": ["Step 1", "Step 2", "Step 3"],
  "tags": ["quick", "easy"],
  "source": "Book title or source if visible",
  "estimatedCost": 15
}

RULES:
- Extract ingredients with EXACT quantities and units from the image
- Extract all instruction steps in order
- If servings/time is not visible, estimate reasonably
- Keep ingredient names exactly as written
- Use standard units: g, ml, tsp, tbsp, cup, unit
- Return ONLY valid JSON, no extra text
- If you can't read something clearly, make your best guess or omit it`;

    // Process image
    const imageData = Buffer.from(await image.arrayBuffer()).toString('base64');
    
    const result = await trackedAiCall(
      { task: 'extract-recipe-from-image', model: MODEL, userId: auth.value.id },
      AI_DEADLINES_MS.extractRecipeFromImage,
      (signal) =>
        model.generateContent(
          [
            prompt,
            {
              inlineData: {
                data: imageData,
                mimeType: image.type,
              },
            },
          ],
          { signal }
        )
    );

    const response = result.response;
    
    // Check for blocked responses (RECITATION, SAFETY, etc.)
    const candidates = result.response.candidates;
    if (candidates && candidates.length > 0) {
      const candidate = candidates[0];
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.log(`⚠️ Response blocked: ${candidate.finishReason}`, candidate);
        
        if (candidate.finishReason === 'RECITATION') {
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
            details: `The AI couldn't process this image (Reason: ${candidate.finishReason}). Please try a different image.`,
            blocked: true,
            reason: candidate.finishReason
          },
          { status: 422 }
        );
      }
    }
    
    const text = response.text();

    console.log('✅ Gemini Vision response received');

    // Parse JSON response
    const jsonResponse = parseGeminiResponse(text);
    
    if (!jsonResponse) {
      return NextResponse.json(
        { error: 'Failed to parse AI response', details: 'Invalid JSON returned' },
        { status: 500 }
      );
    }

    // Build Recipe object
    const recipe = buildRecipeFromExtraction(jsonResponse);

    console.log('✅ Recipe extracted:', recipe.title);

    return NextResponse.json({
      success: true,
      recipe,
    });

  } catch (error) {
    console.error('❌ Error extracting recipe from image:', error);
    if (isTimeoutError(error)) return timeoutResponse('extract-recipe-from-image');

    
    return NextResponse.json(
      {
        error: 'Failed to extract recipe',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function parseGeminiResponse(text: string): Record<string, unknown> | null {
  try {
    let cleanText = text.trim();
    
    // Remove markdown code blocks if present
    cleanText = cleanText.replace(/^```json\s*/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '');
    cleanText = cleanText.replace(/\s*```$/i, '');
    
    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    console.error('Raw text:', text.substring(0, 500));
    return null;
  }
}

function buildRecipeFromExtraction(data: Record<string, unknown>): Partial<Recipe> {
  return {
    title: String(data.name || 'Untitled Recipe'),
    timeMins: Number(data.totalTime) || Number(data.cookTime) + Number(data.prepTime) || undefined,
    serves: Number(data.servings) || 4,
    tags: Array.isArray(data.tags) ? data.tags as string[] : [],
    ingredients: Array.isArray(data.ingredients) 
      ? (data.ingredients as Array<Record<string, unknown>>).map(ing => ({
          name: String(ing.name || ''),
          qty: Number(ing.qty) || 1,
          unit: (String(ing.unit) || 'unit') as 'g'|'ml'|'tsp'|'tbsp'|'unit',
        }))
      : [],
    instructions: Array.isArray(data.instructions) 
      ? (data.instructions as Array<unknown>).map(step => String(step))
      : undefined,
    costPerServeEst: Number(data.estimatedCost) 
      ? Number(data.estimatedCost) / (Number(data.servings) || 4) 
      : undefined,
  };
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST with image data.' },
    { status: 405 }
  );
}
