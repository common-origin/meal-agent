# Architecture Documentation

**Last Updated**: 30 November 2025  
**Version**: Phase 1, 2 & 3 Complete

## System Overview

Meal Agent is a Next.js-based multi-user AI-powered meal planning application that helps households plan weekly dinners using a combination of curated recipes and AI-generated meals. The system features:

- **Supabase PostgreSQL database** with Row-Level Security for household data isolation
- **Google OAuth + Magic Link** authentication via Supabase Auth
- **Google Gemini API** integration for recipe generation, pantry scanning, and URL extraction
- **4-layer hybrid storage architecture** routing between localStorage (anonymous) and PostgreSQL (authenticated)
- **Deterministic scoring algorithms** with explainability and cost transparency
- **Privacy-first analytics** with local event tracking

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            MEAL AGENT                                    │
│                    (Next.js 16 / React 19 / TypeScript)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐       │
│  │  UI Layer    │───▶│  Logic Layer    │───▶│  Storage Layer   │       │
│  │              │    │                 │    │                  │       │
│  │ • Pages      │    │ • compose.ts    │    │ • hybridStorage  │       │
│  │ • Components │    │ • scoring.ts    │    │ • supabaseStorage│       │
│  │ • Drawers    │    │ • explainer.ts  │    │ • localStorage   │       │
│  │ • Cards      │    │ • aggregator.ts │    │                  │       │
│  │ • Auth UI    │    │ • colesMapping  │    └────────┬─────────┘       │
│  │              │    │ • analytics.ts  │             │                  │
│  └──────────────┘    └─────────────────┘             │                  │
│                                │                      │                  │
│                                │                      ▼                  │
│                                │         ┌──────────────────────┐       │
│                                │         │  Supabase Backend    │       │
│                                │         │                      │       │
│                                │         │ • PostgreSQL DB      │       │
│                                │         │ • Row-Level Security │       │
│                                │         │ • Auth (OAuth +      │       │
│                                │         │   Magic Link)        │       │
│                                │         │ • 8 Tables           │       │
│                                │         └──────────────────────┘       │
│                                ▼                                         │
│                      ┌──────────────────┐                                │
│                      │   AI Layer       │                                │
│                      │                  │                                │
│                      │ • Gemini API     │                                │
│                      │ • Recipe Gen     │                                │
│                      │ • Vision API     │                                │
│                      │ • URL Extract    │                                │
│                      └──────────────────┘                                │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

## Architecture Layers (Phases 1, 2 & 3)

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
- `/page.tsx` - Landing page with auth check and redirect
- `/login/page.tsx` - Login with Google OAuth and Magic Link
- `/signup/page.tsx` - Signup with authentication options
- `/auth/callback/route.ts` - OAuth callback handler
- `/plan/page.tsx` - Weekly grid with wizard and AI swap functionality
- `/plan/review/page.tsx` - Plan review with summary stats
- `/recipes/page.tsx` - Recipe library ("My Recipes")
- `/recipes/add/page.tsx` - Add recipes via URL, image, or manual entry
- `/recipe/[id]/page.tsx` - Recipe details with context-aware navigation
- `/shopping-list/page.tsx` - Aggregated shopping list with Coles pricing
- `/analytics/page.tsx` - Privacy-first analytics dashboard
- `/settings/page.tsx` - Family preferences and GitHub sync
- `/settings/data-export/page.tsx` - Export household data
- `/about/page.tsx` - About page with tech stack and privacy info
- `/debug/ingredient-analytics/page.tsx` - Ingredient usage tracking analytics

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
    └──▶ /api/ingredient-analytics ──────── Analytics metadata
                                            Returns client-side analytics info
                                            Data stored in localStorage
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

ingredientAnalytics.ts
    │
    ├──▶ trackIngredientUsage() - Automatic tracking on plan generation
    ├──▶ getIngredientAnalytics() - Frequency analysis & coverage stats
    ├──▶ generatePriorityReport() - Top unmapped ingredients report
    ├──▶ exportIngredientData() - JSON export for analysis
    └──▶ localStorage persistence (meal-agent:ingredient-frequency:v1)
    
storage.ts
    │
    ├──▶ Household data
    ├──▶ Weekly overrides
    ├──▶ Favorites
    └──▶ Recipe history
```

### 4. Storage Layer (4-Layer Hybrid Architecture)

The application uses a sophisticated 4-layer storage architecture that seamlessly routes between localStorage (anonymous users) and Supabase PostgreSQL (authenticated users):

```
Application Code
      │
      ▼
