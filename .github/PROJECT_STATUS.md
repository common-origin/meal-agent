# Meal Agent Project Status

**Last Updated**: 6 November 2025  
**Status**: ✅ **Phase 1 & 2 Complete** - AI-Powered Meal Planning - **DEPLOYED TO PRODUCTION**  
**Production URL**: https://meal-agent-gvvyzmw1k-commonorigins-projects.vercel.app

---

## 📊 Current State

### ✅ Phase 1: Complete (All 10 Work Orders + Recipe Integration)

**Status**: Production-ready intelligent meal planning system with real RecipeTin Eats recipes, explainability, cost transparency, and analytics.

### ✅ Phase 2: Complete (AI Integration & Advanced Features)

**Status**: AI-powered recipe generation, pantry scanning, URL extraction, and weekly planning wizard fully implemented using Google Gemini API.

#### Completed Work Orders

1. **WO1: Tag Normalization** ✅
   - `lib/tagNormalizer.ts` - Unified tag vocabulary
   - Enhanced `lib/library.ts` with normalized tags

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
   - Seamless integration with SwapDrawer

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

- **`/plan/page.tsx`** - Weekly meal planning grid with wizard and swap functionality
- **`/plan/review/page.tsx`** - Plan review, summary stats, regeneration
- **`/shopping-list/page.tsx`** - Aggregated list with Coles pricing
- **`/analytics/page.tsx`** - Analytics dashboard
- **`/settings/page.tsx`** - Family preferences and GitHub sync configuration
- **`/recipe/[id]/page.tsx`** - Individual recipe details with context-aware navigation

### API Routes (`apps/web/src/app/api/`)

- **`/api/generate-recipes/route.ts`** - AI recipe generation endpoint (Gemini)
- **`/api/extract-recipe-from-image/route.ts`** - Image-based recipe extraction (Gemini Vision)
- **`/api/extract-recipe-from-url/route.ts`** - URL recipe scraping (Gemini)
- **`/api/list-models/route.ts`** - Gemini model testing and validation

### Data Files

- **`data/library/recipes.generated.json`** - 50+ recipes from RecipeTin Eats
- **`data/library/nagi/*.json`** - Individual indexed recipe files

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

## 🚀 Next Steps (Phase 2+)

### ✅ Recipe Integration - COMPLETE (Nov 2, 2025)

The app now uses **real RecipeTin Eats recipes** instead of mock data:
- ✅ 50+ real recipes loaded from `recipes.generated.json`
- ✅ `RecipeLibrary` class replaces `MockLibrary`
- ✅ All pages (plan, review, shopping list) use real recipe data
- ✅ Tag normalization and search working with real recipes
- ✅ Shopping list shows actual ingredients from indexed recipes

### Potential Enhancements (Phase 2)

1. **LLM Integration**
   - Replace rule-based scoring with GPT-4 reasoning
   - Natural language meal preferences
   - Dynamic recipe suggestions

2. **Coles API Integration**
   - Real-time pricing from Coles API
   - Product availability checks
   - Automated cart building

3. **Enhanced Analytics**
   - Weekly/monthly trend analysis
   - Cost savings tracking
   - Nutrition insights

4. **Social Features**
   - Share meal plans
   - Recipe ratings/reviews
   - Family meal coordination

5. **Mobile App**
   - Native iOS/Android apps
   - Push notifications for shopping
   - Offline mode

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, data flow
- **[PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)** - Phase 1 work order details
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Library API documentation
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - Development setup, commands

---

## 🛠️ Development

### Prerequisites
- Node.js 20+
- pnpm 9+

### Setup
```bash
pnpm install
```

### Commands
```bash
# Development server
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Index new recipes
pnpm index-chefs

# Run analytics
pnpm analytics
```

---

## 📊 Metrics (as of Nov 2, 2025)

- **Recipes**: 50+ real recipes from RecipeTin Eats (integrated and working)
- **Code Coverage**: Core libraries 100% typed
- **Accessibility**: WCAG 2.1 AA compliant
- **Lines of Code**: ~3,500 (Phase 1 + Integration)
- **Components**: 10+ React components
- **Library Functions**: 15+ utilities
- **Event Types**: 11 analytics events
- **Coles Mappings**: 30+ ingredients
- **Design System**: v1.9.6 with proper token types

---

## 🎯 Project Goals

### Achieved ✅
- ✅ Intelligent meal selection (deterministic rules)
- ✅ Explainability for all decisions
- ✅ Cost transparency (Coles integration)
- ✅ Privacy-first analytics
- ✅ Accessibility compliance
- ✅ Mobile-responsive design
- ✅ Real recipe integration (50+ RecipeTin Eats recipes)
- ✅ Tag normalization and smart search
- ✅ Shopping list with actual ingredients

### Future 🔮
- 🔮 LLM-powered reasoning
- 🔮 Real-time Coles API integration
- 🔮 Nutrition tracking
- 🔮 Social features
- 🔮 Mobile apps

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, data flow

