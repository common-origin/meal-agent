/**
 * API Route: Scan Pantry/Fridge Image
 * POST /api/scan-pantry-image
 * 
 * Identifies ingredients in a photo, with Australian names and use-soon flags (#91)
 */

import { NextRequest, NextResponse } from 'next/server';
import { aiRateLimiters } from '@/lib/api/rateLimit';
import { readImageUpload, requireUserWithinLimit } from '@/lib/api/guard';
import { runAiTask } from '@/lib/ai/run';
import { aiErrorResponse, aiFailureResponse } from '@/lib/ai/errors';
import { PantryScan } from '@/lib/ai/schemas';
import type { ScannedPantryItem } from '@/lib/pantryItems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Must stay above AI_TASKS.pantryScan.deadlineMs, so the route can return its 504 first.
export const maxDuration = 60;

/** Trimmed, lowercased and de-duplicated; a duplicate flagged use-soon keeps the flag. */
function tidyScannedItems(items: { name: string; useSoon: boolean }[]): ScannedPantryItem[] {
  const byName = new Map<string, ScannedPantryItem>();
  for (const item of items) {
    const name = item.name.trim().toLowerCase();
    if (!name) continue;
    const existing = byName.get(name);
    byName.set(name, { name, useSoon: item.useSoon || (existing?.useSoon ?? false) });
  }
  return [...byName.values()];
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserWithinLimit(aiRateLimiters.scanPantryImage);
    if (!auth.ok) return auth.response;

    if (!process.env.GEMINI_API_KEY) {
      console.error('scan-pantry-image: GEMINI_API_KEY is not configured');
      return aiErrorResponse('unknown');
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

    const prompt = `Identify the food items and ingredients you can see in this photo of a fridge or pantry, for an Australian household.

INSTRUCTIONS:
- Name each item the way Coles labels it: lowercase, singular where natural, short and searchable. Use Australian names, e.g. "capsicum", "beef mince", "cherry tomatoes", "tasty cheese", "spring onions", "greek yoghurt", "coconut milk", "chicken thigh fillets".
- Include produce, meat and fish, dairy and packaged food, plus sauces, pastes, canned goods and spices whose label you can clearly read (e.g. "red curry paste", "soy sauce", "diced tomatoes").
- Skip salt, pepper, cooking oil and anything you can't identify confidently.
- Set useSoon to true for visibly ripe or wilting produce, opened containers, and fresh meat or fish; otherwise false.
- List each item once.`;

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
      console.warn(`scan-pantry-image: response blocked (${result.rawFinishReason ?? 'content filtered'})`);
      return aiErrorResponse('blocked');
    }

    const items = tidyScannedItems(result.output.items);
    console.log('✅ Extracted pantry items:', items);

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      message: items.length > 0
        ? `Found ${items.length} ingredients. Please review and edit as needed.`
        : 'No ingredients detected. Try taking a clearer photo with better lighting.',
    });

  } catch (error) {
    return aiFailureResponse(error, 'scan-pantry-image');
  }
}
