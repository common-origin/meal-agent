# Meal Agent Project Status

**Last Updated**: 30 November 2025  
**Status**: ✅ **Phase 1, 2 & 3 Complete** - Multi-User Meal Planning with Authentication & Database - **DEPLOYED TO PRODUCTION**  
**Production URL**: https://meal-agent-gvvyzmw1k-commonorigins-projects.vercel.app

---

## 📊 Current State

### ✅ Phase 1: Complete (All 10 Work Orders + Recipe Integration)

**Status**: Production-ready intelligent meal planning system with real RecipeTin Eats recipes, explainability, cost transparency, and analytics.

### ✅ Phase 2: Complete (AI Integration & Advanced Features)

**Status**: AI-powered recipe generation, pantry scanning, URL extraction, and weekly planning wizard fully implemented using Google Gemini API.

### ✅ Phase 3: Complete (Authentication, Database & Multi-User Households)

**Status**: Supabase PostgreSQL database with Row-Level Security, Google OAuth + Magic Link authentication, household-based data isolation, and persistent storage across all features.

#### Completed Work Orders

1. **WO1: Tag Normalization** ✅
   - `lib/tagNormalizer.ts` - Unified tag vocabulary
   - Enhanced `lib/library.ts` with normalized tags for all recipe sources

2. **WO2: Scoring Pipeline** ✅
   - `lib/scoring.ts` - Deterministic rules-based scoring (10+ rules)
   - Configurable `SCORING_WEIGHTS` for tuning

3. **WO3: Composer with Leftovers Strategy** ✅
   - `lib/recencyTracker.ts` - 3-week history tracking
   - Rewritten `lib/compose.ts` - Variety enforcement, bulk cook support

4. **WO4: Explainability Layer** ✅
   - `lib/explainer.ts` - Human-readable reason chips
   - `LeftoverCard.tsx` - Visual placeholder for bulk cook days
   - Enhanced `MealCard.tsx` with explanation chips

5. **WO5: Plan Review Page** ✅
   - `/plan/review/page.tsx` - Summary stats, meal grid, regeneration
   - `RegenerateDrawer.tsx` - Pin days, cost constraints, preferences

6. **WO6: Shopping List Aggregation** ✅
   - `lib/shoppingListAggregator.ts` - Deduplication, unit normalization
   - `ShoppingListItem.tsx` - Expandable source breakdown
   - Rewritten `/shopping-list/page.tsx`

7. **WO7: Coles Product Mapping** ✅
   - `lib/colesMapping.ts` - Manual SKU table (30+ ingredients)
   - Price estimation with confidence levels

8. **WO8: Favorites & Repetition Tracking** ✅
   - Integrated in WO3 via `recencyTracker.ts`
   - localStorage-based persistence

9. **WO9: Analytics Extension** ✅
   - Extended `lib/analytics.ts` - 11 event types, 5 metrics
   - `/analytics/page.tsx` - Dashboard with insights

10. **WO10: A11y & Mobile Parity** ✅
    - WCAG 2.1 Level AA compliance
    - Keyboard navigation, screen reader support
    - Touch targets ≥44px, mobile responsive layouts

11. **WO11: Family Settings & Preferences** ✅
    - `/settings` page with comprehensive family configuration
    - Household size, cuisine preferences, dietary requirements
    - Budget constraints, cooking time limits
    - Batch cooking preferences, pantry priority settings
    - GitHub recipe sync integration

#### Phase 2 Features (AI Integration)

1. **AI Recipe Generation** ✅
   - Google Gemini API integration (gemini-2.0-flash-exp model)
   - `/api/generate-recipes` - Generates personalized recipes from family settings
   - Context-aware generation (avoids recent recipes, respects dietary preferences)
   - Custom recipe storage and management

2. **Pantry Scanning** ✅
   - `/api/extract-recipe-from-image` - Image-based recipe extraction
   - Uses Gemini Vision to detect ingredients from photos
   - Pantry/fridge scanning for ingredient detection
   - PantrySheet component for managing pantry items

3. **URL Recipe Extraction** ✅
   - `/api/extract-recipe-from-url` - Extracts recipes from any URL
   - Gemini-powered parsing of recipe websites
   - Automatic ingredient and instruction extraction
   - Adds extracted recipes to library

