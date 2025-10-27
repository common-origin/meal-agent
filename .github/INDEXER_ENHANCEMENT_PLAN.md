# Recipe Indexer Enhancement Plan

**Status**: Ready for implementation  
**Date**: 27 October 2025  
**Goal**: Make the indexer successfully extract recipes from chef websites

## Current Issues Identified

### Issue 1: URL Filtering Too Broad
- **Problem**: Filter includes ALL URLs from chef's domain, matching non-recipe pages
- **Evidence**: Adam Ragusea indexer found `/home`, `/about`, `/contact` instead of recipes
- **Impact**: 0 recipes indexed from both chefs

### Issue 2: RecipeTin Eats Returns No URLs
- **Problem**: Sub-sitemaps fetched but 0 URLs after filtering
- **Evidence**: "Found 0 recipe URLs to index" for Nagi
- **Likely cause**: URLs don't contain "/recipe" or "/recipes" in path

### Issue 3: Demo Limits Too Restrictive
- **Problem**: Only 3 sub-sitemaps, 5 recipes processed
- **Impact**: Can't build meaningful library

### Issue 4: No Real-World Recipe URL Patterns
- **Problem**: Hard-coded `/recipe` or `/recipes` pattern doesn't match actual sites
- **Need**: Site-specific URL patterns

---

## Enhancement Tasks (Priority Order)

### TASK 1: Investigate Real Sitemap Structure ⭐ HIGH PRIORITY
**Goal**: Understand what URLs are actually in the sitemaps

**Status**: ✅ COMPLETE

**Findings**:
1. **RecipeTin Eats (Nagi)**:
   - ✅ 1,495 URLs found in 3 sub-sitemaps
   - ❌ URLs don't contain `/recipe` or `/recipes`
   - ✅ URLs ARE recipes: `/beef-cheek-ragu-pasta-cook-eat-thrice/`, `/giant-hash-brown/`
   - 🔍 Pattern: All URLs under domain root (no `/recipe/` prefix)
   - ⚠️ Some non-recipe URLs: `/blog/`, `/new-york-food-map/`

**Note**: Jamie Oliver removed temporarily - site requires custom scraping logic (category pages instead of individual recipe URLs in sitemap)

**Files modified**:
- ✅ `scripts/indexChefs.ts` - Added debug logging

**Acceptance Criteria**:
- ✅ Console shows actual URLs being filtered
- ✅ We understand why URLs are being rejected

---

### TASK 2: Implement Site-Specific URL Patterns ⭐ HIGH PRIORITY
**Goal**: Each chef has custom URL pattern matching

**Implementation**:
```typescript
interface ChefConfig {
  name: string;
  domain: string;
  robotsTxtUrl: string;
  sitemapUrl?: string;
  urlPatterns: string[];  // NEW: Array of patterns to match
  excludePatterns?: string[];  // NEW: Patterns to exclude
}

const CHEFS: ChefConfig[] = [
  {
    name: "nagi",
    domain: "recipetineats.com",
    robotsTxtUrl: "https://www.recipetineats.com/robots.txt",
    sitemapUrl: "https://www.recipetineats.com/sitemap_index.xml",
    urlPatterns: ["/"], // Match all, then filter by exclude
    excludePatterns: ["/about", "/contact", "/privacy", "/category"]
  },
  {
    name: "jamie-oliver",
    domain: "jamieoliver.com",
    robotsTxtUrl: "https://www.jamieoliver.com/robots.txt",
    urlPatterns: ["/recipes/"], // Jamie Oliver recipes under /recipes/
    excludePatterns: ["/category/", "/tag/", "/features/", "/news/"]
  }
];
```

**Files to modify**:
- `scripts/indexChefs.ts` - Update ChefConfig interface and filtering logic

**Acceptance Criteria**:
- Each chef uses custom patterns
- Non-recipe pages are excluded
- At least 5 recipes found per chef

---

### TASK 3: Add URL Validation with HEAD Requests ⭐ MEDIUM PRIORITY
**Goal**: Pre-validate URLs before full HTML fetch

**Implementation**:
```typescript
async function hasRecipeSchema(url: string): Promise<boolean> {
  try {
    const html = await fetchWithRetry(url);
    const hasJsonLd = html.includes('type="application/ld+json"');
    const hasRecipeType = html.includes('"@type":"Recipe"') || 
                          html.includes('"@type": "Recipe"');
    return hasJsonLd && hasRecipeType;
  } catch {
    return false;
  }
}
```

**Files to modify**:
- `scripts/indexChefs.ts` - Add validation before full parse

**Acceptance Criteria**:
- Reduces wasted fetches on non-recipe pages
- Logs validation results

---

### TASK 4: Remove Demo Limits 🔧 QUICK WIN
**Goal**: Process all available sitemaps and recipes

**Changes**:
```typescript
// BEFORE:
.slice(0, 3); // Limit to first 3 for demo
.slice(0, 5); // Limit to 5 recipes for demo

// AFTER:
.slice(0, 10); // Process 10 sub-sitemaps (reasonable limit)
.slice(0, 50); // Process 50 recipes per chef (reasonable limit)
```

**Files to modify**:
- `scripts/indexChefs.ts` - Lines 247 and 267

