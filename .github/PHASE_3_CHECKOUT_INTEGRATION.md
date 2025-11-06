# Phase 3: Coles Checkout Integration - Research & Planning

**Date**: 6 November 2025  
**Status**: Planning / Research Phase  
**Goal**: Enable seamless shopping list → purchase flow without Coles API partnership

---

## 🔍 Research Findings

### Coles API Status
- ❌ **No Public API**: No developer.coles.com.au portal exists
- ❌ **No Partner Program**: No publicly advertised API partnership program
- ⚠️ **Partnership Required**: Would need business relationship with Coles for official API access

### What IS Publicly Available
- ✅ **Web Interface**: coles.com.au with cart functionality
- ✅ **Product Search**: Search by product name/barcode
- ✅ **Click & Collect**: Free same-day pickup (order by 2pm)
- ✅ **Delivery**: Available for $50+ orders
- ✅ **Mobile App**: iOS/Android apps available

---

## 💡 Feasible Solutions (Without API Partnership)

### **Option 1: Smart Shopping List Export** ⭐ RECOMMENDED MVP
**How it works:**
1. User generates weekly meal plan
2. App creates optimized shopping list
3. User clicks "Shop at Coles"
4. App generates a shareable link or text format
5. User manually searches/adds items in Coles

**Pros:**
- ✅ Works immediately, no approval needed
- ✅ No legal/ToS issues
- ✅ Simple to implement
- ✅ User maintains control

**Cons:**
- ⚠️ Not fully automated
- ⚠️ User still needs to search items manually
- ⚠️ Takes 5-10 minutes of user time

**Implementation:**
```typescript
// Generate clipboard-ready shopping list
function generateColesShoppingList(items: ShoppingItem[]): string {
  return items.map(item => {
    const product = colesMapping.get(item.name);
    return product 
      ? `${item.quantity} ${item.unit} ${product.colesName}` // Use exact Coles product name
      : `${item.quantity} ${item.unit} ${item.name}`;
  }).join('\n');
}

// Copy to clipboard + show instructions
function exportToColes() {
  const list = generateColesShoppingList(shoppingList);
  navigator.clipboard.writeText(list);
  showInstructions("List copied! Open Coles.com.au and search for each item.");
}
```

**User Journey:**
1. Click "Shop at Coles" button
2. See modal: "Shopping list copied to clipboard"
3. Button: "Open Coles Website"
4. Instructions: "Search for items and add to cart"
5. User completes checkout in Coles

**Effort**: 1-2 days  
**Risk**: Low  
**User Time**: 5-10 minutes manual work

---

### **Option 2: Deep Link to Coles Search** ⭐⭐ BETTER UX
**How it works:**
1. User clicks "Add to Coles Cart"
2. App generates deep links for each product
3. Opens Coles app/website with pre-populated searches
4. User clicks "Add to Cart" for each item
5. Checkout in Coles

**Pros:**
- ✅ Better UX than plain text
- ✅ Opens Coles app/website automatically
- ✅ Pre-fills search queries
- ✅ Legal and ToS-compliant

**Cons:**
- ⚠️ Still semi-manual (user clicks "Add" for each)
- ⚠️ Deep link format may change
- ⚠️ Not truly "one click"

**Implementation:**
```typescript
// Generate Coles search deep links
function generateColesLinks(items: ShoppingItem[]): DeepLink[] {
  return items.map(item => {
    const product = colesMapping.get(item.name);
    const searchQuery = product?.colesName || item.name;
    
    return {
      web: `https://www.coles.com.au/search/products?q=${encodeURIComponent(searchQuery)}`,
      app: `coles://search?q=${encodeURIComponent(searchQuery)}`, // If app supports deep links
      product: item
    };
  });
}

