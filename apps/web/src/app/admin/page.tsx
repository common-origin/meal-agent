import { notFound } from "next/navigation";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { isAdminEmail } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import { parseHouseholdParam, parseRange } from "@/lib/admin/format";
import { adminLinks } from "@/lib/admin/links";
import { loadDashboard } from "@/lib/admin/queries";

export const metadata = { title: "Admin · Meal Agent", robots: { index: false, follow: false } };
// Read when requested, never prerendered or cached: it shows live health and usage.
export const dynamic = "force-dynamic";

/**
 * /admin (#249): the owner's overview of product health, errors, the AI agent,
 * cost, households and usage. proxy.ts already redirects anyone who isn't in
 * ADMIN_EMAILS to /plan; as defence in depth the page checks again on the
 * server and answers 404, so nothing here is ever sent to anyone else.
 */
export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) notFound();

  const params = await searchParams;
  const data = await loadDashboard({ range: parseRange(params.range), household: parseHouseholdParam(params.household) });
  // Built here, on the server, and passed down: the dashboard is a client component and the browser has no process.env (React #418 otherwise).
  return <AdminDashboard data={data} links={adminLinks(process.env)} />;
}
