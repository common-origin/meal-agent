# Phase 2 Planning - Meal Agent

**Status**: Planning  
**Phase 1 Completion Date**: 2 November 2025  
**Production URL**: https://meal-agent-gvvyzmw1k-commonorigins-projects.vercel.app

---

## 🎯 Phase 1 Achievements

✅ **Core Features Delivered:**
- 50+ real recipes from RecipeTin Eats
- Intelligent meal planning with explainability
- Shopping list aggregation with Coles price estimates
- Privacy-first analytics
- Responsive design with design system tokens
- CSV export for shopping lists
- Production deployment on Vercel

✅ **Technical Foundation:**
- Next.js 16 with App Router
- TypeScript strict mode
- Monorepo structure (pnpm)
- Common Origin Design System integration
- LocalStorage-based persistence
- Tag normalization and scoring pipeline

---

## 🚀 Phase 2 Potential Features

### **Priority 1: User Experience Enhancements**

#### 1. **User Accounts & Cloud Sync**
- **Why**: Enable cross-device access and data persistence
- **Features**:
  - User authentication (email/social login)
  - Cloud storage for meal plans and favorites
  - Sync analytics across devices
  - Family/household sharing
- **Tech Stack**: Next-Auth, Supabase/Firebase, or Clerk
- **Effort**: 2-3 weeks

#### 2. **Nutrition Tracking**
- **Why**: Health-conscious meal planning
- **Features**:
  - Nutritional data per recipe (calories, macros, etc.)
  - Daily/weekly nutrition summaries
  - Dietary restrictions filtering (vegan, gluten-free, low-carb)
  - Allergen warnings
- **Data Source**: USDA FoodData Central API or Spoonacular
- **Effort**: 1-2 weeks

#### 3. **Custom Recipe Management**
- **Why**: Personalization and family recipes
- **Features**:
  - Add custom recipes with ingredients
  - Photo upload for recipes
  - Import recipes from URLs (recipe scraping)
  - Edit existing RecipeTin Eats recipes
  - Recipe collections/folders
- **Effort**: 2 weeks

---

### **Priority 2: Intelligence & Automation**

#### 4. **LLM-Powered Meal Suggestions**
- **Why**: Truly intelligent meal planning
- **Features**:
  - Natural language meal requests ("easy weeknight dinners")
  - Contextual suggestions based on history
  - Seasonal recipe recommendations
  - Ingredient substitution suggestions
- **Tech Stack**: OpenAI GPT-4, Anthropic Claude, or local LLM
- **Effort**: 2-3 weeks
- **Cost Consideration**: API usage fees

#### 5. **Smart Leftover Management**
- **Why**: Reduce food waste
- **Features**:
  - Track leftover portions
  - Suggest recipes using leftovers
  - Freezer inventory management
  - Expiration date tracking
- **Effort**: 1-2 weeks

#### 6. **Automated Meal Plan Generation**
- **Why**: Save time on planning
- **Features**:
  - One-click weekly plan generation
  - Preference learning (liked/disliked meals)
  - Budget-optimized plans
  - Cuisine variety enforcement
- **Enhancement**: Build on existing `compose.ts` logic
- **Effort**: 1 week

---

### **Priority 3: Shopping & Integration**

#### 7. **Real Coles API Integration**
- **Why**: Accurate pricing and availability
- **Features**:
  - Real-time product search
  - Actual prices instead of estimates
  - Stock availability checking
  - Direct add-to-cart links
  - Price alerts for deals
- **Blocker**: Coles API access (partnership required)
- **Alternative**: Web scraping (legal review needed)
- **Effort**: 3-4 weeks (if API available)

#### 8. **Multi-Retailer Support**
- **Why**: User choice and price comparison
- **Features**:
  - Woolworths integration
  - IGA support
  - Price comparison across retailers
  - Store preference settings
- **Effort**: 2-3 weeks per retailer

#### 9. **Online Ordering Integration**
- **Why**: Complete end-to-end experience
- **Features**:
  - Direct checkout with Coles Online
  - Saved shopping carts
  - Delivery time slot booking
  - Order history tracking
- **Effort**: 4-5 weeks (requires partnerships)

---

### **Priority 4: Social & Community**

#### 10. **Recipe Ratings & Reviews**
- **Why**: Community-driven quality
- **Features**:
  - Star ratings for recipes
  - Written reviews and tips
  - Recipe modifications sharing
  - "Made this" counter
- **Effort**: 1-2 weeks

#### 11. **Meal Plan Sharing**
- **Why**: Social engagement
- **Features**:
  - Share meal plans via link
  - Public meal plan gallery
  - Follow other users
  - Weekly plan templates
- **Effort**: 2 weeks

#### 12. **Social Features**
- **Why**: Community building
- **Features**:
  - User profiles
  - Follow favorite recipe creators
  - Activity feed
  - Meal planning challenges
- **Effort**: 3-4 weeks

---

### **Priority 5: Advanced Features**

#### 13. **Meal Prep Mode**
- **Why**: Batch cooking enthusiasts
- **Features**:
  - Multi-day batch cooking plans
  - Container portioning guide
  - Reheat instructions
  - Freezer-friendly recipes filter
- **Effort**: 1-2 weeks

