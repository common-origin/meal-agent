# AI Generation Debugging Guide

## Quick Tests

### 1. Test Gemini API Connection

Open your browser and visit:
```
http://localhost:3000/api/test-gemini
```

**Expected Response (Success):**
```json
{
  "success": true,
  "message": "Gemini API connected successfully. Response: API is working",
  "apiKeyConfigured": true,
  "apiKeyLength": 39
}
```

**If it fails:**
- Check if API key is in `.env.local`
- Verify API key is valid at https://aistudio.google.com/app/apikey
- Restart dev server after adding API key

### 2. Test Recipe Generation API

Use browser console or curl:

**Browser Console:**
```javascript
fetch('/api/generate-recipes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    familySettings: {
      adults: 2,
      children: [],
      totalServings: 2,
      cuisines: ['italian'],
      glutenFreePreference: false,
      proteinFocus: false,
      allergies: [],
      avoidFoods: [],
      favoriteIngredients: [],
      budgetPerMeal: { min: 10, max: 20 },
      maxCookTime: { weeknight: 30, weekend: 60 },
      batchCooking: { enabled: false, frequency: 'none', preferredDay: 'sunday' },
      varietyLevel: 3,
      leftoverFriendly: false,
      lastUpdated: new Date().toISOString()
    },
    numberOfRecipes: 1
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

**Terminal (curl):**
```bash
curl -X POST http://localhost:3000/api/generate-recipes \
  -H "Content-Type: application/json" \
  -d '{"familySettings":{"adults":2,"children":[],"totalServings":2,"cuisines":["italian"],"glutenFreePreference":false,"proteinFocus":false,"allergies":[],"avoidFoods":[],"favoriteIngredients":[],"budgetPerMeal":{"min":10,"max":20},"maxCookTime":{"weeknight":30,"weekend":60},"batchCooking":{"enabled":false,"frequency":"none","preferredDay":"sunday"},"varietyLevel":3,"leftoverFriendly":false,"lastUpdated":"2025-11-03T00:00:00.000Z"},"numberOfRecipes":1}'
```

### 3. Check Console Logs

**Browser Console (F12 → Console tab):**

Look for these log messages when clicking "Generate with AI":
```
🤖 [1/5] Starting AI meal plan generation...
✅ [2/5] Family settings loaded: {...}
📡 [3/5] Calling API...
📥 [4/5] API response status: 200 OK
📦 [4/5] API response data: {...}
✅ [5/5] Generated recipes: 7 recipes
🎉 AI generation complete!
```

**Server Terminal:**

Look for these in your `pnpm dev` terminal:
```
🤖 Generating recipes with Gemini...
📝 Request: { numberOfRecipes: 7, cuisines: [...], servings: 4 }
✅ Gemini response received
📄 Raw response length: 5432
✅ Generated 7 valid recipes
```

## Common Issues & Solutions

### Issue 1: "GEMINI_API_KEY is not configured"

**Symptoms:**
- Error message in browser
- API returns 500 error

**Solutions:**
1. Check `.env.local` exists at `/apps/web/.env.local`
2. Verify it contains: `GEMINI_API_KEY=your_key_here`
3. **Restart dev server** (critical!)
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   ```

### Issue 2: "Rate limit exceeded"

**Symptoms:**
- HTTP 429 error
- Message: "Please wait a minute before trying again"

**Solutions:**
- Wait 60 seconds
- Only click Generate once (not multiple times)
- Check rate limiting in `/api/generate-recipes/route.ts`

### Issue 3: "Failed to parse AI response"

**Symptoms:**
- Server logs show "Failed to parse JSON"
- Response text starts with "```json"

**Solutions:**
- This is usually temporary - click Generate again
- Check Gemini API status at https://status.cloud.google.com/
- Verify API key hasn't expired

### Issue 4: "Invalid response structure"

**Symptoms:**
- No recipes array in response
- Empty response

**Solutions:**
1. Check prompt in `/lib/prompts/recipeGeneration.ts`
2. Verify model is `gemini-1.5-flash` (not 1.0)
3. Check max tokens (should be 8192)

