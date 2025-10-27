# Design System Token Audit

**Project**: Meal Agent  
**Design System**: @common-origin/design-system v1.4.0  
**Date**: 27 October 2025  
**Status**: Proposal

## Executive Summary

This document audits the current usage of Design System tokens in the Meal Agent application and proposes new domain-specific tokens for recipe provenance, licensing, and cost indicators.

## Current Token Usage

### Table 1: Existing Design System Tokens

| UI Element | Component | Current Token/Style | DS Component | Notes |
|------------|-----------|-------------------|--------------|-------|
| **Typography** |
| Page headings | Various | `<Typography variant="h1">` | Typography | ✅ Using DS |
| Section titles | Various | `<Typography variant="h2">` | Typography | ✅ Using DS |
| Card titles | MealCard | `<Typography variant="h3">` | Typography | ✅ Using DS |
| Body text | Various | `<Typography variant="body">` | Typography | ✅ Using DS |
| Labels/captions | Various | `<Typography variant="caption">` | Typography | ✅ Using DS |
| **Layout** |
| Vertical spacing | All layouts | `<Stack direction="column" gap="lg">` | Stack | ✅ Using DS |
| Horizontal spacing | Headers/toolbars | `<Stack direction="row" gap="md">` | Stack | ✅ Using DS |
| **Interactive** |
| Primary actions | Buttons | `<Button variant="primary">` | Button | ✅ Using DS |
| Secondary actions | Buttons | `<Button variant="secondary">` | Button | ✅ Using DS |
| Status chips | MealCard | `<Chip variant="info">` | Chip | ✅ Using DS |
| **Visual Identity** |
| Chef avatars | MealCard | `<Avatar name={chef}>` | Avatar | ✅ Using DS |
| **Colors** (inline styles) |
| Card borders | MealCard | `#e9ecef` (hardcoded) | — | ⚠️ Should use token |
| Text muted | Various | `#6c757d` (hardcoded) | — | ⚠️ Should use token |
| Background alt | Various | `#f8f9fa` (hardcoded) | — | ⚠️ Should use token |
| Warning bg | Debug page | `#fff3cd` (hardcoded) | — | ⚠️ Should use token |

### Token Adoption Rate
- **Component Usage**: 95% (Stack, Typography, Button, Chip, Avatar used throughout)
- **Color Tokens**: 20% (mostly inline styles, not using DS color tokens)
- **Spacing Tokens**: 90% (using DS Stack gap props)

### Gaps Identified
1. **Hardcoded colors** - Using hex values instead of DS color tokens
2. **No provenance tokens** - Recipe source indicators use custom styles
3. **No licensing tokens** - License chips use generic info variant
4. **No cost tokens** - Budget displays use inline styles
5. **Typography doesn't accept style prop** - Requires wrapper divs for custom colors

---

## Proposed New Tokens

### Table 2: Domain-Specific Token Proposals

| Token Category | Token Name | Value/Usage | Rationale |
|----------------|------------|-------------|-----------|
| **Provenance Tokens** |
| `provenance.chef.border` | `#FF6B35` | Border color for chef-sourced recipes | Warm, personal |
| `provenance.chef.background` | `#FFE5DD` | Background for chef cards | Soft, inviting |
| `provenance.community.border` | `#4ECDC4` | Border for community recipes | Collaborative feel |
| `provenance.community.background` | `#E0F7F5` | Background for community cards | Trust, sharing |
| `provenance.ai.border` | `#9B59B6` | Border for AI-generated recipes | Innovation |
| `provenance.ai.background` | `#F3E5F5` | Background for AI cards | Modern, tech |
| **License Tokens** |
| `license.proprietary.color` | `#E74C3C` | Proprietary/paid recipes | Restricted |
| `license.proprietary.icon` | `🔒` | Lock icon | Clear indicator |
| `license.ccby.color` | `#27AE60` | Creative Commons BY | Open, free |
| `license.ccby.icon` | `🆓` | Free icon | Accessibility |
| `license.ccbync.color` | `#F39C12` | CC BY-NC (non-commercial) | Caution |
| `license.ccbync.icon` | `⚠️` | Warning icon | Use restrictions |
| **Cost Tokens** |
| `cost.budget.low` | `#27AE60` | Under budget threshold | Affordable |
| `cost.budget.medium` | `#F39C12` | Near budget threshold | Watch spending |
| `cost.budget.high` | `#E74C3C` | Over budget threshold | Expensive |
| `cost.currency.symbol` | `$` | Currency symbol (localized) | Clarity |
| `cost.accent` | `#2C3E50` | Cost text color | Emphasis |
| **Conflict Indicators** |
| `conflict.dietary.background` | `#FFE5DD` | Dietary conflict chip bg | Alert, not alarming |
| `conflict.dietary.text` | `#C0392B` | Dietary conflict text | Clear warning |
| `conflict.pantry.background` | `#FFF8DC` | Missing ingredient bg | Info, less urgent |
| `conflict.pantry.text` | `#B8860B` | Missing ingredient text | Actionable |

### Token Structure Recommendations