┌──────────────────────────────────────┐
│  Layer 1: storage.ts                 │  ← Synchronous localStorage utils
│  • loadHousehold()                   │  ← Legacy/fallback layer
│  • saveHousehold()                   │
│  • loadWeeklyOverrides()             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Layer 2: storageAsync.ts            │  ← Async wrappers
│  • getFamilySettings()               │  ← Adds Promise interface
│  • saveFamilySettings()              │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  Layer 3: hybridStorage.ts           │  ← Smart Router
│  • Routes based on auth state        │
│  • Authenticated → Supabase          │
│  • Anonymous → localStorage          │
└──────────────┬───────────────────────┘
               │
         ┌─────┴─────┐
         ▼           ▼
┌─────────────┐  ┌──────────────────────┐
│localStorage │  │ Layer 4: supabase    │  ← PostgreSQL CRUD
│(anonymous)  │  │ Storage.ts           │
│             │  │                      │
│• Quick data │  │• saveMealPlan()      │
│• No auth    │  │• loadMealPlan()      │
│  required   │  │• saveRecipe()        │
│             │  │• loadAllRecipes()    │
│             │  │• saveFamilySettings()│
│             │  │• getHouseholdId()    │
└─────────────┘  └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Supabase PostgreSQL │
                 │                      │
                 │ • 8 Tables           │
                 │ • RLS Policies       │
                 │ • Automatic triggers │
                 │ • Type safety        │
                 └──────────────────────┘
```

**Key Features:**
- **Automatic Routing**: Based on `supabase.auth.getUser()` - no manual checks needed
- **Type Safety**: Auto-generated TypeScript types from database schema
- **Deduplication**: Map-based deduplication in `getEnhancedRecipes()`
- **Conflict Resolution**: Upsert with `onConflict` parameter for meal plans
- **Multi-Source Recipes**: Handles Supabase recipes, custom recipes, temp AI recipes
- **Comprehensive Logging**: Debug logging throughout storage operations

### 5. Database Layer (Supabase PostgreSQL)

**Schema: 8 Tables with Row-Level Security**

```sql
households
├── id (UUID, PK)
├── name (TEXT)
├── created_at, updated_at
└── Relations:
    ├─▶ household_members (1:many)
    ├─▶ family_settings (1:1)
    ├─▶ recipes (1:many)
    ├─▶ meal_plans (1:many)
    ├─▶ shopping_lists (1:many)
    ├─▶ pantry_preferences (1:1)
    └─▶ api_usage (1:many)

household_members
├── id (UUID, PK)
├── household_id (UUID, FK → households)
├── user_id (UUID, FK → auth.users)
├── role (TEXT: 'owner' | 'member')
└── joined_at

family_settings
├── id (UUID, PK)
├── household_id (UUID, FK → households, UNIQUE)
├── total_servings (INTEGER)
├── adults, kids, kids_ages
├── cuisines, dietary_restrictions (TEXT[])
├── cooking_time_preference, skill_level
├── full_settings (JSONB) ← Migration 004
└── created_at, updated_at

recipes
├── id (TEXT, PK) ← Supports UUIDs and semantic IDs
├── household_id (UUID, FK → households)
├── title, source_url, source_domain, source_chef
├── time_mins, serves, tags (TEXT[])
├── ingredients (JSONB)
├── instructions (TEXT[])
├── cost_per_serve_est (NUMERIC)
└── created_at, updated_at

meal_plans
├── id (UUID, PK)
├── household_id (UUID, FK → households)
├── week_start (DATE)
├── meals (JSONB) ← Complete week structure
├── UNIQUE(household_id, week_start) ← Upsert key
└── created_at, updated_at

shopping_lists
├── id (UUID, PK)
├── household_id (UUID, FK → households)
├── week_start (DATE)
├── items (JSONB)
├── UNIQUE(household_id, week_start)
└── created_at, updated_at

pantry_preferences
├── id (UUID, PK)
├── household_id (UUID, FK → households, UNIQUE)
├── items (TEXT[])
└── created_at, updated_at

