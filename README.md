# Meal Agent

**Production URL**: https://meal-agent.vercel.app

An AI-powered multi-user meal planning application that helps households plan weekly dinners with authentication, persistent storage, and intelligent recipe recommendations.

## ✨ Key Features

### Core Functionality
- 📅 **Weekly Meal Planning** - Visual calendar with drag-and-drop meal scheduling
- 🔐 **User Authentication** - Google OAuth + Magic Link email authentication
- 👥 **Multi-User Households** - Household-based data isolation with Row-Level Security
- 💾 **Persistent Storage** - PostgreSQL database with automatic synchronization
- 🤖 **AI Recipe Generation** - Gemini-powered personalized recipes based on family preferences
- 🍳 **Curated Recipe Library** - 50+ real recipes from RecipeTin Eats
- 🔄 **Intelligent Swapping** - Swap meals with AI suggestions or curated alternatives
- 💰 **Budget Tracking** - Real-time cost estimates with 179 mapped Coles products

### Advanced Features
- 📸 **Pantry Scanning** - AI image recognition to detect ingredients from photos
- 🔗 **URL Recipe Extraction** - Import recipes from any website
- 🎯 **Weekly Planning Wizard** - Step-by-step guided meal plan generation
- 🛒 **Smart Shopping Lists** - Aggregated ingredients with Coles pricing and CSV export
- 📊 **Analytics Dashboard** - Privacy-first local analytics tracking
- ⚙️ **Regeneration** - Pin favorite meals and regenerate others with custom constraints
- 📈 **Ingredient Analytics** - Track usage frequency to prioritize price mapping

### Family Customization
- 👨‍👩‍👧‍👦 **Household Settings** - Servings, adults, children with ages
- 🌍 **Cuisine Preferences** - Select favorite cuisines and dietary restrictions
- ⏱️ **Cooking Constraints** - Budget ranges, time limits, skill level
- 🌶️ **Spice Tolerance** - Customize heat levels
- 🏪 **Location Settings** - Seasonal and regional ingredient preferences

## 🛠️ Technology Stack

### Core Framework
- **Next.js 16.0.0** - React framework with App Router and Server Components
- **React 19.2.0** - Latest React with concurrent features
- **TypeScript 5.9.3** - Strict type safety with auto-generated database types
- **PNPM 10.19.0** - Fast, efficient package manager

### Database & Authentication
- **Supabase PostgreSQL** - Production database with automatic backups
- **Supabase Auth** - Google OAuth + Magic Link authentication
- **Row-Level Security** - Database-level data isolation by household
- **8 Tables** - Complete schema with relationships and indexes

### AI & Machine Learning
- **Google Gemini API** - gemini-2.0-flash-exp model
  - Recipe generation
  - Image recognition (pantry scanning)
  - URL extraction and parsing

### UI & Design
- **@common-origin/design-system v1.14.0** - 15+ production components
- **WCAG 2.1 AA Compliant** - Fully accessible
- **Responsive Design** - Mobile-first approach

### Data & Pricing
- **179 Coles Products** - Manually mapped with SKUs and pricing
- **Ingredient Analytics** - Automatic usage frequency tracking
- **Category-Based Fallback** - Price estimation for unmapped items

## 🚀 Getting Started

### Prerequisites