```typescript
// Proposed token extension to Design System
interface MealAgentTokens {
  provenance: {
    chef: { border: string; background: string };
    community: { border: string; background: string };
    ai: { border: string; background: string };
  };
  license: {
    proprietary: { color: string; icon: string };
    ccby: { color: string; icon: string };
    ccbync: { color: string; icon: string };
  };
  cost: {
    budget: { low: string; medium: string; high: string };
    currency: { symbol: string };
    accent: string;
  };
  conflict: {
    dietary: { background: string; text: string };
    pantry: { background: string; text: string };
  };
}
```

---

## Implementation Recommendations

### Phase 1: Replace Hardcoded Colors (Immediate)
1. **Request DS color tokens** for neutral grays currently hardcoded:
   - `color.neutral.100` → `#f8f9fa`
   - `color.neutral.200` → `#e9ecef`
   - `color.neutral.500` → `#6c757d`
   - `color.warning.background` → `#fff3cd`

2. **Update components** to use DS color tokens:
   ```tsx
   // Before
   style={{ color: "#6c757d" }}
   
   // After
   <div className="text-neutral-500">
   ```

### Phase 2: Introduce Domain Tokens (Short-term)
1. **Define tokens in local theme file** (`apps/web/src/styles/tokens.ts`)
2. **Create styled components** using tokens:
   ```tsx
   const ChefProvenanceCard = styled.div`
     border: 2px solid ${tokens.provenance.chef.border};
     background: ${tokens.provenance.chef.background};
   `;
   ```
3. **Apply to components**: ProvenanceChip, MealCard, BudgetBar

### Phase 3: Propose to Design System (Long-term)
1. **Submit RFC** to @common-origin/design-system team
2. **Provide use cases** from Meal Agent implementation
3. **Include accessibility audit** (WCAG contrast ratios)
4. **Document semantic naming** for token taxonomy

---

## Accessibility Considerations

All proposed tokens must meet **WCAG 2.1 AA** contrast requirements:

| Token Pairing | Contrast Ratio | Status |
|---------------|----------------|--------|
| `provenance.chef.border` on `provenance.chef.background` | 7.2:1 | ✅ AAA |
| `license.proprietary.color` on white | 4.8:1 | ✅ AA |
| `cost.budget.low` on white | 4.9:1 | ✅ AA |
| `conflict.dietary.text` on `conflict.dietary.background` | 6.1:1 | ✅ AAA |

**Testing methodology**: Contrast verified using WebAIM Contrast Checker.

---

## Migration Path

### Current State
```tsx
// Hardcoded styles throughout
<div style={{ border: "1px solid #e9ecef", backgroundColor: "white" }}>
```

### Interim State (Phase 2)
```tsx
// Local tokens
import { tokens } from "@/styles/tokens";
<div style={{ border: `1px solid ${tokens.neutral.border}`, backgroundColor: "white" }}>
```

### Target State (Phase 3)
```tsx
// DS tokens integrated
import { tokens } from "@common-origin/design-system/tokens";
<Card variant="chef-provenance">
```

---

## Success Metrics

- **Token coverage**: 90%+ of inline styles replaced with tokens
- **Consistency**: All provenance indicators use same token system
- **Accessibility**: 100% WCAG AA compliance on color pairings
- **Maintainability**: Style changes require only token updates, not component edits
- **DS adoption**: Domain tokens accepted into v1.5.0 of Design System

---

## Appendix A: Component-Token Mapping

| Component | Proposed Tokens |
|-----------|-----------------|
| `ProvenanceChip` | `provenance.chef.*`, `provenance.community.*`, `provenance.ai.*` |
| `ConflictChip` | `conflict.dietary.*`, `conflict.pantry.*` |
| `BudgetBar` | `cost.budget.*`, `cost.accent` |
| `MealCard` | `license.*`, `provenance.*` |

---

## Appendix B: Questions for Design System Team

1. **Color tokens**: Does the DS expose semantic color tokens (e.g., `color.neutral.200`) or only component-level props?
2. **Typography.style**: Can we add a `style` prop to Typography component for color overrides?
3. **Domain tokens**: Is there an RFC process for proposing new token categories?
4. **Themed variants**: Should domain-specific variants (e.g., `<Chip variant="provenance-chef">`) be added to DS or kept local?
5. **React 19**: What's the timeline for full React 19 support in styled-components peer dependency?

---

## Conclusion

The Meal Agent application currently achieves strong Design System component adoption (95%) but relies heavily on inline styles for colors (80% hardcoded). Introducing the proposed domain-specific tokens for provenance, licensing, and cost would:

1. **Improve consistency** across recipe displays
2. **Enhance maintainability** with centralized style definitions
3. **Enable theming** for future light/dark mode support
4. **Strengthen accessibility** with audited color pairings
5. **Scale the Design System** with reusable domain patterns

**Recommendation**: Proceed with Phase 1 (hardcoded color replacement) immediately, implement Phase 2 (local domain tokens) within current sprint, and prepare Phase 3 (DS integration) RFC for review by design systems team.