api_usage
├── id (UUID, PK)
├── household_id (UUID, FK → households)
├── endpoint (TEXT)
├── tokens_used (INTEGER)
├── cost_usd (NUMERIC)
└── timestamp
```

**Row-Level Security (RLS) Policies:**

All tables have RLS enabled with policies that enforce:
- Users can only access data from their own household
- Helper function: `get_user_household_id()` returns current user's household
- Owner role can invite/remove members
- All household members have equal access to recipes, plans, shopping lists
- Complete data isolation between households

**Automatic Behaviors:**
- **New User Signup Trigger**: Creates household, adds user as owner, creates default settings
- **Updated Timestamps**: `handle_updated_at()` trigger on all tables
- **Cascade Deletes**: Removing household deletes all related data
- **Type Generation**: `supabase gen types typescript` creates TypeScript types

**Migrations:**
1. **001_initial_schema.sql** - Create 8 tables with indexes and triggers
2. **002_rls_policies.sql** - Row-Level Security policies on all tables
3. **003_alter_recipes_id_to_text.sql** - Change recipe ID from UUID to TEXT
4. **004_add_full_settings_to_family_settings.sql** - Add JSONB column (pending)

### 6. Authentication Layer (Supabase Auth)

```
User Authentication Flow
      │
      ├─▶ Google OAuth
      │   └─▶ Redirects to /auth/callback
      │       └─▶ Sets auth cookie
      │           └─▶ Redirects to /plan
      │
      ├─▶ Magic Link (Email)
      │   └─▶ Sends email with link
      │       └─▶ Clicks link → /auth/callback
      │           └─▶ Sets auth cookie
      │               └─▶ Redirects to /plan
      │
      └─▶ Session Management
          ├─▶ Browser: createClient() (client.ts)
          ├─▶ Server: createClient() (server.ts)
          ├─▶ Admin: createAdminClient() (bypasses RLS)
          └─▶ Cookie-based sessions (@supabase/ssr)
```

**Security Features:**
- Session cookies stored securely with HttpOnly flag
- PKCE (Proof Key for Code Exchange) for OAuth
- Automatic session refresh
- Server-side session validation
- Protected API routes check authentication

### 7. Data Layer (Runtime)

**Recipe Sources**:
- AI-generated recipes via Gemini API
- User-uploaded recipes via URL extraction
- Manually added recipes via the recipes page

**Runtime Storage (localStorage - Anonymous Users)**:
```
household_data                          → Household preferences
weekly_overrides_*                      → Per-week constraints
favorite_recipes                        → Favorited recipe IDs (not yet migrated)
recipe_history                          → 3-week cooking history
analytics_events                        → Privacy-first event log
meal-agent:ingredient-frequency:v1      → Ingredient usage tracking
meal-agent:analytics-timestamp:v1       → Last analytics update
meal-agent:custom-recipes:v1            → User-added recipes (cache)
meal-agent:confirmed-recipes:v1         → Recipes confirmed in plans
meal-agent:ai-temp-recipes:v1           → Temporary AI-generated recipes
```

**Runtime Storage (PostgreSQL - Authenticated Users)**:
All data persisted in household-scoped tables with automatic sync on changes

---

## Data Flow

### 1. Recipe Sources (Runtime)

```
┌──────────────────────────────┐
│ AI Recipe Generation         │
│ /api/generate-recipes        │ ← Gemini API
│ - Family settings            │ ← Context-aware generation
│ - Dietary preferences        │
│ - Pantry items               │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ URL Recipe Extraction        │
│ /api/extract-recipe-from-url │ ← Gemini parsing
│ - User provides URL          │ ← Any recipe website
│ - Auto-extracts ingredients  │
│ - Normalizes structure       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Manual Recipe Entry          │
│ /recipes/add                 │ ← User input
│ - Form-based entry           │
│ - Image extraction option    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ RecipeLibrary                │
│ apps/web/src/lib/library.ts  │ ← Runtime recipe management
│ - Stores all recipes         │
│ - Provides search API        │
│ - Syncs to Supabase/localStorage
└──────────────────────────────┘
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

### 4. Ingredient Analytics & Price Mapping (Automatic)

```
User generates/views meal plan
        │
        ▼
┌──────────────────────────┐
│ trackIngredientUsage()   │ ← Automatically called
│                          │ ← Extracts all ingredients
└──────────┬───────────────┘
           │
           ├─▶ Normalizes ingredient names
           │   (removes "fresh", "chopped", etc.)
           │
           ├─▶ Increments frequency counters
           │
           ├─▶ Checks against 179 mapped Coles products
           │
           ├─▶ Stores in localStorage
           │
           ▼
┌──────────────────────────────┐
│ /debug/ingredient-analytics  │ ← Analytics dashboard
│                              │
│ • Total recipes tracked      │
│ • Mapped vs unmapped %       │
│ • Top 10 unmapped ingredients│
│ • Priority report generation │
│ • JSON export                │
└──────────────────────────────┘
           │
           ▼
    Priority list for expanding
    colesMapping.ts with most
    frequently used ingredients
```

