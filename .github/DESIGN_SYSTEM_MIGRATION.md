# Design System Component Migration Tracker

## Current Status
- **Design System Version**: 1.12.0 (upgraded from 1.11.1)
- **Last Updated**: 4 November 2025

## Components Replaced ✅

### Phase 1: Checkboxes (Completed)
- ✅ Prefer gluten-free options (Dietary Requirements)
- ✅ Focus on high protein meals (Dietary Requirements)
- ✅ Leftover-friendly meals (Dietary Requirements)
- ✅ Enable batch cooking (Batch Cooking)
- ✅ Enable GitHub sync (GitHub Recipe Sync)
- ✅ Auto-sync when recipes change (GitHub Recipe Sync)

**Total**: 6 checkboxes replaced

### Phase 2: Text Inputs (Completed)
- ✅ Preferred Chef (TextField - Cuisine Preferences)
- ✅ GitHub Username (TextField - GitHub Settings)
- ✅ GitHub Repository Name (TextField - GitHub Settings)

**Total**: 3 text inputs replaced with TextField

### Phase 3: Number Inputs (Completed)
- ✅ Adults count (NumberInput - Household section)
- ✅ Children ages (NumberInput - Household section, multiple instances)

**Total**: 2+ number inputs replaced with NumberInput component

## Components Pending Replacement 🔄

### Range/Slider Inputs (Blocked - Component Not Available)
- ⏸️ Budget per meal - min slider (Budget & Time)
- ⏸️ Budget per meal - max slider (Budget & Time)
- ⏸️ Max cooking time - weeknight slider (Budget & Time)
- ⏸️ Max cooking time - weekend slider (Budget & Time)

**Total**: 4 range inputs (need Slider/RangeSlider component)

### Password Inputs (Blocked - Not Supported by TextField)
- ⏸️ GitHub Personal Access Token (password type not supported by TextField)

**Total**: 1 password input (TextField doesn't support type="password")

### Inline Styles Remaining (~17 instances)
- Main layout padding
- Cuisine grid layout
- Various margin/padding divs
- Link color styling
- TextField width constraints

## Future Tasks (To Complete Later)

### Design System Components Still Needed
- [ ] **Slider/RangeSlider** - For budget and time range controls (4 instances)
- [ ] **PasswordInput** - For secure password entry (1 instance)
- [ ] **Grid** - For responsive cuisine selection layout
- [ ] **Link** - For styled links with proper variants

### Cleanup Tasks
- [ ] Replace remaining ~17 inline styles with design system props/components
- [ ] Convert `<div style={{...}}>` wrappers to Stack/Box components
- [ ] Replace main layout padding with Container/PageLayout props
- [ ] Standardize spacing using design system tokens

## Components Not Yet in Design System

### High Priority
- [ ] **NumberInput** - For number inputs with min/max validation (NOW AVAILABLE - v1.12.0+)
- [ ] **Slider/RangeSlider** - For budget and time range controls
- [ ] **PasswordInput** - For secure password entry

### Medium Priority
- [ ] **IconButton** - For action buttons with icons only
- [ ] **Badge** - For status indicators
- [ ] **Grid** - For responsive layouts
- [ ] **NavLink** - For navigation items

### Lower Priority
- [ ] **Drawer** - For side panels (meal swap drawer)
- [ ] **Card** enhancements - More variants for recipe cards
- [ ] **Toast/Notification** - For success/error messages
- [ ] **Modal/Dialog** - For confirmations

## Inline Styles Still Present

### Settings Page (`apps/web/src/app/settings/page.tsx`)
- Number input styling (width, padding, border, etc.) - ~2 instances
- Range slider styling (flex, width) - ~4 instances
- Password input styling (monospace font, padding) - 1 instance
- Misc wrapper divs with marginBottom - ~10 instances
- Link styling (color) - 1 instance

**Estimated**: ~18 inline style instances remaining in settings page

### Other Pages
- MealCard component - Custom styled components
- Recipe pages - Various inline styles
- Shopping list - Form styling

**Estimated**: ~100+ inline styles across other pages

## Migration Notes

### Completed Upgrades
1. **v1.9.9 → v1.11.1**: Added Checkbox and TextField components
   - Fixed Box component API breaking changes (borderRadius, bg, border props)
   - Successfully replaced all checkbox instances
   - Replaced text inputs where type is supported

### Next Steps
1. Upgrade to latest version for NumberInput component
2. Replace Adults and Children age inputs with NumberInput
3. Track availability of Slider/RangeSlider for budget/time controls
4. Consider custom PasswordInput wrapper if TextField won't support it

## Performance Impact
- **Lines Reduced**: ~120 lines (checkbox + text input replacements)
- **Inline Styles Removed**: ~15 instances
- **Consistency Improved**: All form controls now use design system where available
