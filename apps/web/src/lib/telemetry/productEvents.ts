/**
 * The whitelist of anonymous product events the server accepts (admin
 * dashboard, #247). Shared by the browser (which maps its local analytics
 * events to these in toServerEvent) and POST /api/telemetry/events (which
 * validates every event again).
 *
 * Privacy by construction: each event type has a strict schema, so an
 * unknown key is rejected, and the only strings allowed are enums and
 * `weekStart` (a YYYY-MM-DD date). There is no place for a recipe ID, a
 * title, a name or free text. Safe to import from the client: no node-only
 * modules.
 */

import { z } from 'zod';

/** A real calendar date as YYYY-MM-DD: the same week key as meal_plans.week_start. */
const weekStart = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

const count = z.number().int().min(0).max(1000);
const none = z.strictObject({});

const event = <T extends string, P extends z.ZodType>(type: T, props: P) => z.strictObject({ type: z.literal(type), props });

export const serverEventSchema = z.discriminatedUnion('type', [
  event(
    'plan_composed',
    z.strictObject({ dayCount: count, pantryItemCount: count, cuisineCount: count, proteinVariety: count, weekStart })
  ),
  event('plan_confirmed', z.strictObject({ weekStart })),
  event('plan_edit', z.strictObject({ nights: count })),
  event('plan_edit_accepted', z.strictObject({ nights: count })),
  event('swap', z.strictObject({ kind: z.enum(['add', 'swap', 'delete']) })),
  event('export_csv', none),
  event('shopping_list_built', z.strictObject({ weekStart, itemCount: count })),
  event('coles_list_sent', z.strictObject({ weekStart, itemCount: count })),
  event('shopping_completed', z.strictObject({ weekStart })),
  event('favorite_added', none),
  event('favorite_removed', none),
  event('price_reported', none),
  event('recipe_emailed', none),
  event('recipe_rated', z.strictObject({ stars: z.number().int().min(1).max(5) })),
]);

export type ServerEvent = z.infer<typeof serverEventSchema>;
export type ServerEventType = ServerEvent['type'];

export const MAX_EVENTS_PER_BATCH = 20;

export const eventBatchSchema = z.strictObject({
  events: z.array(serverEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

export const EVENTS_ENDPOINT = '/api/telemetry/events';
