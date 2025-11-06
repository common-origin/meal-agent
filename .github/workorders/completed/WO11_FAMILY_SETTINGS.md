# Work Order 11: Family Settings & Preferences Management

**Status**: ✅ **COMPLETE**  
**Completed**: 6 November 2025  
**Estimated Effort**: 2-3 days  
**Actual Effort**: 2 days
**Priority**: High (Foundation for AI generation)  
**Phase**: 2A - AI Integration

---

## ✅ COMPLETION SUMMARY

All requirements have been successfully implemented and deployed to production.

### Implementation Details
- **Settings Page**: `/settings` fully functional with all requested features
- **Family Profile**: Household size, cuisine preferences (15+ options), dietary requirements
- **Budget & Time**: Range sliders for budget ($10-$30) and cooking time (weeknights/weekends)
- **Batch Cooking**: Frequency and day selection with toggles
- **Pantry Priority**: Hard/soft preference for pantry ingredient usage
- **GitHub Sync**: Full integration with recipe backup/sync functionality
- **Design System**: All components use v1.14.0 (Slider, PasswordField, Checkbox, TextField, etc.)

### Files Created/Modified
- ✅ `apps/web/src/app/settings/page.tsx` - Main settings page (fully implemented)
- ✅ `apps/web/src/lib/storage.ts` - Updated with family settings storage functions
- ✅ `apps/web/src/lib/types/settings.ts` - TypeScript interfaces and validation

### Features Delivered
- [x] Settings page accessible at `/settings`
- [x] All form inputs render correctly with default values
- [x] Form validation prevents invalid inputs
- [x] Settings save to localStorage on submit
- [x] Settings persist across page refreshes
- [x] Reset button restores default values
- [x] Visual feedback on successful save
- [x] Responsive design (mobile-friendly)
- [x] Settings link in main navigation
- [x] TypeScript types properly defined
- [x] No console errors
- [x] AI integration ready (settings used by `/api/generate-recipes`)

---

## 🎯 Objective

Create a settings page where family preferences are configured and stored locally. These settings will be used by the AI to generate personalized weekly meal plans.

---

## 📋 Requirements

### **Family Profile Settings**

**Household Information:**
- Number of adults: 2
- Number of kids: 2 (ages 5 & 7)
- Total servings: 4

**Cuisine Preferences (Multi-select):**
- Mexican ✅
- Australian ✅
- Italian ✅
- Indian ✅
- Asian ✅
- Mediterranean
- Middle Eastern
- Thai
- Vietnamese
- Japanese
- Greek
- Spanish
- American/BBQ
- Other (free text)

**Dietary Requirements:**
- Gluten-free preference: Toggle (prefer when possible, not strict)
- Protein focus: Toggle (ensure adequate protein for family)
- Allergies/Restrictions: Text input (free form)
- Foods to avoid: Text input (free form)
- Favorite ingredients: Text input (free form)

**Budget & Time Constraints:**
- Budget per meal: Slider ($10-$30, default $15-20)
- Max cooking time weeknights: Slider (15-60 min, default 30 min)
- Max cooking time weekends: Slider (15-90 min, default 45 min)

**Meal Planning Preferences:**
- Batch cooking frequency: Dropdown (None, Weekly, Bi-weekly)
- Batch cooking day: Dropdown (Sunday, Saturday, Friday)
- Variety level: Slider (Conservative → Adventurous)
- Leftover-friendly: Toggle (meals that reheat well)

---

## 🛠️ Technical Implementation

### **Files to Create**

1. **`apps/web/src/app/settings/page.tsx`**
   - Main settings page component
   - Form with all preference inputs
   - Save/Reset buttons
   - Visual feedback on save

2. **`apps/web/src/components/app/SettingsForm.tsx`**
   - Reusable form component
   - Form validation
   - Default values

3. **`apps/web/src/lib/types/settings.ts`**
   - TypeScript interfaces for settings
   - Validation schemas

### **Files to Update**

4. **`apps/web/src/lib/storage.ts`**
   - Add `saveFamilySettings(settings: FamilySettings): void`
   - Add `loadFamilySettings(): FamilySettings | null`
   - Add `getDefaultFamilySettings(): FamilySettings`

5. **Navigation (add settings link)**
   - Update main nav to include settings page

---

## 📐 Data Structure

```typescript
interface FamilySettings {
  // Household
  adults: number;
  children: Array<{ age: number }>;
  totalServings: number;
  
  // Cuisine preferences
  cuisines: string[]; // ['mexican', 'italian', 'asian', ...]
  customCuisines?: string[]; // User-added cuisines
  
  // Dietary
  glutenFreePreference: boolean; // Prefer but not strict
  proteinFocus: boolean; // Ensure adequate protein
  allergies: string[]; // Free-form list
  avoidFoods: string[]; // Free-form list
  favoriteIngredients: string[]; // Free-form list
  
  // Budget & Time
  budgetPerMeal: {
    min: number; // $15
    max: number; // $20
  };
  maxCookTime: {
    weeknight: number; // 30 minutes
    weekend: number; // 45 minutes
  };
  
  // Meal Planning
  batchCooking: {
    enabled: boolean;
    frequency: 'weekly' | 'biweekly' | 'none';
    preferredDay: 'sunday' | 'saturday' | 'friday';
  };
  varietyLevel: number; // 1-5, 3 = balanced
  leftoverFriendly: boolean;
  
  // Metadata
  lastUpdated: string; // ISO date
}
```

