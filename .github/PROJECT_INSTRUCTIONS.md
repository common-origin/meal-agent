# Meal Agent Project Instructions

## Project Overview
Building a family meal planning application using Common Origin Design System (@common-origin/design-system) in a PNPM monorepo with Next.js.

## Design System Integration
- **Package**: `@common-origin/design-system` v1.14.0 (available on NPM)
- **Documentation**: https://common-origin-design-system.vercel.app/
- **Available Components**: 15+ production-ready components
- **Tokens**: Full design token system available

### Core Components in Use
- **Sheet** - Drawers and side panels with animations (PantrySheet, SwapDrawer, RegenerateDrawer, WeeklyOverridesSheet)
- **Slider** - Range inputs for budget and time controls (5 instances in Settings)
- **PasswordField** - Secure password entry with show/hide toggle (GitHub token)
- **ResponsiveGrid** - Adaptive grid layouts (Plan and Review pages)
- **IconButton** - Icon-only buttons (close buttons in sheets)
- **Button** - Primary/secondary/destructive actions
- **TextField** - Text inputs with validation
- **NumberInput** - Number inputs with min/max
- **Dropdown** - Select inputs
- **Checkbox** - Boolean options
- **Container** - Page width constraints
- **Stack** - Vertical/horizontal spacing
- **Box** - Flexible container with design tokens
- **Typography** - Semantic heading and text variants
- **Avatar** - User/chef profile images
- **Chip** - Tags, filters, and labels
- **Divider** - Visual separation

## Project Structure
```
meal-agent/
├── apps/
│   └── web/                 # Next.js app with App Router
├── packages/
│   ├── common-origin-ds/    # Local DS workspace (if needed)
│   └── utils/              # Shared utilities
├── pnpm-workspace.yaml
└── scripts/
```

## Key Routes & Components to Build
- `/` - Welcome page with CTA links
- `/onboarding` - Multi-step onboarding
- `/plan` - Weekly meal grid + BudgetBar + PantrySheet + SwapDrawer
- `/plan/review` - Plan review with regeneration
- `/recipe/[id]` - Recipe details with provenance
- `/shopping-list` - Aisle-grouped list with CSV export
- `/settings` - Family preferences (household, cooking profile, location, dietary needs) and GitHub sync
- `/analytics` - Privacy-first analytics dashboard

## AI Integration
- **Provider**: Google Gemini API (gemini-2.0-flash-exp)
- **Features**:
  - AI recipe generation from family settings (cuisine, dietary needs, spice tolerance, cooking skill, effort preference, location/seasonality)
  - Pantry scanning via image upload
  - URL recipe extraction
  - Weekly planning wizard
  - Smart swap suggestions
  - Personalized recommendations based on cooking profile and location

## Design System Components Needed
Based on plan requirements, we'll use:
- `Avatar` (for chef selection)
- `Stack` (layout primitive)
- `Typography` (text hierarchy)
- `Card` (meal cards)
- `Button` (actions)
- `Chip` (tags, conflicts)
- `Progress` (budget bar)

## Potential New DS Components to Suggest
- `Toast` component (for Sunday notifications)
- `Grid` component (for meal planning grid)
- `Modal`/`Drawer` components (for mobile swap flows)

## Dependencies to Install
- Core: Next.js 16, TypeScript, React 19
- Utilities: zod, dayjs
- Design System: @common-origin/design-system@1.14.0
- AI: @google/generative-ai
- GitHub: octokit

## Development Tools
- PNPM 9+ (with corepack)
- Node 20+
- GitHub CLI for repo management
- Vercel for deployment

## Phase-by-Phase Approach
1. **Setup**: Repository, workspace, and basic structure
2. **Providers**: Theme integration and layout
3. **Routes**: Core pages and navigation
4. **Components**: Meal cards, budget tracking, etc.
5. **Features**: CSV export, scheduling, mock data
6. **CI/CD**: GitHub Actions and Vercel integration

## Success Criteria
- All routes render without errors
- CSV export functionality works
- Design system v1.14.0 integration is seamless
- Mobile responsive design
- Accessibility compliance (WCAG 2.2 AA)
- TypeScript strict mode compliance
- AI recipe generation functional
- Pantry scanning and URL extraction working
- All Sheet components use design system Sheet
- Context-aware navigation (router.back())

## Notes for Copilot
- Always use exact component APIs from DS documentation
- Prefer composition over custom styling
- Follow accessibility patterns from DS examples
- Use semantic tokens for spacing and colors
- Test responsive behavior on mobile