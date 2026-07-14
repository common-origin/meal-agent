/**
 * API Route: Share a recipe via email
 * POST /api/share-recipe-email
 *
 * Body: { recipeId: string, recipientEmails: string[], note?: string }
 *
 * - Requires an authenticated Supabase session.
 * - Recipient emails must already exist in the user's saved settings list
 *   (settings.recipeRecipients) — recipients are not free-form per send.
 * - Loads the recipe from the user's household.
 * - Sends one email per recipient via Resend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { render } from '@react-email/components';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import RecipeEmail from '@/emails/RecipeEmail';
import type { Recipe } from '@/lib/types/recipe';
import type { FamilySettings, RecipeRecipient } from '@/lib/types/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NOTE_LENGTH = 280;
const MAX_RECIPIENTS_PER_SEND = 5;

// Simple per-user rate limit: max 10 sends per 5 minutes
const sendCache = new Map<string, number[]>();
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 10;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (sendCache.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_SENDS_PER_WINDOW) return false;
  recent.push(now);
  sendCache.set(userId, recent);
  return true;
}

interface LoadedRecipeRow {
  id: string;
  title: string;
  source_url: string | null;
  source_domain: string;
  source_chef: string | null;
  created_at: string;
  time_mins: number;
  serves: number;
  tags: string[];
  ingredients: unknown;
  instructions: string[] | null;
  cost_per_serve_est: number | null;
  nutrition: unknown;
}

function rowToRecipe(data: LoadedRecipeRow): Recipe {
  return {
    id: data.id,
    title: data.title,
    source: {
      url: data.source_url || '',
      domain: data.source_domain,
      chef: data.source_chef || '',
      license: 'unknown',
      fetchedAt: data.created_at,
    },
    timeMins: data.time_mins,
    serves: data.serves,
    tags: data.tags,
    ingredients: data.ingredients as Recipe['ingredients'],
    instructions: data.instructions || undefined,
    costPerServeEst: data.cost_per_serve_est || undefined,
    nutrition: (data.nutrition as Recipe['nutrition']) || undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.RESEND_FROM_ADDRESS;
    if (!apiKey || !fromAddress) {
      return NextResponse.json(
        { error: 'Email service is not configured.' },
        { status: 503 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a few minutes before sending more emails.' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { recipeId, recipientEmails, note } = body as {
      recipeId?: unknown;
      recipientEmails?: unknown;
      note?: unknown;
    };

    if (typeof recipeId !== 'string' || !recipeId) {
      return NextResponse.json({ error: 'recipeId is required' }, { status: 400 });
    }
    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return NextResponse.json({ error: 'recipientEmails must be a non-empty array' }, { status: 400 });
    }
    if (recipientEmails.length > MAX_RECIPIENTS_PER_SEND) {
      return NextResponse.json(
        { error: `At most ${MAX_RECIPIENTS_PER_SEND} recipients per send` },
        { status: 400 }
      );
    }
    const normalizedRequestEmails = recipientEmails
      .filter((e): e is string => typeof e === 'string')
      .map((e) => e.trim().toLowerCase());
    if (normalizedRequestEmails.length === 0) {
      return NextResponse.json({ error: 'No valid recipient emails provided' }, { status: 400 });
    }

    const trimmedNote =
      typeof note === 'string' ? note.trim().slice(0, MAX_NOTE_LENGTH) : undefined;

    const supabase = await createClient();

    // Find the user's household
    const { data: membership, error: membershipError } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No household found for user' }, { status: 403 });
    }
    const householdId = membership.household_id;

    // Load saved recipients from family settings
    const { data: settingsRow } = await supabase
      .from('family_settings')
      .select('full_settings')
      .eq('household_id', householdId)
      .single();
    const savedSettings = (settingsRow?.full_settings || {}) as Partial<FamilySettings>;
    const savedRecipients: RecipeRecipient[] = savedSettings.recipeRecipients || [];
    const savedMap = new Map(savedRecipients.map((r) => [r.email.trim().toLowerCase(), r]));

    const resolved: RecipeRecipient[] = [];
    const rejected: string[] = [];
    for (const email of normalizedRequestEmails) {
      const match = savedMap.get(email);
      if (match) resolved.push(match);
      else rejected.push(email);
    }
    if (resolved.length === 0) {
      return NextResponse.json(
        { error: 'No requested recipients are saved in your settings.', rejected },
        { status: 400 }
      );
    }

    // Load the recipe within the user's household
    const { data: recipeRow, error: recipeErr } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('household_id', householdId)
      .single();
    if (recipeErr || !recipeRow) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }
    const recipe = rowToRecipe(recipeRow as unknown as LoadedRecipeRow);

    // Determine sender name (display name from auth metadata, fallback to email local-part)
    const senderName =
      (user.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
      (user.user_metadata as { full_name?: string; name?: string } | null)?.name ||
      user.email?.split('@')[0] ||
      'A friend';
    const senderEmail = user.email || undefined;

    const resend = new Resend(apiKey);

    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];

    for (const recipient of resolved) {
      try {
        const html = await render(
          RecipeEmail({
            recipe,
            recipientName: recipient.name,
            senderName,
            senderNote: trimmedNote,
          })
        );
        const text = await render(
          RecipeEmail({
            recipe,
            recipientName: recipient.name,
            senderName,
            senderNote: trimmedNote,
          }),
          { plainText: true }
        );

        const result = await resend.emails.send({
          from: fromAddress,
          to: recipient.email,
          replyTo: senderEmail,
          subject: `${senderName} sent you a recipe: ${recipe.title}`,
          html,
          text,
        });

        if (result.error) {
          failed.push({ email: recipient.email, error: result.error.message || 'Send failed' });
        } else {
          sent.push(recipient.email);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        failed.push({ email: recipient.email, error: message });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      sent,
      failed,
      rejected,
    });
  } catch (error) {
    console.error('share-recipe-email error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
