---
name: sync-docs
description: Check whether meal-agent's .github/*.md documentation (ARCHITECTURE.md, PROJECT_STATUS.md, PROJECT_INSTRUCTIONS.md, API_REFERENCE.md, DEVELOPMENT.md, DESIGN_SYSTEM_MIGRATION.md, AI_SETUP.md) still matches the current branch's changes, and update only the affected facts. Run this before opening a PR whenever the branch touches apps/web/src/lib/, API routes, package.json versions, AI/Gemini model usage, or completes a roadmap item — and also whenever the user asks to "sync the docs," "update the documentation," or "does the doc need updating," even if they don't name a specific file. Prefer this over a manual doc edit whenever the same fact might be stated in more than one place in .github/, since that's where this repo's documentation has drifted before.
---

# Sync docs

This repo's `.github/*.md` files describe the product and architecture, but they drift from the code easily — a version number or model name gets updated in one file and not the others it's also written into. CLAUDE.md's "Known drift" section lists several cases of exactly this. This skill's job is to catch that drift for the *current* change before it merges, not to rewrite the docs wholesale.

Stay conservative: this runs right before a PR, so a developer needs to trust its output at a glance. Touch only what the diff actually justifies. If you're inferring rather than reading it directly in the diff, don't write it.

## Steps

1. **See what actually changed.** Diff the current branch against the base branch:
   ```
   git diff origin/main...HEAD
   ```
   If there's no remote tracking or the branch isn't pushed, diff against `main` locally instead. Read the actual diff, not just the file list — the doc updates need to reflect what changed, not just that something in a file changed.

2. **Map the changed areas to the docs that describe them.** Use this as a starting point, not an exhaustive rulebook — read the actual doc content to confirm a match before editing it:

   | Change touches... | Likely needs an update in... |
   |---|---|
   | `apps/web/src/lib/*storage*` / `*Storage*.ts` | `ARCHITECTURE.md` (storage section) |
   | `package.json` dependency versions (e.g. `@common-origin/design-system`) | Any doc stating that version in prose — check `PROJECT_INSTRUCTIONS.md`, `DEVELOPMENT.md`, `DESIGN_SYSTEM_MIGRATION.md` |
   | AI/Gemini model strings (e.g. `gemini-2.5-pro`) | `AI_SETUP.md`, `ARCHITECTURE.md`, `PROJECT_STATUS.md` |
   | New or changed routes under `apps/web/src/app/api/` | `API_REFERENCE.md` |
   | A feature going from in-progress to shipped, or vice versa | `PROJECT_STATUS.md`'s roadmap/phase list |

3. **Search for every other copy of the same fact before editing one.** If the diff changes a version number or model name, `grep -rn` for the old value across `.github/*.md` and update every occurrence together. A doc fixed in only one place is exactly how this repo's drift happened the first time — the fix needs to close that gap everywhere, not add a third value to the mix.

4. **Edit precisely.** Change only the sentence or line the diff justifies. Don't rewrite a whole section for one fact, don't touch a nearby paragraph because it "could be clearer," and don't add claims the diff doesn't support (e.g. don't mark a phase "complete" because one part of it landed).

5. **Handle CLAUDE.md's Known Drift list specially.** If your fix in step 3 or 4 happens to resolve one of the specific discrepancies listed in `CLAUDE.md`'s "Known drift" section (e.g. the design-system version is now consistent everywhere), don't edit `CLAUDE.md` yourself — that file is a hand-maintained index, not a target for this skill. Instead, flag it clearly in your summary so the developer can remove that line themselves.

6. **Note drift you're not fixing.** If you spot documentation that's stale but unrelated to this diff — a pre-existing inaccuracy this branch didn't cause — don't silently fix it (out of scope for a pre-PR sync) and don't silently ignore it either. List it separately in your summary as unrelated drift, so it doesn't get lost.

## Output

End with a short summary, not a restatement of the docs:

```
## Docs updated
- <file>: <what changed> — because <diff reference, e.g. "package.json now pins design-system ^2.13.0">

## CLAUDE.md drift resolved (remove manually)
- <the specific Known Drift line this run fixed, if any>

## Unrelated drift spotted, not fixed by this run
- <file>: <what looks stale> — unrelated to this branch's changes
```

If nothing in the diff affects the docs, say so plainly and stop — don't manufacture an update to justify the run.