**Acceptance Criteria**:
- At least 10 sub-sitemaps processed
- At least 20 recipes per chef

---

### TASK 5: Enhanced JSON-LD Extraction 🔧 MEDIUM PRIORITY
**Goal**: Better handle various JSON-LD formats

**Implementation**:
```typescript
function extractRecipeJsonLd(html: string): Recipe | null {
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const foundRecipes: Recipe[] = [];

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);
      
      // Handle various structures
      if (data["@type"] === "Recipe") {
        foundRecipes.push(data as Recipe);
      } else if (Array.isArray(data)) {
        data.forEach(item => {
          if (item["@type"] === "Recipe") foundRecipes.push(item);
        });
      } else if (data["@graph"]) {
        data["@graph"].forEach((node: any) => {
          if (node["@type"] === "Recipe") foundRecipes.push(node);
        });
      }
    } catch (error) {
      // Silent fail, try next script tag
    }
  }
  
  // Return first valid recipe found
  return foundRecipes.length > 0 ? foundRecipes[0] : null;
}
```

**Files to modify**:
- `scripts/indexChefs.ts` - Replace extractRecipeJsonLd function

**Acceptance Criteria**:
- Handles multiple JSON-LD scripts per page
- Extracts first Recipe found

---

### TASK 6: Add Progress Tracking & Better Logging 📊 LOW PRIORITY
**Goal**: Visibility into what's happening

**Implementation**:
```typescript
// Before filtering
console.log(`  📊 Total URLs in sitemap: ${recipeUrls.length}`);
console.log(`  🔍 Sample URLs:`, recipeUrls.slice(0, 5));

// After filtering
console.log(`  ✓ Matched ${filteredUrls.length} recipe URLs`);
console.log(`  🎯 Processing URLs:`, filteredUrls.slice(0, 3));

// During fetch
console.log(`  🍳 Fetching recipe ${index + 1}/${filteredUrls.length}: ${url}`);
```

**Files to modify**:
- `scripts/indexChefs.ts` - Add throughout indexChef function

**Acceptance Criteria**:
- Clear progress indicators
- Sample URLs shown for debugging

---

### TASK 7: Data Normalization Layer 🚀 FUTURE ENHANCEMENT
**Goal**: Convert recipes to consistent internal format

**Implementation**:
```typescript
interface NormalizedRecipe {
  id: string;
  title: string;
  chef: string;
  sourceUrl: string;
  timeMins: number;
  serves: number;
  ingredients: Array<{
    name: string;
    qty: number;
    unit: string;
    notes?: string;
  }>;
  instructions: string[];
  tags: string[];
  costPerServeEst?: number;
}

function normalizeRecipe(raw: Recipe, chef: string): NormalizedRecipe {
  // Convert ISO 8601 durations (PT30M) to minutes
  // Parse ingredient strings into structured objects
  // Extract tags from keywords/category
  // ...
}
```

**Files to modify**:
- `scripts/indexChefs.ts` - Add normalization before save
- Create `scripts/normalizer.ts` for conversion logic

**Acceptance Criteria**:
- All recipes have consistent structure
- Times converted to minutes
- Ingredients parsed into qty/unit/name

---

## Implementation Order

### Phase 1: Quick Wins (30 mins)
1. ✅ **TASK 1** - Add debug logging
2. ✅ **TASK 4** - Remove demo limits
3. Run indexer, analyze output

### Phase 2: Core Fixes (1-2 hours)
4. ✅ **TASK 2** - Site-specific URL patterns
5. ✅ **TASK 5** - Enhanced JSON-LD extraction
6. ✅ **TASK 6** - Better logging

### Phase 3: Optimization (1 hour)
7. ✅ **TASK 3** - URL validation
8. Test with both chefs
9. Verify 20+ recipes indexed per chef

### Phase 4: Future Enhancements (Later)
10. ⏸️ **TASK 7** - Data normalization
11. ⏸️ Add more chefs (Jamie Oliver, etc.)
12. ⏸️ Database integration
13. ⏸️ Image caching

---

## Success Metrics

**Minimum Viable**:
- ✅ **46/50 recipes from RecipeTin Eats (Nagi)** - Successfully indexed with 92% success rate
- ✅ All recipes have valid JSON-LD structure

**Stretch Goals**:
- 🎯 50+ recipes per chef
- ✅ <5% failure rate on recipe extraction (4/50 = 8% - close!)
- 🎯 Add more chefs (Jamie Oliver requires custom scraping)
- 🎯 Normalized ingredient format

---

## Testing Strategy

### Test 1: Single Recipe Validation
```bash
# Manually test one known recipe URL
# Verify JSON-LD extraction works
```

### Test 2: Sitemap Analysis
```bash
# Run with debug logging
# Examine URL patterns in console
```

### Test 3: Full Indexing
```bash
# Run complete indexer
# Verify files created in data/library/
```

### Test 4: Data Quality Check
```bash
# Open generated JSON files
# Verify all required fields present
# Check ingredient/instruction quality
```

---

## Ready to Start?

**Recommended approach**: Start with Phase 1 (TASK 1 + TASK 4), run the indexer with debug output, then decide on Phase 2 based on what we learn.

Shall I begin with TASK 1 (adding debug logging)?
