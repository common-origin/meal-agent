/**
 * AI Recipe Generator using Google Gemini
 * 
 * This service handles communication with the Gemini API to generate
 * personalized recipe suggestions based on family settings.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Recipe } from './types/recipe';
import type { RecipeGenerationRequest } from './prompts/recipeGeneration';
import { buildSystemPrompt, buildRecipeGenerationPrompt } from './prompts/recipeGeneration';

// Initialize Gemini API
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env.local file.');
  }
  
  return new GoogleGenerativeAI(apiKey);
};

export interface GeneratedRecipeResponse {
  recipes: Recipe[];
}

export interface GenerationError {
  error: string;
  details?: string;
}

/**
 * Generate recipes using Gemini AI
 */
export async function generateRecipes(
  request: RecipeGenerationRequest
): Promise<GeneratedRecipeResponse | GenerationError> {
  try {
    const genAI = getGeminiClient();
    
    // Use Gemini 2.5 Flash - available in v1 API (confirmed via ListModels)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.8, // Slightly less creative to be more predictable
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 16384, // Increased to ensure complete responses
      },
    });

    // Build the prompt
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildRecipeGenerationPrompt(request);
    
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    console.log('🤖 Generating recipes with Gemini...');
    console.log('📝 Request:', {
      numberOfRecipes: request.numberOfRecipes,
      cuisines: request.familySettings.cuisines,
      servings: request.familySettings.totalServings,
    });

    // Generate content
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ Gemini response received');
    console.log('📄 Raw response length:', text.length);

    // Parse JSON response
    const jsonResponse = parseGeminiResponse(text);
    
    if (!jsonResponse) {
      return {
        error: 'Failed to parse AI response',
        details: 'The AI returned invalid JSON format',
      };
    }

    // Validate response structure
    if (!jsonResponse.recipes || !Array.isArray(jsonResponse.recipes)) {
      return {
        error: 'Invalid response structure',
        details: 'Expected recipes array in response',
      };
    }

    // Validate each recipe has required fields
    const validatedRecipes = validateRecipes(jsonResponse.recipes);
    
    if (validatedRecipes.length === 0) {
      return {
        error: 'No valid recipes generated',
        details: 'All generated recipes were invalid',
      };
    }

    console.log(`✅ Generated ${validatedRecipes.length} valid recipes`);

    return {
      recipes: validatedRecipes,
    };

  } catch (error) {
    console.error('❌ Error generating recipes:', error);
    
    if (error instanceof Error) {
      return {
        error: 'Failed to generate recipes',
        details: error.message,
      };
    }
    
    return {
      error: 'Unknown error occurred',
      details: 'An unexpected error occurred while generating recipes',
    };
  }
}

/**
 * Parse Gemini's response, handling various formats and incomplete JSON
 */
function parseGeminiResponse(text: string): GeneratedRecipeResponse | null {
  try {
    // Remove markdown code blocks if present
    let cleanText = text.trim();
    
    // Remove ```json and ``` markers
    cleanText = cleanText.replace(/^```json\s*/i, '');
    cleanText = cleanText.replace(/^```\s*/i, '');
    cleanText = cleanText.replace(/\s*```$/i, '');
    
    // Try to fix incomplete JSON by closing brackets
    if (!cleanText.endsWith('}')) {
      console.log('⚠️ JSON appears incomplete, attempting to fix...');
      
      // Count opening and closing braces
      const openBraces = (cleanText.match(/{/g) || []).length;
      const closeBraces = (cleanText.match(/}/g) || []).length;
      
      // Add missing closing braces
      const missingBraces = openBraces - closeBraces;
      if (missingBraces > 0) {
        // Remove any incomplete trailing data
        const lastCompleteRecipe = cleanText.lastIndexOf('},');
        if (lastCompleteRecipe > 0) {
          cleanText = cleanText.substring(0, lastCompleteRecipe + 1);
          cleanText += '\n  ]\n}';
          console.log('✅ Fixed incomplete JSON by trimming and closing');
        }
      }
    }
    
    // Parse JSON
    const parsed = JSON.parse(cleanText);
    
    return parsed as GeneratedRecipeResponse;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    console.error('Raw text:', text.substring(0, 500));
    return null;
  }
}

/**
 * Validate and clean recipe data
 */
function validateRecipes(recipes: unknown[]): Recipe[] {
  const validRecipes: Recipe[] = [];
  
  for (const recipe of recipes) {
    try {
      // Type guard to check if recipe is an object
      if (typeof recipe !== 'object' || recipe === null) {
        continue;
      }
      
      const r = recipe as Record<string, unknown>;
      
      // Check required fields
      if (!r.name || !r.ingredients || !r.instructions) {
        console.warn('Skipping invalid recipe (missing required fields):', r.name);
        continue;
      }

      // Build validated recipe matching the Recipe type
      const validRecipe: Recipe = {
        id: generateRecipeId(String(r.name)),
        title: String(r.name),
        source: {
          url: '',
          domain: 'ai-generated',
          chef: 'recipe_tin_eats', // Default to Recipe Tin Eats style
          license: 'unknown',
          fetchedAt: new Date().toISOString(),
        },
        timeMins: Number(r.totalTime) || Number(r.cookTime) + Number(r.prepTime) || 45,
        serves: Number(r.servings) || 4,
        tags: Array.isArray(r.tags) ? r.tags as string[] : [],
        ingredients: Array.isArray(r.ingredients) ? (r.ingredients as Array<Record<string, unknown>>).map(ing => ({
          name: String(ing.name || ''),
          qty: Number(ing.qty) || 1,
          unit: (String(ing.unit) || 'unit') as 'g'|'ml'|'tsp'|'tbsp'|'unit',
        })) : [],
        costPerServeEst: Number(r.estimatedCost) ? Number(r.estimatedCost) / (Number(r.servings) || 4) : undefined,
      };

      validRecipes.push(validRecipe);
    } catch (error) {
      console.warn('Error validating recipe:', error);
      continue;
    }
  }
  
  return validRecipes;
}

/**
 * Generate a consistent recipe ID from the name
 */
function generateRecipeId(name: string): string {
  return `ai-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;
}

/**
 * Test function to verify Gemini API is working
 */
export async function testGeminiConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const result = await model.generateContent('Say "API is working" if you can read this.');
    const text = result.response.text();
    
    return {
      success: true,
      message: `Gemini API connected successfully. Response: ${text}`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