- **Node.js 20+**
- **PNPM 9+** (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Supabase Account** (for database access)
- **Google Cloud Account** (for Gemini API)

### Environment Variables

Create `.env.local` in `apps/web/`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://migfbyyftwgidbkwwyst.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Optional: GitHub Integration
GITHUB_TOKEN=your_github_token
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/common-origin/meal-agent.git
   cd meal-agent
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run database migrations**
   
   Open [Supabase SQL Editor](https://supabase.com/dashboard/project/migfbyyftwgidbkwwyst/sql) and execute:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_alter_recipes_id_to_text.sql`
   - `supabase/migrations/004_add_full_settings_jsonb.sql`
   - `supabase/migrations/005_add_nutrition_column.sql`
   - `supabase/migrations/006_add_ics_token.sql`

4. **Generate database types**
   ```bash
   supabase gen types typescript --project-id migfbyyftwgidbkwwyst > apps/web/src/lib/supabase/database.types.ts
   ```

5. **Start development server**
   ```bash
   pnpm -F web dev
   ```

6. **Open your browser**
   ```
   http://localhost:3000
   ```

### Available Commands

```bash
# Development
pnpm -F web dev          # Start dev server with hot reload
pnpm -F web build        # Build for production  
pnpm -F web start        # Start production server

# Quality Assurance
pnpm -F web lint         # Run ESLint
pnpm -F web typecheck    # TypeScript type checking
pnpm test                # Run Vitest unit tests

# Database
supabase gen types typescript --project-id migfbyyftwgidbkwwyst > apps/web/src/lib/supabase/database.types.ts
```

## 📁 Project Structure

```
meal-agent/
├── apps/
│   └── web/                      # Next.js application
│       ├── src/
│       │   ├── app/              # App Router pages & API routes
│       │   │   ├── (auth)        # Auth pages (login, signup)
│       │   │   ├── plan/         # Meal planning pages
│       │   │   ├── recipes/      # Recipe library
│       │   │   ├── settings/     # Settings pages
│       │   │   └── api/          # AI API endpoints
│       │   ├── components/       # React components
│       │   └── lib/              # Core logic & utilities
│       │       ├── supabase/     # Database clients & types
│       │       ├── supabaseStorage.ts    # PostgreSQL CRUD
│       │       ├── hybridStorage.ts      # Storage router
│       │       ├── compose.ts            # Meal planning algorithm
│       │       ├── scoring.ts            # Recipe scoring
│       │       └── colesMapping.ts       # Price mappings
├── supabase/
│   ├── migrations/               # Database migrations
│   └── README.md                 # Database setup guide
└── .github/
    ├── workflows/                # CI/CD pipelines
    └── *.md                      # Documentation
```

## 🎨 Design System

Built with [Common Origin Design System v1.14.0](https://common-origin-design-system.vercel.app/)

### Components Used
- **Sheet** - Drawers (Pantry, Swap, Regenerate, Weekly Overrides)
- **Slider** - Budget and time range controls
- **PasswordField** - Secure input with visibility toggle
- **ResponsiveGrid** - Adaptive 1→2→3→4 column layouts
- **Button** - Primary, secondary, and naked variants
- **TextField** - Text inputs with validation
- **NumberInput** - Number inputs with min/max
- **Dropdown** - Select menus
- **Checkbox** - Boolean toggles
- **Typography** - Semantic text hierarchy
- **Avatar** - User profile images
- **Stack** - Layout primitive
- **Box** - Flexible containers
- **Chip** - Tags and labels
- **IconButton** - Icon-only buttons
- **Divider** - Visual separators
- **Container** - Page width constraints

All components are WCAG 2.1 AA accessible with full keyboard navigation and screen reader support.

## 🔒 Security & Privacy

### Data Isolation
- **Row-Level Security (RLS)** - PostgreSQL policies enforce household data isolation
- **No Cross-Household Access** - Users can only see their own household's data
- **Automatic Enforcement** - Security enforced at database level, not just application

### Authentication
- **Google OAuth** - Secure authentication via Supabase Auth
- **Magic Link** - Passwordless email authentication
- **Session Management** - Cookie-based sessions with automatic refresh
- **Protected Routes** - All data pages require authentication

### Privacy
- **Privacy-First Analytics** - All analytics stored locally, never sent to servers
- **Fresh Start** - New users start with empty household (no localStorage migration)
- **Data Export** - Users can export all their data as JSON
- **Complete Control** - Users can delete their account and all associated data

## 📦 Deployment

### Vercel (Production)

1. **Connect repository** to Vercel
2. **Configure settings**:
   - Framework: Next.js
   - Root Directory: `apps/web`
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`
3. **Add environment variables** (see Environment Variables section above)
4. **Deploy** - Automatic deployments on every push to main

### Database Setup (Supabase)

1. Create Supabase project
2. Run migrations in SQL Editor (see Installation section)
3. Configure Auth providers (Google OAuth)
4. Add redirect URLs to Auth settings:
   - `https://your-domain.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`

### Manual Deployment

```bash
# Build for production
pnpm -F web build

# Start production server
pnpm -F web start
```

## 📚 Documentation

- **[PRODUCT.md](./PRODUCT.md)** - Why this exists and what it needs to achieve — start here
- **[CLAUDE.md](./CLAUDE.md)** - Index of the docs below, plus known doc/code drift to verify before trusting
- **[ARCHITECTURE.md](./.github/ARCHITECTURE.md)** - System architecture and data flow
- **[DEVELOPMENT.md](./.github/DEVELOPMENT.md)** - Getting started, workflows, testing
- **[AI.md](./.github/AI.md)** - Gemini API setup and troubleshooting
- **[supabase/README.md](./supabase/README.md)** - Database setup instructions
- **[Design System Docs](https://common-origin-design-system.vercel.app/)** - Component library documentation

## 🎯 Roadmap

Tracked as [GitHub Issues](https://github.com/common-origin/meal-agent/issues), not a static checklist here — a roadmap written into a doc goes stale exactly like the one this replaced had (it listed the storage architecture as a completed achievement; see #2 for why that's not accurate, and #36 for the Coles checkout/pricing work it called "Phase 5+").

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/new-feature`
3. Make your changes and commit: `git commit -m 'feat: add new feature'`
4. Push to the branch: `git push origin feat/new-feature`
5. Submit a pull request

Please ensure:
- TypeScript strict mode compliance
- WCAG 2.1 AA accessibility standards
- Unit tests for new features
- Documentation updates

## 📝 License

[MIT License](LICENSE)

---

**Built with ❤️ by Common Origin**

- Design System: [@common-origin/design-system](https://www.npmjs.com/package/@common-origin/design-system)
- Powered by: Next.js, Supabase, Google Gemini AI
- Deployed on: Vercel