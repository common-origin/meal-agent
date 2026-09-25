/**
 * API Route: Generate Recipes with AI
 * POST /api/generate-recipes
 * 
 * Generates personalized recipes using Google Gemini based on family settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRecipes } from '@/lib/aiRecipeGenerator';
import type { RecipeGenerationRequest } from '@/lib/prompts/recipeGeneration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limiting (simple in-memory cache)
const requestCache = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3; // Max 3 requests per minute per IP

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const lastRequest = requestCache.get(identifier) || 0;

  // Reset the window if it's expired — note this only clears the count,
  // it doesn't early-return. Returning true here directly (the previous
  // behavior) skipped ever recording a timestamp for a new identifier,
  // so this branch matched on every single call and the limit never
  // actually engaged. See generate-recipes' entry in AI.md.
  if (now - lastRequest > RATE_LIMIT_WINDOW_MS) {
    requestCache.delete(`${identifier}:count`);
  }

  // Check if within rate limit
  const requestCount = requestCache.get(`${identifier}:count`) || 0;
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  requestCache.set(identifier, now);
  requestCache.set(`${identifier}:count`, requestCount + 1);

  // Reset count after window
  setTimeout(() => {
    requestCache.delete(`${identifier}:count`);
  }, RATE_LIMIT_WINDOW_MS);

  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a minute before trying again.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate request
    if (!body.familySettings) {
      return NextResponse.json(
        { error: 'Missing required field: familySettings' },
        { status: 400 }
      );
    }

    const generationRequest: RecipeGenerationRequest = {
      familySettings: body.familySettings,
      numberOfRecipes: body.numberOfRecipes || 7, // Default to 7 for a week
      excludeRecipeIds: body.excludeRecipeIds || [],
      specificDays: body.specificDays || undefined,
      pantryItems: body.pantryItems || [], // Pass pantry items to AI
      existingProteins: body.existingProteins || [], // Pass existing proteins for variety
    };

    console.log('📥 Recipe generation request:', {
      numberOfRecipes: generationRequest.numberOfRecipes,
      cuisines: generationRequest.familySettings.cuisines,
      servings: generationRequest.familySettings.totalServings,
      pantryItemsCount: generationRequest.pantryItems?.length || 0,
    });

    // Generate recipes with AI
    const result = await generateRecipes(generationRequest);

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
