/**
 * ICS calendar feed for a household's weekly meal plan (issue #3).
 *
 * Unauthenticated by design: this is polled on a schedule by an external
 * script (e.g. GAS-ICS-Sync) that can only issue a plain HTTP GET, not sign
 * in. Access is instead gated by households.ics_token, a dedicated secret
 * separate from households.id (see migration 006) — treat this URL like a
 * password. Looked up with the service-role client since RLS otherwise
 * requires an authenticated session.
 */

import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// Every meal is exported at a fixed dinner time — no per-meal time field
// exists yet (decided as out of scope when this was built; see issue #3).
const MEAL_TIME_LOCAL = '18:00:00';
const MEAL_DURATION_HOURS = 1;
// No per-household timezone setting exists yet (FamilySettings only has
// city/country/hemisphere, used for seasonal logic, not a real IANA zone).
// Defaulting to the household's actual home timezone rather than UTC.
const TZID = 'Australia/Sydney';

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function localDateTimeStamp(dateISO: string, timeLocal: string): string {
  return `${dateISO.replace(/-/g, '')}T${timeLocal.replace(/:/g, '')}`;
}

function addHoursToLocalTime(timeLocal: string, hours: number): string {
  const [h, m, s] = timeLocal.split(':').map(Number);
  const totalMinutes = ((h * 60 + m + hours * 60) % (24 * 60) + 24 * 60) % (24 * 60);
  const endH = Math.floor(totalMinutes / 60);
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token) {
    return new NextResponse('Not found', { status: 404 });
  }

  const supabase = createAdminClient();

  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id, name')
    .eq('ics_token', token)
    .single();

  if (householdError || !household) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Only current-week-onward plans — a feed of past dinners isn't useful,
  // and old weeks would otherwise accumulate indefinitely.
  const startOfThisWeekISO = dayjs().day(1).format('YYYY-MM-DD');

  const { data: plans, error: plansError } = await supabase
    .from('meal_plans')
    .select('week_start, meals')
    .eq('household_id', household.id)
    .gte('week_start', startOfThisWeekISO)
    .order('week_start', { ascending: true });

  if (plansError) {
    return new NextResponse('Failed to load meal plan', { status: 500 });
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('id, title')
    .eq('household_id', household.id);

  const recipeTitleById = new Map((recipes ?? []).map((r) => [r.id, r.title]));

  // Vercel's Node.js function runtime runs in UTC, so the server's own
  // local time already is UTC — no timezone plugin needed for DTSTAMP.
  const nowStamp = `${dayjs().format('YYYYMMDDTHHmmss')}Z`;

  const events: string[] = [];

  for (const plan of plans ?? []) {
    const meals = plan.meals as Record<string, { recipeId: string; servings?: number } | null> | null;
    if (!meals) continue;

    DAY_KEYS.forEach((dayKey, index) => {
      const meal = meals[dayKey];
      if (!meal?.recipeId) return;

      const title = recipeTitleById.get(meal.recipeId) ?? 'Meal plan dinner';
      const dateISO = dayjs(plan.week_start).add(index, 'day').format('YYYY-MM-DD');
      const dtStart = localDateTimeStamp(dateISO, MEAL_TIME_LOCAL);
      const dtEnd = localDateTimeStamp(dateISO, addHoursToLocalTime(MEAL_TIME_LOCAL, MEAL_DURATION_HOURS));
      const uid = `${household.id}-${dateISO}@meal-agent.vercel.app`;

      events.push(
        [
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTAMP:${nowStamp}`,
          `DTSTART;TZID=${TZID}:${dtStart}`,
          `DTEND;TZID=${TZID}:${dtEnd}`,
          `SUMMARY:${icsEscape(title)}`,
        ].join('\r\n') + '\r\nEND:VEVENT'
      );
    });
  }

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//meal-agent//meal-plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(household.name)} Meal Plan`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(calendar, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="meal-plan.ics"',
      'Cache-Control': 'no-store',
    },
  });
}