// Open links sequentially
function openColesLinks(links: DeepLink[]) {
  links.forEach((link, index) => {
    setTimeout(() => {
      window.open(link.web, '_blank');
    }, index * 1000); // Stagger by 1 second
  });
}
```

**User Journey:**
1. Click "Shop at Coles"
2. Modal: "We'll open Coles search for each item"
3. Button: "Start Shopping"
4. Opens 10-15 tabs (one per ingredient)
5. User adds items to cart from each tab
6. Checkout in Coles

**Effort**: 2-3 days  
**Risk**: Low-Medium (depends on deep link support)  
**User Time**: 3-5 minutes

---

### **Option 3: Browser Extension** ⭐⭐⭐ BEST UX (but more complex)
**How it works:**
1. User installs browser extension
2. Extension detects Coles website
3. User generates meal plan in app
4. Extension reads shopping list from app
5. Auto-fills cart on Coles website

**Pros:**
- ✅ Near-seamless automation
- ✅ Works within Coles' existing interface
- ✅ No API partnership needed
- ✅ User stays in control

**Cons:**
- ⚠️ Requires separate extension install
- ⚠️ Only works in browser (not mobile app)
- ⚠️ More complex development
- ⚠️ Maintenance if Coles changes website

**Tech Stack:**
- Chrome/Firefox/Safari extension
- Manifest V3
- Cross-origin messaging with meal-agent app
- DOM manipulation to add items to cart

**User Journey:**
1. Install "Meal Agent for Coles" extension
2. Generate meal plan in app
3. Click "Shop at Coles"
4. Opens coles.com.au
5. Extension auto-searches and adds items
6. User reviews cart and checks out

**Effort**: 1-2 weeks  
**Risk**: Medium (maintenance overhead)  
**User Time**: 1-2 minutes

---

### **Option 4: Mobile App with In-App Browser** (Future)
**How it works:**
1. Convert to mobile app (React Native / PWA)
2. Use in-app browser to load Coles
3. Inject JavaScript to auto-add items
4. User completes checkout in-app

**Pros:**
- ✅ Better mobile experience
- ✅ One seamless flow
- ✅ Can guide user through process

**Cons:**
- ⚠️ Requires mobile app development
- ⚠️ May violate app store policies
- ⚠️ Fragile to Coles website changes

**Status**: Phase 4 consideration

---

## 🎯 Recommended MVP Approach

### **Phase 3A: Smart Export + Deep Links** (Week 1-2)

**Week 1: Smart List Export**
1. Enhance `colesMapping.ts` with exact Coles product names
2. Create "Export to Coles" button on shopping list page
3. Generate formatted text list (clipboard)
4. Add instructions modal
5. Track click-through analytics

**Week 2: Deep Link Integration**
1. Research Coles app deep link schema
2. Generate search deep links for each item
3. Add "Shop at Coles" flow with sequential tab opening
4. Mobile detection (app vs web)
5. User testing

**Deliverables:**
- ✅ One-click copy shopping list
- ✅ One-click open Coles searches
- ✅ Instructions/tutorial for users
- ✅ Analytics on usage

**Success Metrics:**
- 80%+ users click "Shop at Coles"
- Average time to add items: <5 minutes
- User satisfaction: 4+/5 stars

---

### **Phase 3B: Browser Extension** (Month 2-3, if MVP successful)

Only build if Phase 3A shows strong user adoption.

**Benefits of waiting:**
- Validate demand first
- Learn user pain points
- Build better product

---

## 🔄 Alternative Supermarkets to Consider

### **Woolworths**
- Similar situation (no public API)
- Same deep link approach would work
- Could support both Coles & Woolworths

### **Amazon Fresh** (Australia)
- May have product API
- Worth researching
- Smaller market share

### **IGA / Aldi**
- Limited online shopping
- Lower priority

---

## 💰 Cost Estimate

### Phase 3A (MVP)
- **Development**: 40-60 hours
- **Cost**: $0 (no API fees)
- **Timeline**: 2 weeks

### Phase 3B (Extension)
- **Development**: 80-120 hours
- **Cost**: $0 (no API fees)
- **Maintenance**: 4-8 hours/month
- **Timeline**: 4-6 weeks

### Future API Partnership
- **Partnership fee**: Unknown (likely $$$$ enterprise)
- **Revenue share**: Possible commission model
- **Timeline**: 6-12 months negotiation

---

## 📋 Next Steps

1. **Validate with users** - Would this flow work for you?
2. **Prototype Phase 3A** - Build MVP in 2 weeks
3. **User testing** - Get feedback from 5-10 users
4. **Iterate** - Improve based on feedback
5. **Consider Phase 3B** - Only if MVP shows traction

---

## ❓ Questions for You

1. **Is Option 2 (Deep Links) acceptable as MVP?** (5-10 min user time)
2. **Would you be willing to test a browser extension?** (Phase 3B)
3. **Should we support Woolworths too?** (Similar implementation)
4. **Any objections to the deep link approach?** (Opens multiple tabs)
5. **Timeline preference**: Quick MVP (2 weeks) or more polished (6 weeks)?

---

## 🔮 Long-term Vision

**If this gains traction:**
- Approach Coles with usage metrics
- Propose partnership (we drive sales to them)
- Negotiate API access or affiliate program
- Build official integration

**Similar Success Stories:**
- Instacart partnered with supermarkets after proving demand
- HelloFresh partners with retailers for ingredient delivery
- DoorDash started without API, then partnered

**Our advantage:**
- We solve a real problem (meal planning → shopping)
- We drive sales to Coles
- We have usage data to prove value

---

**Recommendation**: Start with Phase 3A (Smart Export + Deep Links), get user feedback, then decide on Phase 3B or pursuing official partnership.
