# Documentation Cleanup Plan

**Created**: 6 November 2025  
**Purpose**: Identify outdated documentation and plan updates to reflect current project state

---

## 🎯 Current Project State (6 Nov 2025)

### Phase Status
- ✅ **Phase 1**: COMPLETE - Real recipes, scoring, explainability, Coles mapping
- ✅ **Phase 2**: COMPLETE - AI recipe generation, pantry scanning, URL extraction, weekly wizard
- ✅ **Design System**: v1.14.0 fully integrated with 15+ components

### Recent Work Completed
- Design system upgraded from 1.12.0 → 1.14.0
- Migrated 4 Sheet components (PantrySheet, RegenerateDrawer, WeeklyOverridesSheet, SwapDrawer)
- Migrated 5 Slider components (Settings page budget/time controls)
- Migrated 1 PasswordField (GitHub token)
- Refactored MealCard with 5 customization props
- Refactored SwapDrawer (~40 lines removed)
- Refactored Review page (ResponsiveGrid + MealCard)
- Fixed recipe page navigation (router.back())
- **Code Reduction**: ~280 lines through component reuse
- **Commits**: 8d1ca4b (main work) + ba43d87 (README updates)

### AI Features Implemented
- ✅ Gemini API integration (gemini-2.0-flash-exp model)
- ✅ AI recipe generation from family settings
- ✅ Pantry scanning via image upload (`/api/extract-recipe-from-image`)
- ✅ URL recipe extraction (`/api/extract-recipe-from-url`)
- ✅ Weekly planning wizard with AI generation
- ✅ Smart swap suggestions with AI-generated alternatives

---

## 📋 Documentation Status & Action Items

### 🔴 CRITICAL - Needs Immediate Update

#### 1. DESIGN_SYSTEM_MIGRATION.md
**Status**: Severely outdated  
**Last Updated**: 4 November 2025  
**Issues**:
- Says v1.12.0 (actual: v1.14.0)
- Lists Slider as "blocked" (actually: 5 instances migrated ✅)
- Lists PasswordField as "blocked" (actually: 1 instance migrated ✅)
- Missing Sheet component migration (4 instances ✅)
- Missing MealCard refactoring ✅
- Missing ResponsiveGrid migration ✅

**Action Required**:
- [ ] Update version to 1.14.0
- [ ] Move Slider/PasswordField from "Blocked" to "Completed"
- [ ] Add Sheet component migration section (4 instances)
- [ ] Add MealCard refactoring section
- [ ] Add ResponsiveGrid migration section
- [ ] Update final metrics: ~280 lines removed total
- [ ] Mark all Phase 1 migrations as COMPLETE

---

#### 2. PROJECT_STATUS.md
**Status**: Outdated  
**Last Updated**: 2 November 2025  
**Issues**:
- Says "Phase 1 Complete" (missing Phase 2 completion)
- Missing AI features entirely
- Missing design system v1.14.0 upgrade
- Missing pantry scanning, URL extraction, wizard

**Action Required**:
- [ ] Update status to "Phase 1 & 2 Complete"
- [ ] Add AI Integration section
  - Gemini API (gemini-2.0-flash-exp)
  - Recipe generation
  - Pantry scanning (image upload)
  - URL extraction
  - Weekly wizard
- [ ] Add Design System v1.14.0 section
  - Sheet components
  - Slider components
  - PasswordField
  - ResponsiveGrid
  - Code reduction metrics
- [ ] Update "Current State" section with AI capabilities

---

#### 3. ARCHITECTURE.md
**Status**: Outdated  
**Last Updated**: 27 October 2025  
**Issues**:
- Says "Phase 1 Complete" (missing Phase 2)
- No mention of AI integration
- Missing Gemini API architecture
- Missing new API routes

**Action Required**:
- [ ] Update to "Phase 1 & 2 Complete"
- [ ] Add AI Layer to architecture diagram
  - `/api/generate-recipes` - Gemini recipe generation
  - `/api/extract-recipe-from-image` - Pantry scanning
  - `/api/extract-recipe-from-url` - URL extraction
  - `/api/list-models` - Model testing
- [ ] Add data flow for AI recipe generation
- [ ] Add PantrySheet component to UI layer
- [ ] Update dependencies section (add @google/generative-ai)

---

### 🟡 MEDIUM - Should Update Soon