**Data Flow**:
1. Plan generation triggers `trackIngredientUsage(recipeIds[])`
2. System extracts ingredients from all recipes
3. Normalizes names using `normalizeIngredientName()`
4. Checks each ingredient against `COLES_INGREDIENT_MAPPINGS`
5. Updates frequency map with usage count + recipe sources
6. Stores in localStorage key: `meal-agent:ingredient-frequency:v1`

**Analytics Output**:
- Coverage statistics (mapped vs unmapped %)
- Top 50-100 unmapped ingredients by frequency
- Recipe count per ingredient
- First/last seen timestamps
- Exportable JSON for external analysis

## Technology Stack

### Core Framework
- **Next.js 16.0.0** - React framework with App Router and Server Components
- **React 19.2.0** - UI library with latest concurrent features
- **TypeScript 5.9.3** - Strict mode type safety with auto-generated database types
- **PNPM 10.19.0** - Fast, disk-efficient monorepo package manager

### Database & Authentication
- **Supabase PostgreSQL** - Production-grade PostgreSQL database
  - Project ID: `migfbyyftwgidbkwwyst`
  - Region: AWS ap-southeast-2 (Sydney)
- **Supabase Auth** - Authentication service
  - Google OAuth provider
  - Magic Link email authentication  
  - Cookie-based session management
- **Row-Level Security (RLS)** - Database-level security policies
  - 30+ policies across 8 tables
  - Household-scoped data isolation
  - Owner/member role enforcement
- **@supabase/ssr** - Server-side rendering support for auth
- **@supabase/supabase-js** - Supabase JavaScript client library

### AI & Machine Learning
- **Google Gemini API** - AI recipe generation and analysis
  - Model: `gemini-2.0-flash-exp`
  - Vision API for image recognition
  - Text generation for recipes
- **@google/generative-ai** - Official Gemini SDK

### UI Framework & Design System
- **@common-origin/design-system v1.14.0** - Component library
  - 15+ production-ready components
  - Complete design token system
  - WCAG 2.1 AA accessible
  - Responsive grid system
- **Key Components**: Sheet, Slider, Button, TextField, Dropdown, Checkbox, Typography, Avatar, Stack, Box, Chip, Divider, NumberInput, PasswordField, IconButton, ResponsiveGrid, Container

### Data & Storage
- **PostgreSQL (Supabase)** - Primary database for authenticated users
  - 8 tables with complete schema
  - JSONB columns for flexible data
  - Automatic timestamps and triggers
- **localStorage** - Client-side fallback for anonymous users
  - Privacy-first analytics
  - Temporary data cache
  - Recipe deduplication support

### Development Tools
- **Vitest 4.0.3** - Fast unit testing framework
- **@testing-library/react 16.3.0** - Component testing utilities
- **happy-dom 20.0.8** - Lightweight DOM environment for tests
- **ESLint** - Code linting with strict rules
- **GitHub Actions** - CI/CD pipeline
- **Vercel** - Deployment platform with preview environments

### Build Tools
- **@vitejs/plugin-react** - Vite React plugin for fast tests
- **tsx** - TypeScript execution for build scripts
- **Turbopack** - Next.js 16 build system (experimental)

### Key Dependencies
- **zod** - Runtime type validation
- **dayjs** - Date manipulation and formatting
- **cheerio** - HTML parsing for recipe indexer
- **robots-parser** - Respectful web scraping compliance

### Deployment
- **Vercel** - Production hosting
  - Automatic deployments from main branch
  - Preview deployments for PRs
  - Environment variable management
- **Supabase Cloud** - Database hosting
  - Automatic backups
  - Connection pooling
  - Database migrations via SQL editor

## Key Design Decisions

### 1. 4-Layer Hybrid Storage Architecture

**Decision**: Implement a 4-layer storage system that automatically routes between localStorage (anonymous) and Supabase (authenticated) based on auth state.

