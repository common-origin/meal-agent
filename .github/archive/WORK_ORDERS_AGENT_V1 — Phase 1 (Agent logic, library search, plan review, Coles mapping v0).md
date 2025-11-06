# WORK_ORDERS_AGENT_V1 — Phase 1 (Agent logic, library search, plan review, Coles mapping v0)

**Intent:** Introduce real agent logic that retrieves recipes from our stored library (RecipeTin Eats for now), composes a weekly plan using prefs/overrides, provides explainable choices, and upgrades the shopping list with early Coles mapping.

Keep this document light on code. Copilot should use the repo’s existing files, patterns, and types.

---

## 0) How the agent works (mental model)

1. **Library** → We maintain a local recipe library (currently RecipeTin Eats) that stores: title, image, `timeMins`, tags (kid‑friendly, gluten‑light, high‑protein, organic‑ok), ingredients (normalized), serves, and source metadata.
2. **Search** → Given `Household + WeeklyOverrides`, the agent queries the library for candidates by time, diet tags, chef, and variety.
3. **Score** → Each candidate is scored by rules (weeknight ≤40m; kid‑friendly on weeknights; reuse ingredients already selected; cost proxy via cheapest-per‑unit/pack reuse; avoid same protein >2×). Favorites boost; recency and repetition penalties.
4. **Compose** → The agent greedily fills the week (default 5 dinners), ensuring constraints per day. If leftovers are enabled, selects one bulk‑friendly recipe and reduces unique meals.
5. **Explain** → For each selected recipe, generate short reason chips (rule-based; LLM optional): “≤40m”, “kid‑friendly”, “reuses spinach”, “best value”, “bulk cook”. Provide 3 swap suggestions per day (same chef first).
6. **Output** → `PlanWeek` + `suggestedSwaps` + aggregated shopping list grouped by aisle. Coles mapping v0 maps ingredients → hand‑maintained SKU IDs with simple size rules; price estimate is optional.

---

## WORK ORDER 1 — Library adapter (consume stored recipes)

**Ask Copilot:** Wire a **Library adapter** that reads our stored RecipeTin Eats JSON into the app’s library interface (searchable by tags/time/keywords). Provide helpers to add tags like `kid_friendly`, `gluten_light`, `high_protein`, `organic_ok` if present in our scraped metadata or via simple heuristics. Keep storage local for now.

**AC (high‑level)**

* Library can return candidates filtered by time, tags, and (future) chef.
* Results include normalized ingredients and serves.

**Artifacts**

* Library adapter module; tag normalization utilities; small docs note.

---

## WORK ORDER 2 — Search + scoring (deterministic rules)

**Ask Copilot:** Implement a **search + score** pipeline that, given `Household + WeeklyOverrides`, ranks candidates by:

* Hard filters: weeknight `timeMins ≤ 40` and `kid_friendly` (when required); diet tags from overrides
* Ingredient reuse bonus across the week; favorites bonus; repetition penalty (same protein >2×)
* Value proxy: prefer larger pack reuse (if an ingredient appears ≥2×)

Return the **top N** per day to feed into composition.

**AC**

* Weeknights always meet the ≤40m + kid‑friendly constraint when flag is on
* Score contains explainable reasons (which rules fired)

**Artifacts**

* Scoring function; rule weights defined in a single place; short rationale doc.

---

## WORK ORDER 3 — Composer v1 (with leftovers + variety)

**Ask Copilot:** Build **Composer v1** that fills the week (default 5 dinners) using scored candidates. Enforce: variety by protein type, reuse bias, leftovers option (one bulk recipe reduces unique count), and respect favorites without repeating within 3 weeks.

**AC**

* Returns `PlanWeek` with daily assignments and `reasons[]` per meal
* Produces up to 3 `suggestedSwaps` per day (same chef first)

**Artifacts**

* Composer module; tests at function level (no UI)

---

## WORK ORDER 4 — Explainability (LLM optional, lightweight)

