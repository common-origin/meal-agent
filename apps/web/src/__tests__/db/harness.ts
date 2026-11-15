/**
 * A real Postgres for testing RLS and the database functions (#67): PGlite
 * (Postgres compiled to WASM) with every migration in supabase/migrations
 * applied in order. Supabase's own pieces are stood in for by the smallest
 * thing that behaves the same way:
 * - `auth.users` and `auth.uid()` (reading the `request.uid` setting, which
 *   `as()` sets per query);
 * - the `anon`, `authenticated` and `service_role` roles, with Supabase's
 *   default grants on new tables and functions in `public`.
 * Queries made through `as()` run as `authenticated` (or `anon`), so RLS
 * applies as it does in production. Seeding goes through `db` directly, as
 * the superuser, which bypasses RLS.
 *
 * What this can't catch: anything outside Postgres (GoTrue, PostgREST), and
 * grants that differ from Supabase's defaults.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';

const MIGRATIONS_DIR = join(__dirname, '../../../../../supabase/migrations');

export interface TestDb {
  db: PGlite;
  /** Runs `sql` as `role` with auth.uid() = `uid` (RLS applies), then resets. */
  as: <T = Record<string, unknown>>(uid: string | null, sql: string, params?: unknown[], role?: 'authenticated' | 'anon' | 'service_role') => Promise<T[]>;
  /** The error message `as()` raised, or null if it succeeded. */
  refusal: (uid: string | null, sql: string, params?: unknown[], role?: 'authenticated' | 'anon' | 'service_role') => Promise<string | null>;
  /** Creates a user (letting their email past invite-only signup); the signup trigger gives them a household. */
  signUp: (email: string) => Promise<string>;
  /** The user's household and role. */
  householdOf: (uid: string) => Promise<{ household_id: string; role: string } | undefined>;
}

/** A fresh database with every migration applied. Takes a second or two: share one per test file. */
export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite({ extensions: { uuid_ossp } });

  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      raw_user_meta_data JSONB
    );
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    -- As on Supabase: new tables and functions in public are granted to these
    -- roles, and RLS (or a function's own REVOKE) decides.
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  `);

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const as: TestDb['as'] = async (uid, sql, params = [], role = 'authenticated') => {
    await db.query(`SELECT set_config('request.uid', $1, false)`, [uid ?? '']);
    await db.exec(`SET ROLE ${role}`);
    try {
      return (await db.query(sql, params)).rows as never;
    } finally {
      await db.exec('RESET ROLE');
      await db.query(`SELECT set_config('request.uid', '', false)`);
    }
  };

  const refusal: TestDb['refusal'] = async (uid, sql, params, role) => {
    try {
      await as(uid, sql, params, role);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  const signUp = async (email: string) => {
    await db.query(`INSERT INTO public.signup_invites (email) VALUES ($1) ON CONFLICT DO NOTHING`, [email.toLowerCase()]);
    const { rows } = await db.query<{ id: string }>(`INSERT INTO auth.users (email) VALUES ($1) RETURNING id`, [email]);
    return rows[0].id;
  };

  const householdOf = async (uid: string) =>
    (await db.query<{ household_id: string; role: string }>(
      `SELECT household_id, role FROM public.household_members WHERE user_id = $1`,
      [uid],
    )).rows[0];

  return { db, as, refusal, signUp, householdOf };
}
