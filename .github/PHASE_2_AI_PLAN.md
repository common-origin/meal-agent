# Phase 2: AI-Powered Recipe Generation - Technical Plan

**Date**: 3 November 2025  
**Goal**: Automate weekly meal planning with AI-generated recipes based on family preferences

---

## 🎯 User Requirements

**Primary Goal**: Generate tasty, simple, relatively cheap recipes for family on a weekly basis without manual effort

**Key Requirements**:
- AI generates recipes based on family settings (preferences, budget, dietary needs)
- Weekly automation (set it and forget it)
- One user (family account, no multi-user needed)
- No user accounts/cloud required (stay localStorage-based)
- Cost-effective solution
- Simple, family-friendly recipes

**Out of Scope for Phase 2**:
- Nutrition tracking (future phase)
- Multi-user accounts
- Social/sharing features

---

## 💰 AI Provider Options

### **Option 1: Free (Gemini Free Tier)** - RECOMMENDED FOR TESTING

**Provider**: Google Gemini API  
**Cost**: FREE up to 1,500 requests/day  
**Model**: Gemini 1.5 Flash (fast, good quality)

**Pricing Details**:
- Free tier: 15 requests per minute, 1,500 per day
- Your usage: ~1 request/week (generate 7 recipes) = 4-5 requests/month
- **Monthly cost: $0** ✅

**Quality**:
- Good recipe generation
- Understands cooking context well
- Fast responses (~2-3 seconds)
- Reliable JSON output

**Pros**:
- ✅ Completely free for your use case
- ✅ No credit card required to start
- ✅ Good quality recipes
- ✅ Fast enough for weekly generation
- ✅ Generous rate limits

