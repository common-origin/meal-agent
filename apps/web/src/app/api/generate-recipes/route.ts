/**
 * API Route: Generate Recipes with AI
 * POST /api/generate-recipes
 * 
 * Generates personalized recipes using Google Gemini based on family settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRecipes } from '@/lib/aiRecipeGenerator';
import type { RecipeGenerationRequest } from '@/lib/prompts/recipeGeneration';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { generateRecipesSchema } from '@/lib/api/schemas';
import { invalidOutputResponse, parseBody, readJson, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { isAiInvalidOutput, isAiTimeout } from '@/lib/ai/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.generation.deadlineMs, so the route can return its 504 first.
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.generateRecipes);
    if (!auth.ok) return auth.response;

    const parsed = parseBody(generateRecipesSchema, await readJson(request), 'generate-recipes');
    if (!parsed.ok) return parsed.response;

    const generationRequest: RecipeGenerationRequest = parsed.value;

    console.log('📥 Recipe generation request:', {
      numberOfRecipes: generationRequest.numberOfRecipes,
      dayType: generationRequest.specificDays?.[0]?.type ?? 'weeknight',
      cuisines: generationRequest.familySettings.cuisines,
      servings: generationRequest.familySettings.totalServings,
      pantryItemsCount: generationRequest.pantryItems?.length || 0,
    });

    // Generate recipes with AI
    const result = await generateRecipes(generationRequest, { userId: auth.value.id });

    // Check for errors
    if ('error' in result) {
      console.error('❌ Recipe generation failed:', result.error);
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 }
      );
    }

    console.log('✅ Successfully generated recipes:', result.recipes.length);

    // Return success response
    return NextResponse.json({
      success: true,
      recipes: result.recipes,
      count: result.recipes.length,
    });

  } catch (error) {
    if (isAiTimeout(error)) return timeoutResponse('generate-recipes');
    if (isAiInvalidOutput(error)) return invalidOutputResponse('generate-recipes');

    console.error('❌ Error in generate-recipes API:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to generate recipes.' },
    { status: 405 }
  );
}