```
meal-agent/
├── .github/
│   ├── PROJECT_INSTRUCTIONS.md      # Development guidelines
│   ├── COPILOT_BUILD.md             # Original scaffolding guide
│   ├── INDEXER_ENHANCEMENT_PLAN.md  # Indexer development log (COMPLETE)
│   └── PROJECT_STATUS.md            # This file
├── apps/
│   └── web/                         # Next.js app
│       ├── src/
│       │   ├── app/                 # Routes (/, /plan, /recipe, etc.)
│       │   ├── components/          # UI components
│       │   └── lib/
│       │       ├── library.ts       # ✅ RecipeLibrary (real recipes)
│       │       ├── recipes.ts       # Auto-generated from build script
│       │       ├── recipes.generated.json  # 50 real recipes
│       │       ├── compose.ts       # Meal planning logic
│       │       ├── storage.ts       # Local storage utils
│       │       ├── csv.ts           # Shopping list CSV export
│       │       └── types/           # TypeScript types
├── data/
│   └── library/
│       └── nagi/                    # 50 RecipeTin Eats recipes (JSON-LD)
├── scripts/
│   └── indexChefs.ts                # Recipe indexer (COMPLETE)
└── pnpm-workspace.yaml
```

---

## 🔧 Configuration Files

### Recipe Indexer Config
**File**: `scripts/indexChefs.ts`

```typescript
// Chef sources
const CHEFS: ChefConfig[] = [
  {
    name: "nagi",
    domain: "recipetineats.com",
    robotsTxtUrl: "https://www.recipetineats.com/robots.txt",
    sitemapUrl: "https://www.recipetineats.com/sitemap_index.xml",
    excludePatterns: ["/blog/", "/category/", "/tag/", "/page/", "-food-map", "/about", "/contact", "/privacy", "/terms"]
  }
];

// Recipe quality filters
const RECIPE_FILTERS: RecipeFilters = {
  maxTotalTimeMinutes: 60,
  maxIngredients: 18,
  excludeCategories: ["Breakfast", "Brunch", "Dessert", "Baking", "Drinks", "Cocktails", "Snack", "Cupcake", "Sweet", "Cookie", "Brownie", "Cake", "Tart"],
  requireDinnerFocused: true
};
```

**To adjust filters**: Edit `RECIPE_FILTERS` in `scripts/indexChefs.ts`  
**To add chefs**: Add to `CHEFS` array with domain, sitemap, and exclude patterns

---

## 📊 Metrics

### Recipe Library
- **Total Recipes**: 50
- **Source**: RecipeTin Eats (Nagi)
- **Categories**: Dinner (4), Pasta (2), Noodles (4), Chicken (2), BBQ (2), Party Food (4)
- **Time Range**: 10-60 minutes
- **Ingredient Range**: 3-18 ingredients
- **Quality Pass Rate**: 50% (50/100 candidates)

### App Features
- **Routes**: 5 main pages (welcome, onboarding, plan, recipe, shopping-list)
- **Components**: 15+ reusable components
- **Design System**: Full integration with @common-origin/design-system
- **Responsive**: Mobile-first with desktop optimizations
- **Accessibility**: WCAG 2.2 AA compliant

---

## 🎯 Immediate Next Actions

1. **Create Real Recipe Loader** (`apps/web/src/lib/library.ts`)
   - Load from `data/library/nagi/`
   - Convert JSON-LD to app Recipe type
   - Implement search interface

2. **Update Imports**
   - Replace `MockLibrary` with `RecipeLibrary` in:
     - `compose.ts`
     - `plan/page.tsx`

3. **Test Integration**
   - Verify meal planning uses real recipes
   - Check recipe details render correctly
   - Ensure shopping list shows real ingredients

4. **Deploy to Vercel**
   - Push to GitHub
   - Verify production build works
   - Test live site

---

## 🚀 Future Enhancements

### Short Term
- [ ] Integrate real recipes with app (this week)
- [ ] Add recipe images from indexed data
- [ ] Implement search/filter on recipe library
- [ ] Cost estimation refinement

### Medium Term
- [ ] Add more chefs (find sites with good JSON-LD)
- [ ] Increase recipe count to 100+ per chef
- [ ] User favorites persistence
- [ ] Recipe ratings/reviews

### Long Term
- [ ] Database migration (PostgreSQL/Supabase)
- [ ] Full-text recipe search
- [ ] AI-powered meal suggestions
- [ ] Nutrition tracking
- [ ] Meal prep instructions

---

## 📝 Documentation

- **Development Guide**: `.github/PROJECT_INSTRUCTIONS.md`
- **Indexer Documentation**: `.github/INDEXER_ENHANCEMENT_PLAN.md`
- **Build Process**: `.github/COPILOT_BUILD.md`
- **Design System Docs**: https://common-origin-design-system.vercel.app/

---

## ✅ Definition of Done (Phase 1)

- [x] Recipe indexer functional and production-ready
- [x] 50+ quality recipes indexed
- [x] Web app UI fully scaffolded
- [x] All routes rendering correctly
- [x] Design system integrated (v1.9.6)
- [x] **Real recipes connected to app** ✅ COMPLETE (Nov 2, 2025)
- [x] Shopping list uses real ingredients
- [x] All 10 work orders implemented
- [ ] Deployed to production ← RECOMMENDED NEXT STEP

**Status**: 95% Complete - Ready for production deployment!

**Next Steps:**
1. Deploy to Vercel production
2. User testing and feedback collection
3. Plan Phase 2 enhancements