4. **Weekly Planning Wizard** ✅
   - Step-by-step wizard for generating complete weekly meal plans
   - AI generates 7 recipes based on family preferences
   - Integrated with pantry items and dietary constraints
   - One-click plan creation from wizard

5. **Intelligent Swap Suggestions** ✅
   - AI-powered meal swap recommendations
   - Context-aware suggestions based on day of week and family settings
   - Generates multiple alternatives for any meal

6. **Ingredient Analytics & Price Mapping** ✅
   - Automatic ingredient usage frequency tracking across all meal plans
   - Analytics dashboard at `/debug/ingredient-analytics`
   - Identifies unmapped ingredients that need Coles price data
   - Generates priority reports for expanding price mapping database
   - Export functionality for data analysis (JSON format)
   - Tracks 179 manually-mapped Coles products with fallback to category-based estimation
   - Seamless integration with SwapDrawer

#### Phase 3 Features (Authentication & Database)

1. **Supabase PostgreSQL Database** ✅
   - 8 tables with complete schema (households, household_members, family_settings, recipes, meal_plans, shopping_lists, pantry_preferences, api_usage)
   - Row-Level Security (RLS) policies on all tables
   - Automatic household creation on user signup
   - Updated timestamps and triggers
   - TypeScript types auto-generated from database schema

2. **Authentication System** ✅
   - Google OAuth integration via Supabase Auth
   - Magic Link email authentication
   - Secure session management with cookies
   - Protected routes requiring authentication
   - `/login` and `/signup` pages with OAuth buttons

3. **Multi-User Household Support** ✅
   - Household-scoped data isolation via RLS
   - Owner and member roles
   - Automatic household creation for new users
   - Support for multiple users per household (schema ready, invite UI pending)
   - Complete data isolation between households

4. **Storage Layer Architecture** ✅
   - 4-layer hybrid storage system (storage.ts → storageAsync.ts → hybridStorage.ts → supabaseStorage.ts)
   - Automatic routing between localStorage (anonymous) and Supabase (authenticated)
   - Recipe persistence (AI-generated, user-uploaded, custom)
   - Meal plan persistence with upsert conflict resolution
   - Family settings persistence (JSONB column for complete settings - migration 004 pending)
   - Recipe deduplication across multiple sources

5. **Data Migrations** ✅
   - Migration 001: Initial schema with 8 tables
   - Migration 002: Row-Level Security policies
   - Migration 003: Recipe ID conversion (UUID → TEXT for semantic IDs)
   - Migration 004: Full settings JSONB column (pending manual execution)
   - Database type generation command: `supabase gen types typescript`

6. **Bug Fixes & Optimizations** ✅
   - Fixed recipe persistence (recipes now load correctly on page refresh)
   - Fixed meal plan persistence (upsert with conflict resolution on household_id + week_start)
   - Fixed recipe deduplication (Map-based deduplication in getEnhancedRecipes)
   - Fixed recipe deletion (comprehensive multi-storage deletion)
   - Fixed budget calculations (using actual recipe serves value, not hardcoded 4)
   - Added cost estimation for user-uploaded recipes (ingredient count × $1.50 / serves)
   - Added loading states (isLoadingInitial) for skeleton loaders during page mount

#### Design System Integration (v1.14.0)

1. **Component Migration** ✅
   - Migrated 4 Sheet components (PantrySheet, RegenerateDrawer, WeeklyOverridesSheet, SwapDrawer)
   - Migrated 5 Slider components (budget/time controls)
   - Migrated 1 PasswordField (GitHub token)
   - Implemented ResponsiveGrid across Plan and Review pages
   - Refactored MealCard with customization props

2. **Code Consolidation** ✅
   - ~280 lines removed through component reuse
   - Standardized all drawers/sheets to Sheet component
   - Unified recipe cards using shared MealCard component
   - Consistent close buttons (IconButton) across all sheets

3. **Navigation UX** ✅
   - Fixed recipe page to use router.back() for context-aware navigation
   - Returns to previous page (Plan or Review) instead of hardcoded /plan

---

## 🛠️ Technology Stack

