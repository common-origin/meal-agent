# Documentation Index

**Last Updated**: October 27, 2025  
**Project**: Meal Agent - Intelligent Meal Planning System

This folder contains comprehensive documentation for the Meal Agent project. Start here to understand the system, APIs, and implementation details.

---

## 📚 Documentation Overview

### **For New Developers** 👋

Start with these documents in order:

1. **[QUICK_START.md](./QUICK_START.md)** ⚡ (10 min read)
   - Get up and running in 2 minutes
   - Common tasks and examples
   - Development commands
   - **Start here!**

2. **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** 📊 (5 min read)
   - Current project status (Phase 1 complete!)
   - System capabilities overview
   - Key files and metrics
   - Next steps roadmap

3. **[ARCHITECTURE.md](./ARCHITECTURE.md)** 🏗️ (15 min read)
   - High-level system design
   - Data flow diagrams
   - Component architecture
   - Technology stack

---

### **For Implementation Details** 🔧

Deep dives into Phase 1 work:

4. **[PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)** 📝 (30 min read)
   - All 10 work orders explained
   - Implementation patterns
   - Code examples
   - Lessons learned
   - **Most comprehensive guide**

5. **[API_REFERENCE.md](./API_REFERENCE.md)** 📖 (20 min read)
   - Complete API documentation
   - Function signatures
   - Parameters and return types
   - Usage examples
   - **Essential for coding**

---

### **For Project Management** 📋

6. **[WORK_ORDERS_AGENT_V1 — Phase 1.md](./WORK_ORDERS_AGENT_V1%20—%20Phase%201%20(Agent%20logic,%20library%20search,%20plan%20review,%20Coles%20mapping%20v0).md)** 📋
   - Original work order specifications
   - Acceptance criteria
   - Planning document

---

### **For Build & Development** 🛠️

7. **[DEVELOPMENT.md](./DEVELOPMENT.md)** 🛠️
   - Setup instructions
   - Development workflow
   - Build commands
   - Troubleshooting

---

### **Historical/Planning Documents** 📜

These are older planning docs (pre-Phase 1):

- **[COPILOT_BUILD.md](./COPILOT_BUILD.md)** - Original build planning
- **[PROJECT_INSTRUCTIONS.md](./PROJECT_INSTRUCTIONS.md)** - Project guidelines
- **[INDEXER_ENHANCEMENT_PLAN.md](./INDEXER_ENHANCEMENT_PLAN.md)** - Recipe indexer planning

---

## 🎯 Quick Navigation by Role

### I'm a **Frontend Developer**
1. Read [QUICK_START.md](./QUICK_START.md)
2. Check [API_REFERENCE.md](./API_REFERENCE.md) for UI component APIs
3. Look at [ARCHITECTURE.md](./ARCHITECTURE.md) - Component Architecture section

