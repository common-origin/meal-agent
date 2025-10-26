# Copilot Instructions: React 19 Compatibility Update

## Context
The Common Origin Design System currently supports React 18, but consumers using Next.js 16+ need React 19 support. The Meal Agent project is experiencing `createContext` issues and requires `"use client"` workarounds due to this version mismatch.

## Objective
Update the design system to support both React 18 and React 19, ensuring backward compatibility while enabling modern React features.

---

## Work Order 1: Dependency Updates

**Prompt for Copilot:**
> Update package.json to support React 19 while maintaining React 18 compatibility. Update peer dependencies to accept both versions: "react": "^18.0.0 || ^19.0.0" and "react-dom": "^18.0.0 || ^19.0.0". Also update any dev dependencies to React 19 for testing. Check if there are any other React-related dependencies that need updating.

**Expected Changes:**
- `package.json` peer dependencies updated
- `devDependencies` updated to React 19 for testing
- Any other React ecosystem packages updated

---

## Work Order 2: Context Provider Compatibility

**Prompt for Copilot:**
> Review all React Context usage in the design system components. Ensure createContext calls are compatible with both React 18 and 19. Look for any context providers that might be causing "createContext only works in Client Components" errors. Update context implementations to work properly in both server and client environments with React 19's new server component model.

**Files to focus on:**
- Any `ThemeProvider` or theme-related contexts
- Component contexts for state management
- Look for files with `createContext` calls

**Expected Changes:**
- Context implementations updated for React 19 compatibility
- Proper client/server boundary handling
- Maintained backward compatibility with React 18

---

## Work Order 3: Component Rendering Updates

**Prompt for Copilot:**
> Audit all components for React 19 compatibility issues. Focus on:
1. Components that use hooks or state (should work in both versions)
2. Any components using newer React 18 features that might behave differently in React 19
3. Server component compatibility - ensure components can render server-side when appropriate
4. Update any component patterns that might be incompatible with React 19's new rendering behavior

**Components to prioritize:**
- `Avatar` (confirmed working in consumer project)
- `Stack` (layout primitive - high usage)
- `Typography` (text components - high usage)
- Any context providers or theme components

---

## Work Order 4: TypeScript Updates

**Prompt for Copilot:**
> Update TypeScript definitions for React 19 compatibility. Check if @types/react needs updating and ensure all component prop types are compatible with both React 18 and 19. Look for any React-specific type imports that might need updating.

**Expected Changes:**
- `@types/react` and `@types/react-dom` updated
- Component prop type definitions verified
- Any React-specific type imports updated

---

## Work Order 5: Build and Test Configuration

**Prompt for Copilot:**
> Update build configuration and test setup for React 19. Ensure the build process works with both React versions. Update any test configurations, Storybook setup, or development tools to support React 19. Make sure the package builds correctly and exports work as expected.

**Areas to check:**
- Build scripts and bundling
- Storybook configuration (if used)
- Test setup and configuration
- Any development tooling

---

## Work Order 6: Validation and Testing

**Prompt for Copilot:**
> Create or update tests to verify React 19 compatibility. Test key components like Avatar, Stack, and Typography with both React 18 and 19. Ensure no breaking changes for existing consumers. Create a simple test app or update existing examples to verify compatibility.

**Test scenarios:**
- Component rendering in both React versions
- Context providers working correctly
- No `createContext` errors in server/client environments
- Export integrity (all expected components still exported)

---

## Final Verification Checklist

After completing all work orders, verify:

- [ ] `package.json` supports React 18 and 19
- [ ] All components render without errors
- [ ] No `createContext` warnings in Next.js 16+ apps
- [ ] TypeScript compilation passes
- [ ] Build process completes successfully
- [ ] Key components (Avatar, Stack, Typography) work as expected
- [ ] Backward compatibility maintained
- [ ] Documentation updated with supported React versions

---

## Testing with Meal Agent

Once the design system is updated:

1. **Update Meal Agent dependency:**
   ```bash
   cd meal-agent
   pnpm add @common-origin/design-system@latest
   ```

2. **Remove "use client" workarounds:**
   - Remove from pages that don't need client-side interactivity
   - Keep only for truly interactive components

3. **Test key flows:**
   - Home page renders correctly
   - Plan page shows meal grid
   - Shopping list exports CSV
   - No createContext errors

4. **Verify SSR works:**
   - Build and start production server
   - Ensure pages render server-side when appropriate

---

## Communication

When complete, notify Meal Agent team with:
- New version number
- Migration notes (if any breaking changes)
- Confirmation that React 19 is fully supported
- Any updated usage patterns or best practices