### Core Framework
- **Next.js 16.0.0** - React framework with App Router
- **React 19.2.0** - UI library with latest features
- **TypeScript 5.9.3** - Strict mode type safety
- **PNPM 10.19.0** - Fast, disk-efficient package manager

### Database & Authentication
- **Supabase PostgreSQL** - Production database (project: migfbyyftwgidbkwwyst)
- **Supabase Auth** - Authentication provider (Google OAuth + Magic Link)
- **Row-Level Security (RLS)** - Database-level security policies
- **@supabase/ssr** - Server-side rendering support for auth
- **@supabase/supabase-js** - Supabase JavaScript client

### AI & Machine Learning
- **Google Gemini API** - AI recipe generation (gemini-2.0-flash-exp model)
- **@google/generative-ai** - Official Gemini SDK
- **Vision API** - Image-based ingredient recognition

### UI & Design System
- **@common-origin/design-system v1.14.0** - Component library
- **15+ Production Components** - Sheet, Slider, Button, TextField, etc.
- **Design Tokens** - Consistent spacing, colors, typography
- **Responsive Grid** - Mobile-first adaptive layouts

### Data & Analytics
- **localStorage** - Client-side data persistence (anonymous users)
- **JSONB** - Structured data storage in PostgreSQL
- **Privacy-First Analytics** - Local-only event tracking
- **CSV Export** - Shopping list data export

### Development Tools
- **Vitest 4.0.3** - Fast unit testing
- **@testing-library/react** - Component testing
- **ESLint** - Code linting
- **Vercel** - Deployment platform
- **GitHub Actions** - CI/CD pipeline

### Key Dependencies
- **zod** - Runtime type validation
- **dayjs** - Date manipulation
- **cheerio** - HTML parsing (recipe indexer)
- **robots-parser** - Respectful web scraping

---

## 🎯 System Capabilities

### AI-Powered Recipe Generation
- **Gemini Integration**: Google's gemini-2.0-flash-exp model for recipe generation
- **Context-Aware**: Considers family settings, recent history, dietary preferences
- **Pantry Priority**: Prioritizes ingredients already in pantry/fridge
- **Customization**: Respects cuisine preferences, budget constraints, cooking time limits
- **Quality**: Generates family-friendly, practical recipes with clear instructions

### Pantry & Ingredient Management
- **Image Recognition**: Scan pantry/fridge photos to detect ingredients
- **Manual Entry**: Add/remove pantry items via PantrySheet
- **Waste Reduction**: AI prioritizes perishable pantry items
- **Priority Modes**: Hard (must use) or Soft (prefer) pantry preference

### Recipe Import & Extraction
- **URL Extraction**: Import recipes from any website via AI parsing
- **Image Extraction**: Extract recipes from food photos or screenshots
- **Smart Parsing**: Handles various recipe formats and structures
- **Library Integration**: Automatically adds extracted recipes to library

### Intelligent Meal Selection
- **Scoring Engine**: 10+ rules evaluating freshness, variety, timing, family fit
- **Variety Enforcement**: Protein rotation, cuisine diversity, cooking method balance
- **Recency Tracking**: 3-week rolling window prevents repetition
- **Bulk Cook Support**: Automatic leftover detection and scheduling

### Explainability
- **Reason Chips**: Human-readable explanations for every meal choice
- **Transparency**: Clear communication of why meals were selected
- **Visual Indicators**: Color-coded chips for different reason types

### Cost Intelligence
- **Coles Integration**: 30+ ingredient SKU mappings
- **Price Estimation**: Confidence-based pricing (high/medium)
- **Pack Optimization**: Multi-pack calculations, waste estimation
- **Shopping Insights**: Ingredient reuse tracking, cost per meal

### Privacy-First Analytics
- **Local Storage**: No server-side tracking
- **Event Types**: 11 different user actions tracked
- **Metrics**: Plan composition, cost optimization, engagement, regeneration
- **Dashboard**: Visual insights into planning patterns

### Security & Data Privacy
- **Row-Level Security (RLS)**: Database-level enforcement of household data isolation
- **Household Isolation**: Users can only access data from their own household
- **Encrypted Authentication**: Secure session management via Supabase Auth
- **HTTPS Only**: All connections encrypted in transit
- **No Cross-Household Access**: RLS policies prevent any data leakage between accounts
- **Automatic Cleanup**: CASCADE deletes when household or user is removed
- **Owner Controls**: Household owners can manage members (invite/remove)
- **Fresh Start**: New users start with empty household (no localStorage migration)