### Issue 5: Network Error

**Symptoms:**
- `fetch` fails immediately
- "Failed to fetch" in console

**Solutions:**
1. Check dev server is running (`pnpm dev`)
2. Verify URL is correct: `/api/generate-recipes`
3. Check browser network tab (F12 → Network)
4. Try test endpoint: `/api/test-gemini`

### Issue 6: Loading Never Completes

**Symptoms:**
- "Generating..." button stays spinning
- No error message appears

**Solutions:**
1. Check browser console for errors
2. Check server terminal for errors
3. Gemini API might be slow (can take 10-30 seconds)
4. Check network tab - is request still pending?

## Debugging Steps

### Step 1: Verify API Key
```bash
# Check .env.local exists
cat apps/web/.env.local

# Should output:
# GEMINI_API_KEY=AIza...
```

### Step 2: Test Gemini Connection
Visit: `http://localhost:3000/api/test-gemini`

### Step 3: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Click "Generate with AI"
4. Look for numbered log messages [1/5] through [5/5]

### Step 4: Check Server Logs
1. Look at terminal running `pnpm dev`
2. Should see Gemini API logs
3. Check for errors or warnings

### Step 5: Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Click "Generate with AI"
4. Find request to `/api/generate-recipes`
5. Check:
   - Status code (should be 200)
   - Response body
   - Time taken

### Step 6: Test with Minimal Settings
Use browser console:
```javascript
// Simplest possible test
fetch('/api/generate-recipes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    familySettings: {
      adults: 2,
      children: [],
      totalServings: 2,
      cuisines: ['italian'],
      glutenFreePreference: false,
      proteinFocus: false,
      allergies: [],
      avoidFoods: [],
      favoriteIngredients: [],
      budgetPerMeal: { min: 15, max: 20 },
      maxCookTime: { weeknight: 30, weekend: 45 },
      batchCooking: { enabled: false, frequency: 'none', preferredDay: 'sunday' },
      varietyLevel: 3,
      leftoverFriendly: false,
      lastUpdated: new Date().toISOString()
    },
    numberOfRecipes: 1  // Just 1 recipe for quick test
  })
})
.then(async r => {
  console.log('Status:', r.status);
  const data = await r.json();
  console.log('Data:', data);
  return data;
})
.catch(e => console.error('Error:', e));
```

## Expected Output

### Successful Generation

**Browser Console:**
```
🤖 [1/5] Starting AI meal plan generation...
✅ [2/5] Family settings loaded: { servings: 4, cuisines: ['mexican', 'italian'], budgetRange: '$15-$20' }
📡 [3/5] Calling API...
📥 [4/5] API response status: 200 OK
📦 [4/5] API response data: { success: true, recipes: [...], count: 7 }
✅ [5/5] Generated recipes: 7 recipes
Recipe titles: ['Chicken Tacos', 'Pasta Carbonara', ...]
🎉 AI generation complete! Total cost: 87.50
```

**Server Terminal:**
```
📥 Recipe generation request: { numberOfRecipes: 7, cuisines: ['mexican', 'italian'], servings: 4 }
🤖 Generating recipes with Gemini...
📝 Request: { numberOfRecipes: 7, cuisines: ['mexican', 'italian'], servings: 4 }
✅ Gemini response received
📄 Raw response length: 8234
✅ Generated 7 valid recipes
✅ Successfully generated recipes: 7
```

## Manual API Key Verification

Visit Google AI Studio to verify your key:
1. Go to https://aistudio.google.com/app/apikey
2. Check if key is listed
3. Click "Test" to verify it works
4. Check quota usage (should be well under 1,500/day)

## Still Not Working?

1. **Copy all console logs** (browser + server)
2. **Check error messages** - they usually indicate the exact problem
3. **Try the test endpoint first**: `/api/test-gemini`
4. **Verify family settings** are saved at `/settings`
5. **Check API quotas** at https://aistudio.google.com

## Contact Info for Debugging

If you're still stuck, collect:
- Browser console logs (all messages)
- Server terminal output
- Network tab screenshot showing the API request/response
- Your `.env.local` (hide the actual key value)