### I'm a **Backend/Logic Developer**
1. Read [QUICK_START.md](./QUICK_START.md)
2. Study [API_REFERENCE.md](./API_REFERENCE.md) - Core Libraries section
3. Deep dive [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Work Orders 2-3

### I'm a **Product Manager**
1. Read [PROJECT_STATUS.md](./PROJECT_STATUS.md)
2. Review [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Overview section
3. Check metrics and capabilities

### I'm a **Designer/UX**
1. Read [QUICK_START.md](./QUICK_START.md)
2. Check [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Work Orders 4-5, 10
3. Review accessibility compliance in [ARCHITECTURE.md](./ARCHITECTURE.md)

### I'm an **AI/LLM Engineer**
1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Extensibility section
2. Study [API_REFERENCE.md](./API_REFERENCE.md) - Scoring System
3. Check [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - Future Enhancements

---

## 📊 Phase 1 Summary

### ✅ What's Complete (All 10 Work Orders)

| Work Order | Description | Status |
|------------|-------------|--------|
| WO1 | Tag Normalization | ✅ Complete |
| WO2 | Scoring Pipeline (10+ rules) | ✅ Complete |
| WO3 | Composer with Leftovers | ✅ Complete |
| WO4 | Explainability Layer | ✅ Complete |
| WO5 | Plan Review Page | ✅ Complete |
| WO6 | Shopping List Aggregation | ✅ Complete |
| WO7 | Coles Product Mapping (30+ SKUs) | ✅ Complete |
| WO8 | Favorites & Repetition Tracking | ✅ Complete |
| WO9 | Analytics Extension | ✅ Complete |
| WO10 | A11y & Mobile Parity (WCAG 2.1 AA) | ✅ Complete |

**Total Lines of Code**: ~3,000 (Phase 1)  
**Recipes Indexed**: 50+ from RecipeTin Eats  
**Coles Mappings**: 30+ ingredients  
**Analytics Events**: 11 types tracked  
**Components**: 10+ React components

---

## 🎯 System Capabilities

### Intelligent Meal Selection
- **Scoring Engine**: 10+ rules evaluating freshness, variety, timing, family fit
- **Variety Enforcement**: Protein rotation, cuisine diversity, cooking method balance
- **Recency Tracking**: 3-week rolling window prevents repetition
- **Bulk Cook Support**: Automatic leftover detection and scheduling

### Explainability
- **Reason Chips**: Human-readable explanations for every meal choice
- **Transparency**: Clear communication of why meals were selected
- **Visual Indicators**: Color-coded chips (positive, neutral, warning)

### Cost Intelligence
- **Coles Integration**: 30+ ingredient SKU mappings
- **Price Estimation**: Confidence-based pricing (high/medium/low)
- **Pack Optimization**: Multi-pack calculations, waste estimation
- **Shopping Insights**: Ingredient reuse tracking, cost per meal

### Privacy-First Analytics
- **Local Storage**: No server-side tracking
- **11 Event Types**: Comprehensive user action tracking
- **5 Metrics**: Plan composition, cost, engagement, regeneration
- **Dashboard**: Visual insights into planning patterns

### Accessibility
- **WCAG 2.1 AA**: Full compliance
- **Keyboard Navigation**: Complete keyboard-only support
- **Screen Readers**: ARIA labels, semantic HTML
- **Mobile Touch**: 44px minimum touch targets

---

## 🚀 Getting Started

### 1. Clone & Install (2 minutes)
```bash
git clone <repo-url>
cd meal-agent
pnpm install
```

### 2. Read Docs (15 minutes)
- [QUICK_START.md](./QUICK_START.md) - Essential
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - Overview

### 3. Start Development (1 minute)
```bash
pnpm dev
# Open http://localhost:3000
```

### 4. Explore Code
- Check `apps/web/src/lib/` for core logic
- Review `apps/web/src/app/plan/review/page.tsx` for full-stack example
- See `apps/web/src/components/app/` for UI components

---

## 📖 Document Relationships

```
QUICK_START.md ─────┐
                    │
PROJECT_STATUS.md ──┼──▶ High-level understanding
                    │
ARCHITECTURE.md ────┘

         │
         │ Deep dive
         ▼

PHASE_1_IMPLEMENTATION.md ─────▶ Detailed implementation guide
         │
         │ Reference
         ▼
API_REFERENCE.md ──────────────▶ Function-level documentation

         │
         │ Historical context
         ▼
WORK_ORDERS_AGENT_V1.md ───────▶ Original specifications
```

---

## 🔍 Finding Information

### "How do I...?"

| Task | Document | Section |
|------|----------|---------|
| Generate a meal plan | [API_REFERENCE.md](./API_REFERENCE.md) | Composition Engine |
| Search recipes | [API_REFERENCE.md](./API_REFERENCE.md) | Recipe Library |
| Create shopping list | [API_REFERENCE.md](./API_REFERENCE.md) | Shopping List |
| Track analytics | [API_REFERENCE.md](./API_REFERENCE.md) | Analytics |
| Understand scoring | [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) | Work Order 2 |
| Add Coles product | [QUICK_START.md](./QUICK_START.md) | Making Changes |
| Debug issues | [QUICK_START.md](./QUICK_START.md) | Debugging Tips |

### "What is...?"

| Concept | Document | Section |
|---------|----------|---------|
| Meal planning flow | [ARCHITECTURE.md](./ARCHITECTURE.md) | Data Flow |
| Scoring system | [ARCHITECTURE.md](./ARCHITECTURE.md) | System Components |
| Explainability | [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) | Work Order 4 |
| Shopping aggregation | [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) | Work Order 6 |
| Accessibility features | [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) | Work Order 10 |

---

## 🛠️ Development Workflow

1. **Read** [QUICK_START.md](./QUICK_START.md) for setup
2. **Understand** [ARCHITECTURE.md](./ARCHITECTURE.md) for design
3. **Reference** [API_REFERENCE.md](./API_REFERENCE.md) while coding
4. **Learn** [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) for patterns
5. **Build** your feature following established patterns

---

## 📝 Contributing Documentation

When adding new features:

1. **Update [API_REFERENCE.md](./API_REFERENCE.md)**
   - Add function signatures
   - Include usage examples

2. **Update [ARCHITECTURE.md](./ARCHITECTURE.md)**
   - Add to data flow diagrams
   - Document new components

3. **Update [PROJECT_STATUS.md](./PROJECT_STATUS.md)**
   - Add to capabilities list
   - Update metrics

4. **Document in code**
   - Add JSDoc comments
   - Include usage examples

---

## 🎓 Learning Path

### Day 1: Orientation
- [ ] Read [QUICK_START.md](./QUICK_START.md)
- [ ] Read [PROJECT_STATUS.md](./PROJECT_STATUS.md)
- [ ] Run `pnpm dev` and explore app
- [ ] Generate a meal plan
- [ ] View shopping list

### Day 2: Core Concepts
- [ ] Read [ARCHITECTURE.md](./ARCHITECTURE.md) - Data Flow section
- [ ] Read [API_REFERENCE.md](./API_REFERENCE.md) - Composition Engine
- [ ] Study `apps/web/src/lib/compose.ts`
- [ ] Study `apps/web/src/lib/scoring.ts`

### Day 3: Implementation Details
- [ ] Read [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) - WO2-3
- [ ] Understand scoring rules
- [ ] Understand variety enforcement
- [ ] Try modifying scoring weights

### Week 2: Deep Dive
- [ ] Read all of [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md)
- [ ] Study all library files in `apps/web/src/lib/`
- [ ] Understand shopping list aggregation
- [ ] Understand Coles mapping
- [ ] Review analytics implementation

### Week 3: Mastery
- [ ] Build a new feature
- [ ] Add a new scoring rule
- [ ] Map more Coles products
- [ ] Improve accessibility
- [ ] Write documentation

---

## 🔗 External Resources

- **Next.js Docs**: https://nextjs.org/docs
- **React 19 Docs**: https://react.dev
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **WCAG 2.1 AA**: https://www.w3.org/WAI/WCAG21/quickref/
- **Schema.org Recipe**: https://schema.org/Recipe

---

## 📞 Need Help?

1. **Search this documentation** - Most answers are here
2. **Check code comments** - All libraries have JSDoc
3. **Review examples** - Pages show real-world usage
4. **Ask the team** - We're here to help!

---

**Last Updated**: October 27, 2025  
**Status**: Phase 1 Complete ✅  
**Next**: User testing, feedback, Phase 2 planning 🚀
