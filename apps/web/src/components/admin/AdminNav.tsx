"use client";

import { SidebarNav, SidebarNavItem, type IconName } from "@common-origin/design-system";
import type { AttentionCounts } from "@/lib/admin/attention";

const ITEMS: { id: string; label: string; icon: IconName; count: (counts: AttentionCounts) => number }[] = [
  { id: "overview", label: "Overview", icon: "home", count: (counts) => counts.total },
  { id: "status", label: "Status", icon: "clock", count: (counts) => counts.status },
  { id: "errors", label: "Errors", icon: "statusError", count: (counts) => counts.errors },
  { id: "ai", label: "AI agent", icon: "ai", count: (counts) => counts.ai },
  { id: "cost", label: "Cost and quotas", icon: "wallet", count: (counts) => counts.cost },
  { id: "households", label: "Households", icon: "users", count: (counts) => counts.households },
  { id: "cycle", label: "Weekly cycle", icon: "calendar", count: () => 0 },
  { id: "database", label: "Database", icon: "table", count: (counts) => counts.database },
  { id: "debug", label: "Debug pages", icon: "settings", count: () => 0 },
];

/**
 * One item per area of the page, each with the number of things in the triage
 * inbox that belong to it. Anchor links for now: they scroll this page (the
 * areas can become routes later). `onNavigate` lets a Sheet close itself.
 */
export function AdminNav({ counts, onNavigate }: { counts: AttentionCounts | null; onNavigate?: () => void }) {
  return (
    <SidebarNav label="Sections" width="narrow" collapsible={false}>
      {ITEMS.map((item) => {
        const count = counts ? item.count(counts) : 0;
        return <SidebarNavItem key={item.id} label={item.label} icon={item.icon} url={`#${item.id}`} badge={count > 0 ? count : undefined} badgeLabel={`${count} need attention`} onClick={onNavigate} />;
      })}
    </SidebarNav>
  );
}
