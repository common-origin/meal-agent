# Architecture Documentation

**Last Updated**: 6 November 2025  
**Version**: Phase 1 & 2 Complete

## System Overview

Meal Agent is a Next.js-based AI-powered meal planning application that helps households plan weekly dinners using a combination of curated recipes and AI-generated meals. The system integrates Google's Gemini API for recipe generation, pantry scanning, and URL extraction, combined with deterministic scoring algorithms, explainability, cost transparency, and privacy-first analytics.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            MEAL AGENT                                    │
│                        (Next.js 16 / React 19)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐       │
│  │  UI Layer    │───▶│  Logic Layer    │───▶│   Data Layer     │       │
│  │              │    │                 │    │                  │       │
│  │ • Pages      │    │ • compose.ts    │    │ • library.ts     │       │
│  │ • Components │    │ • scoring.ts    │    │ • recipes.json   │       │
│  │ • Drawers    │    │ • explainer.ts  │    │ • localStorage   │       │
│  │ • Cards      │    │ • aggregator.ts │    │ • Gemini API     │       │
│  │              │    │ • colesMapping  │    │                  │       │
│  │              │    │ • analytics.ts  │    │                  │       │
│  └──────────────┘    └─────────────────┘    └──────────────────┘       │
│                                │                                         │
│                                ▼                                         │
│                      ┌──────────────────┐                                │
│                      │   AI Layer       │                                │
│                      │ • Gemini API     │                                │
│                      │ • Recipe Gen     │                                │
│                      │ • Image OCR      │                                │
│                      │ • URL Extract    │                                │
│                      └──────────────────┘                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Build Process
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BUILD-TIME PIPELINE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐      │
│  │ indexChefs.ts│───▶│buildRecipe   │───▶│ recipes.generated    │      │
│  │              │    │Library.ts    │    │ .json                │      │
│  │ Web Scraping │    │ • Transform  │    │ • 50+ recipes        │      │
│  │ JSON-LD      │    │ • Normalize  │    │ • Normalized tags    │      │
│  │ Filtering    │    │ • Tag norm.  │    │ • Static output      │      │
│  └──────────────┘    └──────────────┘    └──────────────────────┘      │
│         │                                                                 │
│         └──▶ data/library/nagi/*.json (Individual Indexed Recipes)      │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Phase 1 & 2 Architecture Layers

### 1. UI Layer (`apps/web/src/components/` & `apps/web/src/app/`)

**Design System**: @common-origin/design-system v1.14.0
- Sheet, Slider, PasswordField, ResponsiveGrid, IconButton
- Button, TextField, Dropdown, Checkbox, Container, Box
- Typography, Avatar, Stack, Chip, Divider, NumberInput

**Components**:
- `MealCard.tsx` - Meal display with reason chips and customization props
- `LeftoverCard.tsx` - Bulk cook leftover placeholder
- `ShoppingListItem.tsx` - Expandable ingredient with Coles info
- `RegenerateDrawer.tsx` - Plan regeneration modal (Sheet component)
- `PantrySheet.tsx` - Pantry management with image scanning (Sheet component)
- `SwapDrawer.tsx` - Meal swapping with AI suggestions (Sheet component)
- `WeeklyOverridesSheet.tsx` - Week-specific overrides (Sheet component)

**Pages**:
- `/plan/page.tsx` - Weekly grid with wizard and AI swap functionality
- `/plan/review/page.tsx` - Plan review with summary stats
- `/shopping-list/page.tsx` - Aggregated shopping list
- `/analytics/page.tsx` - Analytics dashboard
- `/settings/page.tsx` - Family preferences and GitHub sync
- `/recipe/[id]/page.tsx` - Recipe details with context-aware navigation

**Accessibility**: WCAG 2.1 AA compliant, keyboard navigation, screen readers

### 2. AI Layer (`apps/web/src/app/api/`)

**Google Gemini Integration**:
```
API Routes
    │
    ├──▶ /api/generate-recipes ────── AI recipe generation
    │                                  Model: gemini-2.0-flash-exp
    │                                  Input: Family settings, constraints
    │                                  Output: 1-7 custom recipes
    │
    ├──▶ /api/extract-recipe-from-image ── Pantry scanning
    │                                       Gemini Vision API
    │                                       Input: Image file
    │                                       Output: Detected ingredients
    │
    ├──▶ /api/extract-recipe-from-url ──── URL extraction
    │                                       Gemini text parsing
    │                                       Input: Recipe URL
    │                                       Output: Structured recipe
    │
    └──▶ /api/list-models ────────────── Model testing
                                          Validates Gemini API access
                                          Returns: Available models
```

**AI Features**:
- Context-aware recipe generation (family settings, recent history, pantry items)
- Image recognition for pantry/fridge scanning
- Smart URL parsing for recipe import
- Automatic ingredient and instruction extraction

### 3. Logic Layer (`apps/web/src/lib/`)

#### Meal Planning Core
```
compose.ts
    │
    ├──▶ scoring.ts ────── Evaluates recipes (10+ rules)
    │                      Returns: number (0-100 score)
    │
    ├──▶ recencyTracker.ts ── Tracks 3-week history
    │                         Returns: Recipe[] recently cooked
    │
    ├──▶ tagNormalizer.ts ── Unifies tag vocabulary
    │                        Returns: string[] normalized tags
    │
    └──▶ explainer.ts ────── Generates reason chips
                             Returns: ReasonChip[]
```

#### Shopping & Pricing
```
shoppingListAggregator.ts
    │
    ├──▶ Unit normalization (tsp→tbsp, g→kg)
    ├──▶ Deduplication by normalized name
    ├──▶ Source recipe tracking
    └──▶ Pantry staple detection
         │
         └──▶ colesMapping.ts ── SKU lookup (30+ ingredients)
                                 Price estimation
                                 Pack calculations
```

#### Analytics & Storage
```
analytics.ts
    │
    ├──▶ Event tracking (11 types)
    ├──▶ Metric aggregation (5 functions)
    └──▶ localStorage persistence
    
storage.ts
    │
    ├──▶ Household data
    ├──▶ Weekly overrides
    ├──▶ Favorites
    └──▶ Recipe history
```

### 3. Data Layer

**Static Data**:
- `data/library/recipes.generated.json` - 50+ recipes
- `data/library/nagi/*.json` - Individual recipe files

**Runtime Storage (localStorage)**:
```
household_data       → Household preferences
weekly_overrides_*   → Per-week constraints
favorite_recipes     → Favorited recipe IDs
recipe_history       → 3-week cooking history
analytics_events     → Privacy-first event log
```

---

## Data Flow

### 1. Recipe Indexing (Build Time)

```
Internet Recipe Sites (RecipeTin Eats)
        │
        ▼
┌─────────────────┐
│ indexChefs.ts   │ ← Web scraping with JSON-LD extraction
│                 │ ← Quality filters (≤60min, ≤18 ingredients)
│                 │ ← Respectful crawling (1 req/sec)
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ data/library/nagi/      │
│ ├── chicken-parm.json   │ ← Schema.org Recipe format
│ ├── beef-stew.json      │ ← Source URL, chef metadata
│ └── ...                 │ ← 50+ individual files
└─────────┬───────────────┘
          │
          ▼
┌──────────────────────────┐
│ buildRecipeLibrary.ts    │ ← Reads all *.json files
│                          │ ← Normalizes tags (tagNormalizer)
│                          │ ← Validates schema
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ recipes.generated.json   │ ← 50+ recipes with normalized tags
│                          │ ← Static import for client
└──────────────────────────┘
```

### 2. Meal Planning Flow (Runtime)
           │                             • Kid-friendly weeknights
           │                             • Favorites prioritization
           │                             • Weekend relaxation
           │
           ▼
┌──────────────────────┐
│ PlanWeek             │ ← Array of PlanDay objects
│ ├── days[]           │ ← Each with:
│ │   ├── dateISO      │   • Recipe ID
│ │   ├── recipeId     │   • Scaled servings
│ │   ├── servings     │   • Bulk cook flag
│ │   └── notes        │
│ ├── costEstimate     │ ← Total weekly cost
│ └── conflicts[]      │ ← Validation issues
└──────────────────────┘
```

### 3. Swap Recommendations

```
User clicks "Swap" on a recipe
        │
        ▼
┌──────────────────────┐
│ getSuggestedSwaps()  │ ← Current recipe ID
│                      │ ← isWeekend flag
│                      │ ← kidFriendly flag
└──────────┬───────────┘
           │
           ├─▶ Same chef first ─────▶ Priority to consistency
           │
           ├─▶ Similar tags ────────▶ Maintains meal type/style
           │
           ├─▶ Similar time ────────▶ Keeps effort comparable
           │
           ▼
   Up to 3 alternative recipes
```

## Technology Stack

### Core Framework
- **Next.js 16** - React framework with App Router
- **React 19.2.0** - UI components with hooks
- **TypeScript 5.9.3** - Strict mode type safety

### Package Management
- **PNPM 10.19.0** - Monorepo workspace manager
- **Workspace Structure**:
  - `apps/web` - Next.js application
  - `scripts/` - Build-time tools

### Testing
- **Vitest 4.0.3** - Fast unit testing framework
- **@testing-library/react 16.3.0** - Component testing
- **happy-dom 20.0.8** - Lightweight DOM environment

### Build Tools
- **@vitejs/plugin-react** - Vite React plugin for tests
- **tsx** - TypeScript execution for scripts

## Key Design Decisions

### 1. Build-Time vs Runtime Recipe Generation

**Decision**: Generate static `recipes.generated.json` at build time instead of loading recipes at runtime.

**Rationale**:
- **Client-Side Compatibility**: Next.js client components cannot use Node.js `fs` module
- **Performance**: Static JSON is faster than filesystem operations
- **Deployment**: Eliminates need to bundle raw recipe files
- **Simplicity**: Single source of truth for recipe data

**Trade-offs**:
- Recipe updates require rebuild
- Larger bundle size (acceptable with 50 recipes, may need optimization at 500+)

### 2. Type-Safe Recipe Schema

**Decision**: Define strict TypeScript types for all recipe data structures.

**Rationale**:
- **Type Safety**: Catch errors at compile time
- **IDE Support**: Autocomplete and inline documentation
- **Refactoring**: Safe code changes with compiler validation
- **API Contract**: Clear interface between components

**Implementation**:
```typescript
export type Recipe = { 
  id: string; 
  title: string; 
  source: RecipeSource; 
  timeMins?: number; 
  tags: string[]; 
  ingredients: Ingredient[]; 
  serves?: number; 
  costPerServeEst?: number 
};
```

### 3. Centralized Constants

**Decision**: Extract all magic numbers and configuration to `constants.ts`.

**Rationale**:
- **Maintainability**: Single place to update defaults
- **Discoverability**: Easy to see all configurable values
- **Type Safety**: Export const enums for restricted values
- **Documentation**: Constants are self-documenting

**Examples**:
- `DEFAULT_DINNERS_PER_WEEK = 5`
- `MAX_RECIPE_TIME_MINS = 60`
- `PROTEIN_TYPES = ["chicken", "beef", ...]`

### 4. Immutable Recipe Selection Algorithm

**Decision**: Pure functions for meal composition without side effects.

**Rationale**:
- **Testability**: Easy to write unit tests
- **Predictability**: Same inputs always produce same outputs
- **Debugging**: No hidden state to track
- **Parallelization**: Could run multiple scenarios simultaneously

**Implementation**:
```typescript
export function composeWeek(
  household: Household,
  overrides?: WeeklyOverrides
): PlanWeek {
  // Pure function - no mutations, no side effects
}
```

### 5. Tag-Based Recipe Filtering

**Decision**: Use flexible string arrays for recipe tags instead of boolean flags.

**Rationale**:
- **Extensibility**: Easy to add new categories without schema changes
- **Multiple Categories**: Recipes can have many tags
- **Search Flexibility**: AND/OR filtering on tags
- **Source Fidelity**: Preserves original recipe keywords

**Trade-offs**:
- Less type safety than enums (mitigated with constants)
- Potential for inconsistent tagging (mitigated with build-time validation)

### 6. Separation of Indexing and Runtime Code

**Decision**: Keep web scraping (`indexChefs.ts`) separate from app code.

**Rationale**:
- **Security**: Scraping dependencies not bundled in production
- **Bundle Size**: Cheerio, robots.txt parser not needed at runtime
- **Responsibility**: Clear separation of concerns
- **Flexibility**: Can run indexing independently

**Structure**:
```
scripts/
  indexChefs.ts ← Web scraping, filtering
  buildRecipeLibrary.ts ← Transform for app
apps/web/src/lib/
  library.ts ← Runtime recipe access
```

## Component Architecture

### Page Structure

```
apps/web/src/app/
├── plan/
│   └── page.tsx ← Main meal planning interface
├── layout.tsx ← Root layout
└── page.tsx ← Landing page
```

### Core Libraries

```
apps/web/src/lib/
├── compose.ts ← Meal composition algorithm
├── library.ts ← Recipe search and retrieval
├── schedule.ts ← Date/week calculations
├── constants.ts ← Centralized configuration
├── recipes.ts ← Static JSON import wrapper
└── types/
    └── recipe.ts ← TypeScript type definitions
```

### State Management

**Current**: React component state (useState, useReducer)

**Rationale**:
- Prototype stage - minimal state complexity
- No global state needed yet
- Component isolation for easier testing

**Future Considerations**:
- Consider Zustand or Jotai for global household preferences
- Server state (React Query) if adding backend persistence

## Testing Strategy

### Test Coverage

```
apps/web/src/lib/__tests__/
├── compose.test.ts ← 11 tests (meal planning logic)
└── library.test.ts ← 19 tests (recipe search/data integrity)

scripts/__tests__/
└── buildRecipeLibrary.test.ts ← 25 tests (parsing logic)

Total: 55 tests
```

### Testing Philosophy

1. **Unit Tests**: Test pure functions in isolation
2. **Data Integrity**: Validate recipe schema compliance
3. **Edge Cases**: Empty results, missing data, extremes
4. **Type Safety**: Rely on TypeScript for interface testing

### Running Tests

```bash
pnpm test          # Run all tests once
pnpm test:watch    # Watch mode for development
pnpm test:ui       # Visual test UI
```

## Known Limitations

### Current Constraints

1. **Recipe Count**: 50 recipes (need 100-200 for variety)
2. **Single Chef**: Only RecipeTin Eats indexed
3. **No Backend**: All data is static JSON
4. **No User Accounts**: Household data in local state only
5. **No Ingredient Aggregation**: Shopping lists not implemented
6. **No Nutrition Data**: Calories/macros not tracked

### Technical Debt

1. **VS Code Cache**: TypeScript server may show false import errors (restart to fix)
2. **JSON Import Types**: Requires manual `*.json` declaration in `json.d.ts`
3. **Test Fixtures**: Mock data should be generated from factory functions
4. **Constants Duplication**: Some filter constants duplicated between scripts and app

## Future Enhancements

### Phase 1: More Recipes
- Index additional chefs (Jamie Oliver, etc.)
- Expand to 200+ recipes
- Add more diverse cuisines

### Phase 2: Shopping Lists
- Aggregate ingredients across week
- Group by category (produce, meat, pantry)
- Integrate with retailer APIs (Coles, Woolworths)

### Phase 3: User Accounts
- Persistent household preferences
- Favorites and ratings
- Historical meal plans

### Phase 4: Nutrition Tracking
- Calculate macros per recipe
- Weekly nutrition summary
- Dietary goal tracking

### Phase 5: Mobile App
- React Native version
- Offline-first architecture
- Cooking mode with timers

## Development Workflow

### Adding a New Recipe

1. Run indexer: `pnpm index-chefs`
2. Build static JSON: `tsx scripts/buildRecipeLibrary.ts`
3. Verify in app: `pnpm dev`
4. Run tests: `pnpm test`

### Adding a New Feature

1. Update types in `types/recipe.ts`
2. Write tests first (TDD approach)
3. Implement logic
4. Update DEVELOPMENT.md if workflow changes
5. Run full test suite

### Common Commands

```bash
pnpm dev              # Start Next.js dev server
pnpm build            # Build for production
pnpm test             # Run all tests
pnpm index-chefs      # Scrape and index recipes
```

## References

- [DEVELOPMENT.md](../.github/DEVELOPMENT.md) - Developer guide
- [PROJECT_INSTRUCTIONS.md](../PROJECT_INSTRUCTIONS.md) - Project overview
- [Recipe Schema](https://schema.org/Recipe) - JSON-LD standard