#### 4. PROJECT_INSTRUCTIONS.md
**Status**: Component list outdated  
**Issues**:
- Only lists 3 components (Avatar, Stack, Typography)
- Missing 12+ new components from v1.14.0
- Doesn't reflect actual component usage

**Action Required**:
- [ ] Update component list to include all v1.14.0 components:
  - Sheet, Slider, PasswordField, ResponsiveGrid, IconButton
  - Button, TextField, Dropdown, Checkbox, Container, Box
  - Chip, Divider, NumberInput
- [ ] Add AI-specific instructions
- [ ] Update success criteria to include AI features

---

#### 5. COPILOT_BUILD.md
**Status**: References outdated setup  
**Issues**:
- Treats design system as placeholder/local package
- We're using published NPM package
- Component list incomplete

**Action Required**:
- [ ] Update to reference @common-origin/design-system@1.14.0
- [ ] Remove placeholder package instructions
- [ ] Update component list with all available components
- [ ] Add AI integration setup steps (Gemini API key)

---

### 🟢 LOW - Optional Updates

#### 6. API_REFERENCE.md
**Status**: Missing new APIs  
**Action Required**:
- [ ] Add AI API routes section
  - `/api/generate-recipes` - POST - Generate recipes from settings
  - `/api/extract-recipe-from-image` - POST - Extract from image
  - `/api/extract-recipe-from-url` - POST - Extract from URL
  - `/api/list-models` - GET - Test Gemini models
- [ ] Document request/response schemas
- [ ] Add error handling examples

---

### ✅ COMPLETE & UP-TO-DATE

#### 7. README.md
**Status**: ✅ Up to date  
**Last Updated**: 6 November 2025 (commit ba43d87)
**Includes**:
- All 10 current features (AI generation, pantry scanning, etc.)
- Design system v1.14.0 with 15+ components
- Correct tech stack (Next.js 16, Gemini 2.0)
- Accurate architecture description

---

### 🗑️ ARCHIVE/COMPLETE

#### 8. WO11_FAMILY_SETTINGS.md
**Status**: COMPLETE but marked "Ready to Start"  
**Action Required**:
- [ ] Move to `/workorders/completed/` folder
- [ ] Update status header to "✅ COMPLETE"
- [ ] Add completion date: 6 November 2025
- [ ] Add implementation notes

#### 9. PHASE_2_AI_PLAN.md
**Status**: COMPLETE  
**Action Required**:
- [ ] Move to `/archive/` folder (planning doc, no longer needed)
- [ ] Add "✅ IMPLEMENTED" header
- [ ] Reference actual implementation in commit 8d1ca4b

---

## 🚀 Recommended Action Plan

### Priority 1 (Do Now)
1. Update DESIGN_SYSTEM_MIGRATION.md with v1.14.0 completion
2. Update PROJECT_STATUS.md to Phase 2 complete
3. Mark WO11_FAMILY_SETTINGS.md as complete

### Priority 2 (This Week)
4. Update ARCHITECTURE.md with AI integration
5. Update PROJECT_INSTRUCTIONS.md with full component list
6. Archive PHASE_2_AI_PLAN.md

### Priority 3 (When Time Permits)
7. Update API_REFERENCE.md with AI routes
8. Update COPILOT_BUILD.md with current setup

---

## 📊 File Organization Suggestions

### Create New Folders
```
.github/
├── workorders/
│   ├── completed/          # ← Move WO11 here
│   │   └── WO11_FAMILY_SETTINGS.md
│   └── active/             # Future work orders
├── archive/                # ← Move outdated planning docs
│   └── PHASE_2_AI_PLAN.md
└── [current docs]
```

### Benefits
- ✅ Clear separation of active vs completed work
- ✅ Preserves history without cluttering context
- ✅ Makes it obvious what's current vs archive

---

## 🎯 Success Metrics

**When documentation cleanup is complete:**
- [ ] All docs reflect Phase 2 completion
- [ ] All docs reference design system v1.14.0
- [ ] All AI features documented
- [ ] Completed work orders moved to archive
- [ ] No contradictory status statements
- [ ] Last updated dates are current

---

## Notes

**Why This Matters**:
- Prevents confusion about project state
- Ensures accurate Copilot context
- Helps future developers understand what's implemented
- Preserves institutional knowledge
- Makes it clear what work remains vs what's done

**Estimated Effort**: 1-2 hours to complete all priority 1 & 2 updates