**Cons**:
- ⚠️ Rate limits (but won't affect you)
- ⚠️ Slightly less creative than GPT-4
- ⚠️ May have regional availability restrictions

**Best for**: Testing, personal use, keeping costs at $0

---

### **Option 2: Cheap but Premium (OpenAI GPT-4o-mini)**

**Provider**: OpenAI API  
**Cost**: ~$0.50-2.00/month  
**Model**: GPT-4o-mini (balanced cost/quality)

**Pricing Details**:
- Input: $0.15 per 1M tokens (~$0.0001 per request)
- Output: $0.60 per 1M tokens (~$0.0005 per request)
- Your usage: ~4 requests/month for weekly generation
- **Monthly cost: ~$0.50-2.00** (depends on prompt size)

**Quality**:
- Excellent recipe generation
- Very creative and diverse
- Understands dietary preferences well
- Great at adapting to constraints (budget, time, ingredients)

**Pros**:
- ✅ Best-in-class quality
- ✅ Extremely creative
- ✅ Excellent at following constraints
- ✅ Reliable JSON formatting
- ✅ Still very cheap for personal use
- ✅ Easy to upgrade to GPT-4 if needed

**Cons**:
- ⚠️ Requires credit card
- ⚠️ Small ongoing cost (~$1-2/mo)
- ⚠️ Need to manage API keys

**Best for**: Premium quality, willing to pay small amount for better results

---

### **Option 3: Alternative Free (Anthropic Claude)**

**Provider**: Anthropic API  
**Cost**: FREE $5 credit (lasts months), then ~$3-5/month  
**Model**: Claude 3.5 Haiku (fast, cheap)

**Pricing Details**:
- Free $5 credit on signup
- Input: $0.25 per 1M tokens
- Output: $1.25 per 1M tokens
- Your usage: ~4 requests/month
- **Monthly cost after credit: ~$0.50-1.00**

**Quality**:
- Excellent at detailed recipes
- Good at understanding context
- Thoughtful about dietary restrictions
- Verbose (can be good or bad)

**Pros**:
- ✅ Free $5 credit gets you started
- ✅ High quality
- ✅ Great at detailed instructions
- ✅ Good safety/ethical considerations

**Cons**:
- ⚠️ Eventually costs money
- ⚠️ Can be verbose (longer responses = higher cost)
- ⚠️ Requires credit card after trial

---

## 📊 Comparison Matrix

| Feature | Gemini Free | GPT-4o-mini | Claude Haiku |
|---------|------------|-------------|--------------|
| **Cost/month** | $0 | $0.50-2.00 | $0 (trial), $0.50-1.00 after |
| **Quality** | Good (8/10) | Excellent (10/10) | Excellent (9/10) |
| **Speed** | Fast (2-3s) | Fast (2-4s) | Fast (2-3s) |
| **Creativity** | Good | Excellent | Very Good |
| **Setup** | Easy | Easy | Easy |
| **Credit Card** | No | Yes | Yes (after trial) |
| **Rate Limits** | 1,500/day | High | High |
| **Best For** | Free forever | Premium quality | Detailed recipes |

---

## 🏆 My Recommendation

### **Start with Gemini Free, Easy Upgrade Path to GPT-4o-mini**

**Why**:
1. **Gemini Free** lets you test the entire flow at $0 cost
2. Validate the AI integration works well
3. Test with your family to see if they like the recipes
4. If quality isn't quite right, upgrade to **GPT-4o-mini** for ~$1-2/mo
5. Both have nearly identical integration code (easy swap)

**Implementation Plan**:
- Build with Gemini first (free)
- Add OpenAI as fallback/upgrade option
- Simple env variable to switch providers
- Test both with your family over 2-4 weeks
- Stick with what works best

---

## 🛠️ Technical Architecture

### **How It Will Work**

```
Weekly Trigger (User clicks "Generate Week")
  ↓
Gather Family Settings from localStorage:
  - Dietary preferences (e.g., "no shellfish", "loves pasta")
  - Budget constraint (e.g., "$150/week")
  - Time constraints (e.g., "30 min weeknights, 1hr weekends")
  - Cuisine preferences (e.g., "Italian, Asian, Australian")
  - Household size (e.g., "2 adults, 2 kids")
  - Past recipes (to avoid repetition)
  ↓
Send to AI API with Prompt:
  "Generate 7 dinner recipes for this week that are:
   - Simple and quick (30 min weeknights)
   - Budget-friendly (~$20-25 per meal)
   - Family-friendly (2 adults, 2 kids)
   - Variety: Italian, Asian, Australian
   - Avoid: shellfish, overly spicy
   - Not repeated from last 2 weeks
   - Use seasonal ingredients (November, Australia)"
  ↓
AI Returns JSON:
  [
    {
      "title": "Quick Chicken Stir Fry",
      "cookTime": 25,
      "ingredients": [...],
      "instructions": [...],
      "tags": ["quick", "asian", "budget-friendly"],
      "estimatedCost": 22,
      "servings": 4
    },
    ... 6 more recipes
  ]
  ↓
Parse & Display to User:
  - Show 7 recipes for the week
  - User can regenerate individual days
  - User can tweak preferences
  - Save to localStorage
  ↓
Generate Shopping List:
  - Aggregate all ingredients
  - Map to Coles products (existing logic)
  - Export CSV
```

### **Key Components to Build**

1. **Family Settings Page** (`/settings`)
   - Dietary preferences
   - Budget per meal
   - Time constraints
   - Cuisine preferences
   - Household size
   - Saved in localStorage

2. **AI Recipe Generator** (`lib/aiRecipeGenerator.ts`)
   - Prompt engineering
   - API integration (Gemini + OpenAI)
   - JSON parsing & validation
   - Error handling

3. **Weekly Plan Generator** (`/plan/generate`)
   - One-click "Generate Week" button
   - Shows loading state (AI takes 5-10 seconds)
   - Displays generated recipes
   - Allow regenerate individual days

4. **Recipe Storage** (`lib/storage.ts` updates)
   - Save AI-generated recipes
   - Track history (avoid repetition)
   - Store in localStorage (no backend needed)

---

## 📋 Work Orders for Phase 2A

### **WO1: Family Settings Management**
**Effort**: 2-3 days  
**Files to Create/Edit**:
- `apps/web/src/app/settings/page.tsx` (new)
- `apps/web/src/lib/storage.ts` (add settings methods)
- `apps/web/src/components/app/SettingsForm.tsx` (new)

**Features**:
- Form for dietary preferences (checkboxes, text input)
- Budget slider ($10-50 per meal)
- Time constraint selector (15min, 30min, 45min, 1hr+)
- Cuisine multi-select (Italian, Asian, Mexican, etc.)
- Household size input
- Save to localStorage
- Link in nav menu

---

### **WO2: AI Recipe Generator Integration**
**Effort**: 3-4 days  
**Files to Create/Edit**:
- `apps/web/src/lib/aiRecipeGenerator.ts` (new)
- `apps/web/src/lib/prompts/recipeGeneration.ts` (new)
- `apps/web/.env.local` (API keys)
- `apps/web/src/app/api/generate-recipes/route.ts` (new API endpoint)

**Features**:
- Gemini API integration
- OpenAI fallback (env-based toggle)
- Prompt templates for recipe generation
- JSON schema validation
- Rate limiting & error handling
- Retry logic

**API Prompt Example**:
```
You are an expert home cook creating simple, delicious family meals.

Generate 7 dinner recipes for this week based on these requirements:
- Family: 2 adults, 2 children (ages 5-10)
- Budget: $20-25 per meal
- Time: 30 minutes on weeknights, up to 1 hour on weekends
- Dietary: No shellfish, moderate spice
- Cuisine preferences: Italian, Asian, Australian home cooking
- Avoid repeating: [list of recent recipes]
- Season: Summer in Australia (fresh, light meals)

For each recipe provide:
1. Title
2. Description (1 sentence)
3. Ingredients with quantities for 4 servings
4. Step-by-step instructions
5. Estimated cook time
6. Estimated cost
7. Tags (cuisine, difficulty, dietary)

Return as JSON array.
```

---

### **WO3: Weekly Plan Generation UI**
**Effort**: 2-3 days  
**Files to Create/Edit**:
- `apps/web/src/app/plan/generate/page.tsx` (new)
- `apps/web/src/components/app/GenerateWeekButton.tsx` (new)
- `apps/web/src/components/app/GeneratedRecipeCard.tsx` (new)

**Features**:
- "Generate Week" button on `/plan`
- Loading state (AI generating... 5-10 seconds)
- Display 7 generated recipes in grid
- Regenerate individual days
- Accept/Save plan button
- Edit individual recipes before saving

---

### **WO4: Recipe History & Repetition Avoidance**
**Effort**: 1-2 days  
**Files to Edit**:
- `apps/web/src/lib/storage.ts` (add recipe history)
- `apps/web/src/lib/aiRecipeGenerator.ts` (check history)

**Features**:
- Track last 20 recipes used
- Pass to AI to avoid repetition
- "View History" page
- Clear history option

---

### **WO5: Cost Estimation & Budget Tracking**
**Effort**: 1-2 days  
**Files to Edit**:
- `apps/web/src/lib/aiRecipeGenerator.ts` (validate cost)
- `apps/web/src/app/plan/review/page.tsx` (show budget vs actual)

**Features**:
- AI includes estimated cost per recipe
- Show weekly budget vs. actual
- Warn if over budget
- Suggest cheaper alternatives

---

## 🚀 Development Timeline

### **Week 1: Foundation**
- Day 1-2: Family settings page + localStorage
- Day 3-4: Gemini API integration + prompt engineering
- Day 5: Testing & refinement

### **Week 2: UI & Generation**
- Day 1-2: Weekly plan generation UI
- Day 3-4: Recipe history & repetition avoidance
- Day 5: Cost tracking & budget validation

### **Week 3: Polish & Testing**
- Day 1-2: Error handling, loading states
- Day 3-4: Test with family, gather feedback
- Day 5: Refinements & deployment

**Total: 3 weeks**

---

## 💡 Cost Analysis

### **Gemini Free Option**
- Setup: $0
- Monthly: $0
- Annual: $0
- **Total Year 1: $0** ✅

### **GPT-4o-mini Option**
- Setup: $0
- Monthly: ~$1.50
- Annual: ~$18
- **Total Year 1: $18**

### **Hybrid Approach (Recommended)**
- Start with Gemini (free)
- If quality isn't perfect, switch to GPT-4o-mini
- Cost: $0-18/year depending on choice

---

## ✅ Next Steps

1. **I'll create WO1** (Family Settings) - Ready to start coding?
2. **Set up Gemini API key** - I'll guide you through signup
3. **Build & test** - Iterate with your family's feedback
4. **Optionally add OpenAI** - If Gemini quality isn't perfect

**Sound good? Should I start creating the work orders?** 🚀

---

## 🤔 Questions for Refinement

1. **Cuisine preferences**: What cuisines does your family love? (Italian, Asian, Mexican, etc.)
2. **Dietary restrictions**: Any allergies or dislikes? (nuts, shellfish, dairy, etc.)
3. **Budget per meal**: What's realistic? ($15-20? $20-25? $25-30?)
4. **Household size**: How many people? Any kids? Ages?
5. **Time constraints**: Weeknight time limit? (30min? 45min?)
6. **Variety preference**: Mix it up weekly or okay with favorites repeated?

These will help me craft the perfect AI prompts! 🎯