### Accessibility
- **WCAG 2.1 AA**: Full compliance with accessibility standards
- **Keyboard Navigation**: Complete keyboard-only support
- **Screen Readers**: ARIA labels, semantic HTML, landmarks
- **Mobile Touch**: 44px minimum touch targets, responsive layouts

---

## 📁 Key Files & Architecture

### Core Libraries (`apps/web/src/lib/`)

#### AI Integration
- **`@google/generative-ai`** - Google Gemini API client

#### Database & Storage Layer
- **`supabase/client.ts`** - Browser Supabase client with cookie-based auth
- **`supabase/server.ts`** - Server-side Supabase client for API routes and server components
- **`supabase/database.types.ts`** - Auto-generated TypeScript types from database schema
- **`supabaseStorage.ts`** - PostgreSQL CRUD operations (recipes, meal plans, settings, household data)
- **`hybridStorage.ts`** - Routes between localStorage (anonymous) and Supabase (authenticated users)
- **`storageAsync.ts`** - Async wrappers for storage operations
- **`storage.ts`** - Synchronous localStorage utilities (legacy/fallback)

#### Meal Planning Logic
- **`library.ts`** - Recipe library with normalized tags, filtering, search, custom recipe management
- **`compose.ts`** - Week composition algorithm (variety, constraints, leftovers)
- **`scoring.ts`** - Recipe scoring engine with 10+ rules
- **`explainer.ts`** - Converts reason codes to human-readable chips
- **`recencyTracker.ts`** - 3-week history tracking in localStorage
- **`tagNormalizer.ts`** - Unified tag vocabulary across recipes

#### Shopping & Pricing
- **`shoppingListAggregator.ts`** - Deduplicates ingredients, normalizes units
- **`colesMapping.ts`** - Manual SKU mappings, price estimation
- **`csv.ts`** - Shopping list CSV export

#### Data & Analytics
- **`storage.ts`** - localStorage utilities (household, overrides, history)
- **`analytics.ts`** - Privacy-first event tracking, metrics aggregation
- **`schedule.ts`** - Date/week utilities

### Components (`apps/web/src/components/app/`)

- **`MealCard.tsx`** - Meal display with reason chips and customization props
- **`LeftoverCard.tsx`** - Bulk cook leftover placeholder
- **`ShoppingListItem.tsx`** - Expandable ingredient with Coles info
- **`RegenerateDrawer.tsx`** - Plan regeneration with constraints (Sheet component)
- **`PantrySheet.tsx`** - Pantry item management with image scanning (Sheet component)
- **`WeeklyOverridesSheet.tsx`** - Week-specific preference overrides (Sheet component)
- **`SwapDrawer.tsx`** - Meal swapping with AI suggestions (Sheet component)

### Pages (`apps/web/src/app/`)

- **`/page.tsx`** - Landing page with auth check and redirect to /plan
- **`/login/page.tsx`** - Login page with Google OAuth and Magic Link
- **`/signup/page.tsx`** - Signup page with authentication options
- **`/auth/callback/route.ts`** - OAuth callback handler for Supabase Auth
- **`/plan/page.tsx`** - Weekly meal planning grid with wizard and swap functionality
- **`/plan/review/page.tsx`** - Plan review, summary stats, regeneration
- **`/shopping-list/page.tsx`** - Aggregated list with Coles pricing
- **`/analytics/page.tsx`** - Analytics dashboard
- **`/settings/page.tsx`** - Family preferences and GitHub sync configuration
- **`/settings/data-export/page.tsx`** - Export household data
- **`/recipe/[id]/page.tsx`** - Individual recipe details with context-aware navigation
- **`/recipes/page.tsx`** - Recipe library ("My Recipes")
- **`/recipes/add/page.tsx`** - Add recipe via URL, image, or manual entry
- **`/about/page.tsx`** - About page with tech stack and privacy information

### API Routes (`apps/web/src/app/api/`)