**Rationale**:
- **Progressive Enhancement**: App works without authentication, then upgrades seamlessly
- **Type Safety**: Supabase auto-generates TypeScript types from database schema
- **Performance**: localStorage for anonymous users (no network latency), PostgreSQL for persistence
- **Security**: Row-Level Security ensures complete household data isolation
- **Flexibility**: Can add new storage backends without changing application code

**Architecture**:
```
Application → storage.ts → storageAsync.ts → hybridStorage.ts → supabaseStorage.ts → PostgreSQL
                                                              ↘ localStorage (fallback)
```

**Trade-offs**:
- More complex than single storage solution
- Need to maintain compatibility between localStorage and PostgreSQL schemas
- localStorage data doesn't migrate automatically (fresh start for new users)

### 2. Row-Level Security for Multi-Tenant Data Isolation

**Decision**: Use PostgreSQL Row-Level Security policies instead of application-level authorization.

**Rationale**:
- **Defense in Depth**: Security enforced at database level, not just application code
- **SQL Injection Protection**: RLS policies work even if SQL injection occurs
- **Zero Trust**: Cannot accidentally query wrong household's data
- **Audit Trail**: PostgreSQL logs show all access attempts
- **Performance**: Policies use indexes efficiently

**Implementation**:
```sql
CREATE POLICY "Users can view their household recipes"
  ON public.recipes FOR SELECT
  USING (household_id = get_user_household_id());
```

**Trade-offs**:
- Slightly more complex database setup
- Policies must be tested carefully
- Cannot use service role key in client code (must use anon key)

### 3. Dynamic Recipe Library

**Decision**: All recipes are dynamically managed at runtime through RecipeLibrary, with no static/pre-built recipe files.

**Rationale**:
- **Flexibility**: Users can add recipes anytime via AI, URL extraction, or manual entry
- **Personalization**: Each household builds their own recipe collection
- **Storage Efficiency**: Recipes are persisted in Supabase (authenticated) or localStorage (anonymous)
- **No Build Step**: No need for build-time recipe generation or indexing

**Trade-offs**:
- New users start with an empty library (must generate or import recipes)
- Requires AI API or manual entry to populate library

### 4. Type-Safe Recipe Schema

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

### 7. Tag-Based Recipe Filtering

**Decision**: Use flexible string arrays for recipe tags instead of boolean flags.

**Rationale**:
- **Extensibility**: Easy to add new categories without schema changes
- **Multiple Categories**: Recipes can have many tags
- **Search Flexibility**: AND/OR filtering on tags
- **Source Fidelity**: Preserves original recipe keywords

**Trade-offs**:
- Less type safety than enums (mitigated with constants)
- Potential for inconsistent tagging (mitigated with tag normalization)

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
├── library.ts ← Recipe library (AI + user recipes)
├── schedule.ts ← Date/week calculations
├── constants.ts ← Centralized configuration
├── scoring.ts ← Recipe scoring with 10+ rules
├── explainer.ts ← Human-readable reason chips
├── colesMapping.ts ← 179 Coles product mappings + price estimation
├── ingredientPricing.ts ← Category-based fallback pricing
├── ingredientAnalytics.ts ← Ingredient usage frequency tracking
├── shoppingListAggregator.ts ← Ingredient aggregation & deduplication
├── analytics.ts ← Privacy-first event tracking
├── storage.ts ← localStorage wrapper utilities
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

Total: 30 tests
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

1. **Recipe Count**: Depends on user's added recipes (start with 0)
2. **AI Dependency**: Recipe generation requires Gemini API access
3. **No Offline Mode**: AI features require internet connection
4. **No Nutrition Data**: Calories/macros not tracked

### Technical Debt

1. **VS Code Cache**: TypeScript server may show false import errors (restart to fix)
2. **Test Fixtures**: Mock data should be generated from factory functions
3. **Favorites Migration**: Favorites still in localStorage, not migrated to Supabase

## Future Enhancements

### Phase 1: Starter Recipes
- Curated starter recipe packs for new users
- One-click import of recipe collections
- Recipe sharing between users

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

Recipes are added through the application:
1. Use AI generation via weekly planning wizard
2. Import from URL via `/recipes/add`
3. Manual entry via the recipes page
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
```

## References

- [DEVELOPMENT.md](../.github/DEVELOPMENT.md) - Developer guide
- [PROJECT_INSTRUCTIONS.md](../PROJECT_INSTRUCTIONS.md) - Project overview
- [Recipe Schema](https://schema.org/Recipe) - JSON-LD standard
