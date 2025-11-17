# Meal Agent

**Production URL**: https://meal-agent-gvvyzmw1k-commonorigins-projects.vercel.app

A family meal planning application built with Common Origin Design System.

## Features

- 📅 **Weekly Meal Planning** - Plan dinners for the week with an intuitive responsive grid
- 🤖 **AI Recipe Generation** - Gemini-powered personalized recipe creation based on family preferences
- 🍳 **Real Recipes** - 50+ curated recipes from RecipeTin Eats and Jamie Oliver with real ingredients
- 🔄 **Intelligent Swapping** - Swap meals with AI-generated suggestions or curated alternatives
- 💰 **Budget Tracking** - Track spending against your weekly food budget with cost estimates
- 🛒 **Smart Shopping Lists** - Aggregated ingredient lists with pantry awareness and CSV export
- � **Pantry Scanning** - AI-powered image recognition to detect ingredients from photos
- 🎯 **Weekly Planning Wizard** - Interactive wizard for cuisine selection and pantry management
- 👨‍👩‍👧‍👦 **Family Settings** - Customizable preferences for servings, dietary needs, budget, cook time, cooking skill, spice tolerance, and location
- �📊 **Analytics** - Privacy-first local analytics tracking
- ⚙️ **Regeneration** - Pin favorite meals and regenerate the rest with custom constraints

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

This project uses the [Common Origin Design System v1.14.0](https://common-origin-design-system.vercel.app/) with components including:

### Core Components
- `Sheet` - Side and bottom drawers with overlay (used for Pantry, Swap, Regenerate, WeeklyOverrides)
- `Slider` - Range input for budget and cook time settings
- `PasswordField` - Secure input with show/hide toggle
- `ResponsiveGrid` - Adaptive grid layout (1/2/3/4 columns based on breakpoints)
- `IconButton` - Accessible icon-only buttons
- `Avatar` - User profile pictures with initials fallback
- `Stack` - Flexible layout primitive with gap control
- `Typography` - Semantic text hierarchy (h1-h6, body, small, label)
- `Button` - Primary, secondary, and naked variants
- `TextField` - Text input with label and helper text
- `Dropdown` - Select input with label
- `Checkbox` - Boolean input
- `Box` - Layout primitive with spacing and borders

### Design Tokens
Full access to design tokens for spacing, colors, typography, and breakpoints.

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

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Design System**: [@common-origin/design-system v1.14.0](https://www.npmjs.com/package/@common-origin/design-system)
- **AI**: Google Gemini 2.0 Flash Experimental (recipe generation, image recognition, URL extraction)
- **Package Manager**: PNPM 10.19.0
- **Deployment**: Vercel
- **Analytics**: Privacy-first local tracking

## Architecture

### Component Pattern
- **Shared Components**: Reusable MealCard component with customizable props for different contexts
- **Sheet Components**: Consistent drawer UX using design system Sheet component
- **Responsive Grid**: Mobile-first 1→2→3→4 column layout
- **Context-Aware Navigation**: Browser history-based navigation for proper back button behavior

### State Management
- **Local Storage**: Recipe library, family settings, week plans, pantry items, recipe history
- **URL State**: Recipe detail pages
- **React State**: UI interactions, form inputs, drawer visibility

### AI Integration
- **Recipe Generation**: Gemini generates personalized recipes based on family settings
- **Image Recognition**: Detects ingredients from pantry/fridge photos  
- **URL Extraction**: Scrapes and parses recipes from external websites
- **Context Awareness**: Excludes recently used recipes, respects pantry items, follows dietary preferences

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