#### 14. **Pantry Management**
- **Why**: Inventory tracking
- **Features**:
  - Pantry item database
  - "Use what you have" recipe suggestions
  - Barcode scanning for items
  - Shopping list adjustment based on pantry
- **Effort**: 3-4 weeks

#### 15. **Recipe Scaling**
- **Why**: Flexible serving sizes
- **Features**:
  - Automatic ingredient scaling
  - Conversion between servings (2→4, 4→8)
  - Unit conversions (metric/imperial)
- **Effort**: 1 week

#### 16. **Cooking Timer Integration**
- **Why**: Hands-free cooking assistance
- **Features**:
  - Multi-timer support
  - Step-by-step cooking mode
  - Voice commands
  - Timer notifications
- **Effort**: 1-2 weeks

---

## 🛠️ Technical Improvements

### **Infrastructure**

#### 17. **Testing Infrastructure**
- **Current State**: Basic Vitest setup
- **Improvements**:
  - Component testing with React Testing Library
  - E2E tests with Playwright
  - Visual regression testing
  - CI/CD test automation
- **Effort**: 1-2 weeks

#### 18. **Performance Optimization**
- **Features**:
  - Image optimization (Next.js Image)
  - Route prefetching
  - Bundle size reduction
  - Lighthouse score 90+
  - Analytics on Core Web Vitals
- **Effort**: 1 week

#### 19. **Error Monitoring**
- **Tools**: Sentry, LogRocket, or Vercel Analytics
- **Features**:
  - Real-time error tracking
  - User session replay
  - Performance monitoring
  - Custom alerts
- **Effort**: 3-5 days

#### 20. **Accessibility Improvements**
- **Target**: WCAG 2.1 AA compliance
- **Features**:
  - Screen reader optimization
  - Keyboard navigation
  - High contrast mode
  - Focus management
  - Accessibility audit
- **Effort**: 1-2 weeks

---

## 📊 Recommended Priorities

### **Quick Wins (1-2 weeks each)**
1. ✨ Nutrition Tracking
2. ✨ Recipe Scaling
3. ✨ Recipe Ratings & Reviews
4. ✨ Automated Meal Plan Generation
5. ✨ Performance Optimization

### **High Impact (2-4 weeks each)**
1. 🚀 User Accounts & Cloud Sync
2. 🚀 LLM-Powered Meal Suggestions
3. 🚀 Custom Recipe Management
4. 🚀 Real Coles API Integration
5. 🚀 Testing Infrastructure

### **Long Term (4+ weeks)**
1. 🎯 Online Ordering Integration
2. 🎯 Multi-Retailer Support
3. 🎯 Pantry Management
4. 🎯 Social Features

---

## 💭 Decision Points

### **Before Starting Phase 2:**

1. **User Feedback Collection**
   - Run Phase 1 in production for 2-4 weeks
   - Collect analytics data
   - Survey users on desired features
   - Identify pain points

2. **Business Model Clarification**
   - Free vs. premium features?
   - Affiliate partnerships (Coles, Woolworths)?
   - Subscription pricing?
   - Ad-supported?

3. **Technical Decisions**
   - Authentication provider (Clerk, Auth0, Next-Auth?)
   - Database choice (Supabase, PlanetScale, Firebase?)
   - LLM provider (OpenAI, Anthropic, local?)
   - Analytics platform (Vercel, Google, self-hosted?)

4. **Legal & Compliance**
   - Privacy policy for user data
   - Terms of service
   - Cookie consent (if needed)
   - Retailer API terms of use

---

## 📅 Suggested Roadmap

### **Month 1: Foundation & Feedback**
- Week 1-2: Monitor production, collect user feedback
- Week 3: Implement nutrition tracking
- Week 4: Add recipe scaling

### **Month 2: User Accounts**
- Week 1-2: User authentication & cloud sync
- Week 3-4: Custom recipe management

### **Month 3: Intelligence**
- Week 1-2: LLM integration planning & prototyping
- Week 3-4: Automated meal plan generation enhancement

### **Month 4+: Integration & Growth**
- Coles API partnership discussions
- Testing infrastructure
- Social features
- Advanced automation

---

## 🎓 Lessons from Phase 1

### **What Worked Well:**
- ✅ Clear work order structure
- ✅ Incremental implementation
- ✅ Strong documentation
- ✅ Design system integration
- ✅ Real recipes over mocks

### **Challenges:**
- ⚠️ Vercel deployment configuration (monorepo)
- ⚠️ pnpm version management
- ⚠️ Design system version compatibility

### **Apply to Phase 2:**
- Continue work order approach
- Test deployment early and often
- Maintain documentation discipline
- Use feature flags for gradual rollouts
- Set up automated testing from the start

---

## 🤔 Next Steps

1. **Test Phase 1 in production** (validation checklist)
2. **Collect initial user feedback** (family/friends)
3. **Review analytics data** (after 1-2 weeks)
4. **Choose 2-3 Phase 2 features** based on feedback
5. **Create detailed work orders** for chosen features
6. **Set up Phase 2 branch** or feature flags

---

**Questions to Consider:**

- What features would provide the most value to users?
- Which features align with business goals?
- What's the MVP for Phase 2?
- How can we validate ideas before building?
- What metrics define success for Phase 2?
