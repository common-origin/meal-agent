# Meal Agent

**Production URL**: https://meal-agent-gvvyzmw1k-commonorigins-projects.vercel.app

A family meal planning application built with Common Origin Design System.

## Features

- 📅 **Weekly Meal Planning** - Plan dinners for the week with an intuitive grid
- 🍳 **Real Recipes** - 50+ recipes from RecipeTin Eats with real ingredients
- 💰 **Budget Tracking** - Track spending against your weekly food budget with Coles price estimates
- 🛒 **Smart Shopping Lists** - Aggregated ingredient lists with CSV export
- 📊 **Analytics** - Privacy-first local analytics tracking
- 🔄 **Meal Regeneration** - Intelligent meal suggestions with explainability

## Development

This is a PNPM monorepo with the following structure:

```
meal-agent/
├── apps/
│   └── web/           # Next.js application
├── packages/
│   └── utils/         # Shared utilities
└── .github/
    └── workflows/     # CI/CD pipelines
```

### Prerequisites

- Node.js 20+
- PNPM 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Getting Started

1. **Clone and install**
   ```bash
   git clone https://github.com/common-origin/meal-agent.git
   cd meal-agent
   pnpm install
   ```

2. **Start development server**
   ```bash
   pnpm -F web dev
   ```

3. **Open your browser**
   ```
   http://localhost:3000
   ```

### Available Scripts

```bash
# Development
pnpm -F web dev          # Start dev server
pnpm -F web build        # Build for production  
pnpm -F web start        # Start production server

# Quality Assurance
pnpm -F web lint         # Run ESLint
pnpm -F web typecheck    # Run TypeScript checking
```

## Design System

This project uses the [Common Origin Design System](https://common-origin-design-system.vercel.app/) with components like:

- `Avatar` - User profile pictures with initials fallback
- `Stack` - Flexible layout primitive with gap control
- `Typography` - Semantic text hierarchy (h1-h6, body, small, etc.)

*Note: Currently experiencing React version compatibility issues between Next.js 16 (React 19) and the design system (React 18). Working with the design system team to resolve.*

## Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Import the project** with these settings:
   - Framework: Next.js
   - Root Directory: `apps/web`
   - Build Command: `cd apps/web && pnpm build`
   - Install Command: `pnpm install`

3. **Deploy** - Vercel will automatically deploy on every push to main

### Manual Deployment

```bash
pnpm -F web build
pnpm -F web start
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/new-feature`
3. Make your changes and commit: `git commit -m 'feat: add new feature'`
4. Push to the branch: `git push origin feat/new-feature`
5. Submit a pull request

## License

[MIT License](LICENSE)

---

Built with ❤️ using Common Origin Design System

## Features

- Weekly meal planning with visual calendar
- Chef-based recipe categorization  
- Smart shopping list generation with aisle grouping
- CSV export for grocery pickup services
- Budget tracking and meal cost estimation
- Mobile-responsive design with swap functionality

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Design System**: [@common-origin/design-system](https://www.npmjs.com/package/@common-origin/design-system)
- **Package Manager**: PNPM
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm -F web dev

# Build for production
pnpm -F web build
```

## Documentation

- [Design System](https://common-origin-design-system.vercel.app/)
- [Project Instructions](./PROJECT_INSTRUCTIONS.md)
- [Build Guide](./# COPILOT_BUILD.md)