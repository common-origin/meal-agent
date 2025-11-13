import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('📥 Fetching recipe from URL:', url);

    // Fetch the webpage content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    console.log('✅ Webpage fetched, length:', html.length);

    // Use Gemini to extract recipe from HTML (same model as recipe generation)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
    const result = await model.generateContent(prompt);
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract recipe' },
      { status: 500 }
    );
  }
}
