# Product Intent

This is the source of truth for *why* meal-agent exists and what it needs to
achieve. `ARCHITECTURE.md` describes *how* the code delivers this — if the
two ever disagree, this document wins, and `ARCHITECTURE.md` needs to change,
not the other way around.

## Why this exists

Meal-agent started from a specific, lived frustration: the household was
using meal-kit delivery services (HelloFresh-style boxes) and found them
expensive, not always what the family actually wanted to eat, and — the
real dealbreaker — completely blind to what was already sitting in the
pantry, fridge, or freezer. Groceries bought earlier in the week, or
accumulated over time, went unused while the delivery box brought yet more
food.

The bigger cost wasn't money, though — it was time. Between planning the
week's meals, building a shopping list, and physically shopping at the
supermarket, the household was losing at least half a day of the weekend to
food admin. With only two days a week available for family time, that's a
significant fraction of it spent on a chore rather than with each other.

## Who it's for

Built first to solve this specific household's problem: two adults, two
kids, a real weekly routine of work, school, and kids' activities. Decisions
should optimize for this household's actual needs, not generic flexibility
for a hypothetical broad market.

That said, it's deliberately built to support more than one household, not
just this one — the household is already extended beyond its original
single-household setup, and the intent is for family members and friends
(a brother, for instance) to be able to use it too if they want to. This is
not a public product aimed at strangers or commercial growth — it's a
personal tool meant to extend naturally to the people around this
household, not a single-tenant system that happens to work for only one
family.

## What it needs to do well

These are the actual pillars the product needs to deliver on, in the
household's own terms:

1. **Save time.** Eliminate the weekend cycle of planning, list-building,
   and shopping. This is the headline goal — everything else serves it.
2. **Save money.** Cheaper than meal-kit delivery by design, and cheaper
   than in-person shopping specifically: walking supermarket aisles in
   person reliably leads to impulse spending that planned, pre-decided
   online ordering avoids.
3. **Use what's already there.** Meal plans should account for pantry,
   fridge, and freezer contents — not ignore them the way delivery boxes
   did. This is the reason a pantry/fridge photo-scan feature exists: it's
   the input that lets planning account for what's already on hand.
4. **Learn the household's taste from its own recipes, not just serve
   them.** Being able to photograph recipes from cookbooks already in the
   house — the same idea as the pantry photo-scan, applied to recipes — is
   about more than digitizing a recipe collection. Each recipe added this
   way, or in any other way, is a seed that helps the product understand
   what this household actually likes, which the agent then draws on to
   find or generate new recipes that fit. The recipe library is training
   signal for personalization, not just a list of things to cook.
5. **Personalize to the household.** Meal plans reflect this household's
   actual dietary needs, preferences, and constraints, not a generic
   template.
6. **Connect planning straight through to delivery.** The original intent
   isn't just "produce an order" — it's one continuous process from
   deciding the week's meals to having them bought and delivered to the
   house at a time of the household's choosing, with click & collect as an
   acceptable fallback where delivery isn't practical. Stopping at a
   shopping list, or even a placed order, is a step short of the actual
   goal: a plan that still requires someone to drive to the supermarket
   hasn't fully delivered on the time savings. Getting all the way to
   delivery has been blocked by real technical constraints (Coles has no
   public product API or partner program — see issue #36),
   not by a decision that a shopping list is good enough.
7. **Help the kids eat more adventurously.** A secondary but real goal:
   surfacing recipes and cuisines the family wouldn't have tried on their
   own, so the kids are exposed to a wider range of food.

## Validation

This isn't speculative — the household has been using meal-agent for its
own weekly planning for roughly 6–12 months, and it has genuinely worked
across most of these goals. Architecture and feature decisions should be
weighed against a product that's already proven useful in daily use, not
treated as a prototype still searching for product-market fit.

## The guiding principle for what to build next

**As simple as possible for the user, with as little manual input as
possible.** The current focus isn't adding new capability so much as making
sure the architecture actually supports this vision cleanly — and every
future change should be judged by whether it reduces manual, repetitive
effort for the person using it, not just whether it's technically
interesting. When a piece of the system requires the household to do
something by hand that the system could reasonably do for them, that's a
gap worth closing.
