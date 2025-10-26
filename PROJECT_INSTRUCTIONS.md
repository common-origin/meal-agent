# Meal Agent Project Instructions

## Project Overview
Building a family meal planning application using Common Origin Design System (@common-origin/design-system) in a PNPM monorepo with Next.js.

## Design System Integration
- **Package**: `@common-origin/design-system` (available on NPM)
- **Documentation**: https://common-origin-design-system.vercel.app/
- **Available Components**: Avatar, Stack, Typography, and more (confirmed access)
- **Tokens**: Full design token system available

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
- `/plan` - Weekly meal grid + BudgetBar
- `/recipe/[id]` - Recipe details with provenance
- `/shopping-list` - Aisle-grouped list with CSV export

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
- Core: Next.js, TypeScript, React
- Utilities: zod, dayjs
- Design System: @common-origin/design-system

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
- Design system integration is seamless
- Mobile responsive design
- Accessibility compliance (WCAG 2.2 AA)
- TypeScript strict mode compliance

## Notes for Copilot
- Always use exact component APIs from DS documentation
- Prefer composition over custom styling
- Follow accessibility patterns from DS examples
- Use semantic tokens for spacing and colors
- Test responsive behavior on mobile