- **`/api/generate-recipes/route.ts`** - AI recipe generation endpoint (Gemini)
- **`/api/extract-recipe-from-image/route.ts`** - Image-based recipe extraction (Gemini Vision)
- **`/api/extract-recipe-from-url/route.ts`** - URL recipe scraping (Gemini)
- **`/api/list-models/route.ts`** - Gemini model testing and validation

### Recipe Sources

All recipes are dynamically managed through the application:
- **AI Generation**: Via Gemini API (`/api/generate-recipes`)
- **URL Extraction**: Via Gemini parsing (`/api/extract-recipe-from-url`)
- **Manual Entry**: Via the `/recipes/add` page
- **Image Extraction**: Via Gemini Vision (`/api/extract-recipe-from-image`)

---

## 🧪 Testing & Quality

### Type Safety
- TypeScript strict mode enabled
- All Phase 1 code type-checked
- Comprehensive interfaces for recipes, plans, analytics

### Accessibility
- WCAG 2.1 Level AA compliant
- Keyboard navigation tested
- Screen reader support verified
- Mobile touch targets validated

### Performance
- Client-side only (no server round trips)
- localStorage for persistence
- Deterministic algorithms (fast, predictable)

---

## 🚀 Next Steps

### Phase 3 Remaining Items

1. **Migration 004 Execution** ⏳
   - Status: File created, needs manual execution in Supabase Dashboard
   - Impact: Enables full_settings JSONB column for complete settings persistence
   - Priority: Medium (backward compatible columns working fine)

2. **Favorites Migration to Supabase** 📋
   - Status: Currently localStorage-only
   - Plan: Create favorite_recipes table with household_id foreign key
   - Impact: Low priority (nice-to-have for cross-device sync)

### Phase 4: Enhanced Multi-User Features

1. **Household Member Invites**
   - Email-based invitation system
   - UI for managing household members
   - Transfer ownership functionality
   - Member removal with proper authorization

2. **Household Management Page**
   - View all household members
   - Manage roles (owner/member)
   - Invitation link generation
   - Activity log for household changes

### Phase 5: Coles Checkout Integration

See [PHASE_3_CHECKOUT_INTEGRATION.md](./PHASE_3_CHECKOUT_INTEGRATION.md) for detailed plan:

1. **Smart Export + Deep Links** (MVP)
   - Enhanced CSV export with Coles product URLs
   - Deep linking to Coles product pages
   - Smart product matching improvements

2. **Browser Extension** (Optional)
   - Auto-fill Coles cart from shopping list
   - One-click checkout integration
   - Only if MVP shows strong user adoption

### Potential Future Enhancements

1. **Advanced AI Features**
   - Replace rule-based scoring with LLM reasoning
   - Natural language meal preferences
   - Personalized recipe recommendations based on history

2. **Real-Time Coles Integration**
   - Live pricing from Coles API
   - Product availability checks
   - Automated cart building

3. **Enhanced Analytics**
   - Weekly/monthly trend analysis
   - Cost savings tracking over time
   - Nutrition insights and goal tracking

4. **Social Features**
   - Share meal plans with friends/family
   - Recipe ratings and reviews
   - Community recipe submissions

5. **Mobile Native Apps**
   - iOS and Android apps
   - Push notifications for shopping reminders
   - Offline mode with sync

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, data flow, storage layers
- **[PROJECT_INSTRUCTIONS.md](./PROJECT_INSTRUCTIONS.md)** - Development guidelines and setup
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Library API documentation
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development workflows, testing, deployment
- **[QUICK_START.md](./QUICK_START.md)** - Quick setup guide for new developers
- **[PHASE_3_CHECKOUT_INTEGRATION.md](./PHASE_3_CHECKOUT_INTEGRATION.md)** - Coles integration roadmap
- **[supabase/README.md](../supabase/README.md)** - Database setup and migration instructions

---

## 🛠️ Development

### Prerequisites
- Node.js 20+
- PNPM 9+
- Supabase account (for database access)
- Google Cloud account (for Gemini API)

### Environment Variables
Required in `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://migfbyyftwgidbkwwyst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini AI
GOOGLE_API_KEY=your_gemini_api_key

# Optional: GitHub Integration
GITHUB_TOKEN=your_github_token
```