**Ask Copilot:** Add an **Explain** step that turns rule hits into short human‑readable chips. Keep it deterministic now; shape an adapter so we can swap in a small LLM later to improve phrasing. Chips should be stable and limited (≤3 per card).

**AC**

* Meal cards show ≤3 concise reason chips consistent with selection rules

**Artifacts**

* Explain adapter; mapping table from rule → chip text

---

## WORK ORDER 5 — Plan Review page

**Ask Copilot:** Create a **Plan Review** view that summarizes the week: meals by day, total cost estimate, key constraints satisfied (weeknight ≤40m, kid‑friendly), and ingredient reuse highlights. Include “Regenerate with constraints” (e.g., keep Tue/Fri, aim lower cost, maximize reuse) that reruns compose with those constraints.

**AC**

* Displays plan KPIs + per‑day cards with reasons and swap buttons
* Regenerate flow allows pinning specific days and adjusting goals

**Artifacts**

* Plan Review route or section; regen constraints surface

---

## WORK ORDER 6 — Shopping List v1.1 (aggregation improvements)

**Ask Copilot:** Upgrade aggregation to de‑duplicate ingredients across recipes, normalize units, and group by aisle. Indicate which meals contribute to each line. Provide a toggle to hide items present in pantry overrides. Keep CSV export.

**AC**

* Aisle groups show consolidated quantities; contribution hover or disclosure
* Pantry toggle hides unchecked lines

**Artifacts**

* Aggregator utilities update; small UI additions in Shopping List

---

## WORK ORDER 7 — Coles mapping v0 (SKU table + size logic)

**Ask Copilot:** Introduce **manual SKU mapping**: a local editable table mapping `ingredient name → { skuId, size, unitPrice?, brand }`. Apply simple pack‑size logic: if total weekly qty ≥ pack size × K, choose a larger pack; otherwise standard pack. Leave price optional for now.

**AC**

* Each shopping list line shows mapped SKU (or “needs choice”)
* Size suggestion adjusts when quantities increase with swaps

**Artifacts**

* Mapping table; mapping utility; basic UI indicator

> Note: Access to live Coles SKUs may require approved APIs or on‑device automation later. This step establishes the shape; we can later plug in a real data source.

---

## WORK ORDER 8 — Favorites learning + repetition window

**Ask Copilot:** Use `favorites[]` to nudge selection but enforce a **no‑repeat window** (e.g., 3 weeks) to maintain variety.

**AC**

* Favorites appear more often but not more than once within 3 weeks

**Artifacts**

* Simple recency tracker (local)

---

## WORK ORDER 9 — Local analytics updates

**Ask Copilot:** Extend analytics with events: `plan_composed`, `plan_regenerated`, `swap_suggested`, `swap_accepted`, `coles_map_needs_choice`. Keep storage local; append event payloads for debugging on `/admin/debug`.

**AC**

* New events appear with payloads; opt‑out respected

**Artifacts**

* Analytics additions; debug panel columns

---

## WORK ORDER 10 — A11y & mobile parity pass

**Ask Copilot:** Ensure keyboard flows for swap and regenerate; ensure touch targets ≥44px; verify focus order and `aria-live` messages on compose and swap. Validate responsive layout for phone.

**AC**

* Swap is fully usable with keyboard; banners and toasts are announced
* Mobile grid/list remains readable and tappable

**Artifacts**

* Minor tweaks across grid, drawer, and review page

---

## Deliverable definition (Phase 1)

* Agent composes from the **stored RecipeTin Eats** library with explainable reasons
* Plan Review supports pin/regenerate workflows
* Shopping list aggregates intelligently and shows basic **Coles mapping v0**
* Favorites bias + repetition window
* Local analytics reflects compose/swap flows
* A11y and mobile parity maintained

---

## Parking lot (later phases)

* Expand library to **Jamie Oliver** via sitemap parser
* Price-aware estimator with live or cached pack prices
* Coles cart helper or API partnership
* Notifications (push/email)
* Cloud persistence (Supabase) and auth hardening