---

## 🎨 UI Design Requirements

### **Layout**
- Single page with sections
- Each section has a clear heading
- Collapsible sections for better UX
- Sticky save button at bottom

### **Sections**

**1. Household Size**
- Adult count: Number input (1-10)
- Add/remove children with age input
- Auto-calculate total servings

**2. Cuisine Preferences**
- Grid of cuisine checkboxes with icons
- "Select All" / "Clear All" buttons
- Custom cuisine text input
- Show count: "8 cuisines selected"

**3. Dietary Requirements**
- Toggle switches for gluten-free preference & protein focus
- Tag input for allergies (add/remove chips)
- Tag input for foods to avoid
- Tag input for favorite ingredients

**4. Budget & Time**
- Budget: Range slider ($10-$30) with labels
- Weeknight time: Slider (15-60 min)
- Weekend time: Slider (15-90 min)
- Visual indicators ($ and clock icons)

**5. Meal Planning Preferences**
- Batch cooking toggle
- If enabled, show frequency and day dropdowns
- Variety slider (1-5: Conservative → Adventurous)
- Leftover-friendly toggle

### **Actions**
- "Save Settings" button (primary)
- "Reset to Defaults" button (secondary, destructive)
- "Preview AI Prompt" button (shows what will be sent to AI)

---

## ✅ Acceptance Criteria

- [ ] Settings page accessible at `/settings`
- [ ] All form inputs render correctly with default values
- [ ] Form validation prevents invalid inputs (e.g., negative numbers)
- [ ] Settings save to localStorage on submit
- [ ] Settings persist across page refreshes
- [ ] Reset button restores default values
- [ ] Visual feedback on successful save (toast or message)
- [ ] Responsive design (mobile-friendly)
- [ ] Settings link added to main navigation
- [ ] TypeScript types properly defined
- [ ] No console errors

---

## 🧪 Test Cases

### **Unit Tests** (optional but recommended)
1. Default settings match specification
2. Settings save and load from localStorage
3. Form validation works correctly
4. Reset functionality works

### **Manual Tests**
1. Navigate to `/settings`
2. Fill out all fields with your family's preferences:
   - Adults: 2
   - Children: 2 (ages 5 & 7)
   - Cuisines: Mexican, Australian, Italian, Indian, Asian
   - Gluten-free preference: ON
   - Protein focus: ON
   - Budget: $15-20
   - Weeknight time: 30 min
   - Weekend time: 45 min
   - Batch cooking: Weekly on Sunday
3. Click "Save Settings"
4. Refresh page - verify settings persist
5. Click "Reset to Defaults" - verify form resets
6. Test on mobile - verify responsive layout

---

## 📝 Example Default Settings

```typescript
const DEFAULT_SETTINGS: FamilySettings = {
  adults: 2,
  children: [{ age: 5 }, { age: 7 }],
  totalServings: 4,
  
  cuisines: ['mexican', 'australian', 'italian', 'indian', 'asian'],
  customCuisines: [],
  
  glutenFreePreference: true,
  proteinFocus: true,
  allergies: [],
  avoidFoods: [],
  favoriteIngredients: [],
  
  budgetPerMeal: {
    min: 15,
    max: 20,
  },
  maxCookTime: {
    weeknight: 30,
    weekend: 45,
  },
  
  batchCooking: {
    enabled: true,
    frequency: 'weekly',
    preferredDay: 'sunday',
  },
  varietyLevel: 3, // Balanced
  leftoverFriendly: true,
  
  lastUpdated: new Date().toISOString(),
};
```

---

## 🔗 Dependencies

**None** - This is a foundational work order

---

## 📊 Success Metrics

- Settings save/load successfully 100% of the time
- Form is intuitive (user can complete in <5 minutes)
- No errors in browser console
- Settings page loads in <500ms
- Mobile responsive (works on 320px width)

---

## 🚀 Implementation Notes

### **localStorage Key**
- Use `meal-agent:family-settings` as the key
- Store as JSON string
- Include version number for future migrations

### **Form Library**
- Use React hooks (useState) for form state
- No external form library needed (keep it simple)
- Use design system components (Button, Typography, Stack, Box)

### **Validation**
- Adults: 1-10
- Children ages: 0-18
- Budget: $10-50 per meal
- Cook time: 15-120 minutes
- Required fields: adults, totalServings, at least 1 cuisine

### **UX Polish**
- Show loading state while saving
- Success message: "Settings saved successfully!"
- Autosave draft as user types (debounced)
- Warn before reset if changes exist

---

## 📋 Next Work Orders

After WO11 is complete:
- **WO12**: AI Recipe Generator Integration (Gemini API)
- **WO13**: Weekly Plan Generation UI
- **WO14**: Recipe History & Repetition Avoidance

---

## 💡 Implementation Tips

1. **Start with the data structure** - Get the TypeScript types right first
2. **Build the storage layer** - Test save/load before building UI
3. **Build UI incrementally** - One section at a time
4. **Use design system components** - Stay consistent with Phase 1
5. **Test on mobile early** - Don't wait until the end

---

**Ready to start? Should I create the TypeScript types and storage methods first?** 🚀
