import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { extractRecipeFromUrlSchema } from '@/lib/api/schemas';
import { parseBody, readJson, requireUserWithinLimit, timeoutResponse } from '@/lib/api/guard';
import { isTimeoutError } from '@/lib/api/aiCall';
import { trackedAiCall } from '@/lib/ai/usage';
import { AI_DEADLINES_MS } from '@/lib/constants';
import { safeFetchHtml, SafeFetchError } from '@/lib/api/safeFetch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_DEADLINES_MS.extractRecipeFromUrl, so the route can return its 504 first.
export const maxDuration = 60;

const MODEL = 'gemini-2.5-flash';

const UNREADABLE_PAGE_MESSAGE = "We couldn't read that page. Check the link or add the recipe manually.";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.extractRecipeFromUrl);
    if (!auth.ok) return auth.response;

    const parsed = parseBody(extractRecipeFromUrlSchema, await readJson(req), 'extract-recipe-from-url');
    if (!parsed.ok) return parsed.response;
    const { url } = parsed.value;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    console.log('📥 Fetching recipe from URL:', url);

    let html: string;
    try {
      ({ html } = await safeFetchHtml(url));
    } catch (error) {
      if (error instanceof SafeFetchError) {
        console.warn(`extract-recipe-from-url: fetch refused (${error.code}):`, error.message);
        const status = error.code === 'invalid_url' || error.code === 'blocked_host' ? 400 : 422;
        return NextResponse.json({ error: UNREADABLE_PAGE_MESSAGE, code: error.code }, { status });
      }
      throw error;
    }
    console.log('✅ Webpage fetched, length:', html.length);

    // Use Gemini to extract recipe from HTML (same model as recipe generation)
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL });

    const prompt = `You are a recipe extraction expert. Extract recipe information from the following HTML content.

HTML Content:
${html.substring(0, 50000)}

Extract and return ONLY a JSON object with this structure (no markdown, no code blocks):
{
  "title": "Recipe Name",
  "timeMins": 30,
  "serves": 4,
  "ingredients": [
    { "name": "ingredient name", "qty": 100, "unit": "g" }
  ],
  "instructions": ["Step 1", "Step 2", "Step 3"]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Extract all ingredients with quantities and units
- Keep instructions concise and clear
- If you can't find certain fields, use reasonable defaults (e.g., serves: 4)
- Units should be: g, ml, tsp, tbsp, or unit
- Instructions should be an array of strings

Extract the recipe now:`;

    console.log('🤖 Calling Gemini API to extract recipe...');
    const result = await trackedAiCall(
      { task: 'extract-recipe-from-url', model: MODEL, userId: auth.value.id },
      AI_DEADLINES_MS.extractRecipeFromUrl,
      (signal) =>
        model.generateContent(prompt, { signal })
    );
    const responseText = result.response.text();
    console.log('📄 Raw Gemini response:', responseText.substring(0, 200));

    // Clean up the response - remove markdown code blocks if present
    let cleanedResponse = responseText.trim();
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\n?/g, '');
    }

    const recipe = JSON.parse(cleanedResponse);
    console.log('✅ Extracted recipe:', recipe.title);

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('❌ Error extracting recipe from URL:', error);
    if (isTimeoutError(error)) return timeoutResponse('extract-recipe-from-url');

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract recipe' },
      { status: 500 }
    );
  }
}
