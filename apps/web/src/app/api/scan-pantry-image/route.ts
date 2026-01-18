/**
 * API Route: Scan Pantry/Fridge Image
 * POST /api/scan-pantry-image
 * 
 * Uses Google Gemini Vision to identify ingredients from a photo
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const image = formData.get('image') as File;

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    console.log('📸 Scanning pantry/fridge image:', {
      name: image.name,
      size: `${(image.size / 1024).toFixed(1)}KB`,
      type: image.type,
    });

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Use Gemini Vision to identify ingredients
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.3, // Slightly higher for variety in ingredient naming
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });

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

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType: image.type || 'image/jpeg',
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text().trim();

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
    console.error('❌ Error scanning pantry image:', error);
    
    // Check for rate limit error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit = errorMessage.includes('429') || 
                       errorMessage.includes('Too Many Requests') ||
                       errorMessage.includes('Resource exhausted');
    
    if (isRateLimit) {
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