### Setup
```bash
# Install dependencies
pnpm install

# Generate database types
supabase gen types typescript --project-id migfbyyftwgidbkwwyst > apps/web/src/lib/supabase/database.types.ts

# Run migrations (in Supabase Dashboard SQL Editor)
# Execute: supabase/migrations/001_initial_schema.sql
# Execute: supabase/migrations/002_rls_policies.sql
# Execute: supabase/migrations/003_alter_recipes_id_to_text.sql
# Execute: supabase/migrations/004_add_full_settings_to_family_settings.sql
```

### Commands
```bash
# Development server
pnpm -F web dev

# Build for production
pnpm -F web build

# Type checking
pnpm -F web typecheck

# Linting
pnpm -F web lint

# Generate database types
supabase gen types typescript --project-id migfbyyftwgidbkwwyst > apps/web/src/lib/supabase/database.types.ts
```

---

## 📊 Metrics (as of Nov 30, 2025)

### Application
- **Recipes**: Unlimited AI-generated + user-uploaded recipes
- **Code Coverage**: Core libraries 100% typed with TypeScript strict mode
- **Accessibility**: WCAG 2.1 AA compliant
- **Lines of Code**: ~5,000+ (Phases 1-3 complete)
- **Components**: 25+ React components
- **Pages**: 12 routes with authentication
- **Design System**: v1.14.0 with 15+ components

### Database
- **Tables**: 8 (households, household_members, family_settings, recipes, meal_plans, shopping_lists, pantry_preferences, api_usage)
- **RLS Policies**: 30+ policies across all tables
- **Indexes**: 15+ for query optimization
- **Migrations**: 4 (3 applied, 1 pending)

### Features
- **AI Endpoints**: 4 (generate-recipes, extract-recipe-from-image, extract-recipe-from-url, list-models)
- **Storage Layers**: 4 (storage.ts → storageAsync.ts → hybridStorage.ts → supabaseStorage.ts)
- **Event Types**: 11 analytics events
- **Coles Mappings**: 179 products with SKU and pricing data
- **Authentication Methods**: 2 (Google OAuth, Magic Link)

---

## 🎯 Project Goals

### Achieved ✅
- ✅ Intelligent meal selection (deterministic rules + AI generation)
- ✅ Explainability for all decisions
- ✅ Cost transparency (179 Coles products mapped)
- ✅ Privacy-first analytics
- ✅ Accessibility compliance (WCAG 2.1 AA)
- ✅ Mobile-responsive design
- ✅ AI-powered recipe generation
- ✅ Tag normalization and smart search
- ✅ Shopping list with actual ingredients
- ✅ User authentication (Google OAuth + Magic Link)
- ✅ PostgreSQL database with Row-Level Security
- ✅ Multi-user household support (schema ready)
- ✅ Recipe persistence across sessions
- ✅ Meal plan persistence with conflict resolution
- ✅ Budget calculations with cost estimation
- ✅ Pantry scanning via AI image recognition
- ✅ URL recipe extraction

### In Progress 🚧
- 🚧 Migration 004 execution (full_settings JSONB column)
- 🚧 Household member invitation UI
- 🚧 Favorites migration to Supabase

### Future 🔮
- 🔮 Coles checkout integration (deep links + browser extension)
- 🔮 LLM-powered meal reasoning
- 🔮 Real-time Coles API integration
- 🔮 Nutrition tracking and goals
- 🔮 Social features (share plans, rate recipes)
- 🔮 Mobile native apps (iOS/Android)

---

## 📁 Repository Structure

```
meal-agent/
├── .github/
│   ├── PROJECT_STATUS.md            # This file - comprehensive project overview
│   ├── ARCHITECTURE.md              # System architecture and data flow
│   ├── PROJECT_INSTRUCTIONS.md      # Development guidelines
│   ├── DEVELOPMENT.md               # Development workflows
│   ├── QUICK_START.md               # Quick setup guide
│   ├── PHASE_3_CHECKOUT_INTEGRATION.md  # Coles integration roadmap
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI pipeline
├── apps/
│   └── web/                         # Next.js application
│       ├── src/
│       │   ├── app/                 # App Router pages and API routes
│       │   │   ├── page.tsx         # Landing page with auth check
│       │   │   ├── login/           # Login page
│       │   │   ├── signup/          # Signup page
│       │   │   ├── auth/callback/   # OAuth callback
│       │   │   ├── plan/            # Meal planning pages
│       │   │   ├── recipes/         # Recipe library and add recipe
│       │   │   ├── shopping-list/   # Shopping list page
│       │   │   ├── settings/        # Settings pages
│       │   │   ├── analytics/       # Analytics dashboard
│       │   │   ├── about/           # About page
│       │   │   └── api/             # API routes (AI endpoints)
│       │   ├── components/
│       │   │   └── app/             # Application components
│       │   └── lib/
│       │       ├── supabase/        # Supabase clients and types
│       │       │   ├── client.ts    # Browser client
│       │       │   ├── server.ts    # Server client
│       │       │   └── database.types.ts  # Generated types
│       │       ├── supabaseStorage.ts     # PostgreSQL CRUD
│       │       ├── hybridStorage.ts       # Hybrid localStorage/Supabase
│       │       ├── storageAsync.ts        # Async storage wrappers
│       │       ├── storage.ts             # localStorage utils
│       │       ├── library.ts             # Recipe library management
│       │       ├── compose.ts             # Meal planning algorithm
│       │       ├── scoring.ts             # Recipe scoring engine
│       │       ├── explainer.ts           # Reason chip generation
│       │       ├── colesMapping.ts        # Coles product mappings
│       │       ├── analytics.ts           # Event tracking
│       │       └── types/                 # TypeScript types
├── supabase/
│   ├── migrations/                  # Database migrations
│   │   ├── 001_initial_schema.sql   # Create tables
│   │   ├── 002_rls_policies.sql     # Row-Level Security
│   │   ├── 003_alter_recipes_id_to_text.sql  # Recipe ID migration
│   │   └── 004_add_full_settings_to_family_settings.sql  # JSONB settings
│   └── README.md                    # Database setup instructions
└── pnpm-workspace.yaml              # Monorepo configuration
```

---

## ✅ Definition of Done

### Phase 1 (Complete ✅)
- [x] Web app UI fully scaffolded with App Router
- [x] All routes rendering correctly
- [x] Design system integrated (v1.14.0)
- [x] Recipe library connected to app
- [x] Shopping list with actual ingredients
- [x] All 10 work orders implemented
- [x] Explainability and cost transparency
- [x] Privacy-first analytics

### Phase 2 (Complete ✅)
- [x] Google Gemini AI integration (gemini-2.0-flash-exp)
- [x] AI recipe generation with family settings
- [x] Pantry scanning via image recognition
- [x] URL recipe extraction
- [x] Weekly planning wizard
- [x] Intelligent swap suggestions
- [x] Ingredient usage analytics
- [x] Design system component migrations

### Phase 3 (Complete ✅)
- [x] Supabase PostgreSQL database (8 tables)
- [x] Row-Level Security policies on all tables
- [x] Google OAuth authentication
- [x] Magic Link email authentication
- [x] 4-layer storage architecture
- [x] Recipe persistence across sessions
- [x] Meal plan persistence with conflict resolution
- [x] Household-scoped data isolation
- [x] Budget calculation fixes
- [x] Cost estimation for user recipes
- [x] Loading states and UX improvements

### Phase 3 Remaining
- [ ] Execute migration 004 (full_settings JSONB column)
- [ ] Household member invitation UI
- [ ] Migrate favorites to Supabase

---

## 🎉 Current Status

**The Meal Agent is fully deployed to production with:**
- ✅ AI-powered recipe generation
- ✅ Multi-user household support with authentication
- ✅ PostgreSQL database with complete data persistence
- ✅ Row-Level Security for household data isolation
- ✅ Unlimited AI-generated and user-uploaded recipes
- ✅ Budget tracking with Coles product pricing (179 products)
- ✅ Intelligent meal planning with explainability
- ✅ Pantry scanning and URL recipe extraction
- ✅ Shopping list export with CSV
- ✅ Privacy-first local analytics
- ✅ WCAG 2.1 AA accessibility compliance

**Ready for user onboarding and feedback collection!**

