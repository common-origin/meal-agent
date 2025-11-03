# AI Recipe Generation Setup

## Overview

The meal agent uses Google's Gemini AI (free tier) to generate personalized weekly meal plans based on your family settings.

## Getting Your Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API key"**
4. Click **"Create API key"** (or use an existing one)
5. Copy the API key

## Configuration

1. Open `/apps/web/.env.local` in your project
2. Add your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. Save the file
4. Restart your development server

## Usage

### In the App

1. Go to `/settings` and configure your family preferences
2. Navigate to `/plan`
3. Click the **"✨ Generate with AI"** button
4. Wait 5-10 seconds while Gemini generates personalized recipes
5. Review and modify the generated meal plan

### API Endpoint

The generation endpoint is available at:

**POST** `/api/generate-recipes`

Request body:
```json
{
  "familySettings": {
    "adults": 2,
    "children": [{ "age": 5 }, { "age": 7 }],
    "totalServings": 4,
    "cuisines": ["mexican", "italian", "asian"],
    "glutenFreePreference": false,
    "proteinFocus": true,
    "budgetPerMeal": { "min": 15, "max": 20 },
    "maxCookTime": { "weeknight": 30, "weekend": 45 },
    // ... other settings
  },
  "numberOfRecipes": 7,
  "excludeRecipeIds": [] // Optional: avoid similar recipes
}
```

Response:
```json
{
  "success": true,
  "recipes": [
    {
      "id": "ai-chicken-tacos",
      "title": "Chicken Tacos",
      "timeMins": 25,
      "serves": 4,
      "ingredients": [...],
      "instructions": [...],
      "tags": ["mexican", "quick", "kid-friendly"],
      "costPerServeEst": 4.5
    }
    // ... more recipes
  ],
  "count": 7
}
```

## Features

- **Free Tier**: 1,500 requests per day (more than enough for personal use)
- **Fast**: Recipes generated in 5-10 seconds
- **Personalized**: Uses your family settings for:
  - Cuisine preferences
  - Dietary requirements (gluten-free, high protein, etc.)
  - Time constraints (weeknight vs weekend)
  - Budget per meal
  - Kid-friendly options based on children's ages
  - Batch cooking preferences

## Rate Limiting

The API has built-in rate limiting:
- **3 requests per minute** per IP address
- Prevents excessive API usage
- Returns HTTP 429 if exceeded

## Error Handling

Common errors and solutions:

### "GEMINI_API_KEY is not configured"
- Add your API key to `.env.local`
- Restart the development server

### "Rate limit exceeded"
- Wait 60 seconds before trying again
- Only generate when needed (not on every page refresh)

### "Failed to parse AI response"
- The AI sometimes returns invalid JSON
- Click "Generate" again to retry
- If persistent, check API quotas at [Google AI Studio](https://aistudio.google.com)

## Cost & Quotas

### Free Tier (Gemini 1.5 Flash)
- **Requests**: 1,500 per day
- **Rate**: 15 RPM (requests per minute)
- **Cost**: $0/month
- **Perfect for**: Personal/family use (4-8 generations per month)

### Paid Tier (if needed)
- **GPT-4o-mini alternative**: ~$1-2/month for similar usage
- **Claude alternative**: Free trial, then ~$1-2/month

## Technical Details

### Model Used
- **Model**: `gemini-1.5-flash`
- **Temperature**: 0.9 (creative but consistent)
- **Max tokens**: 8,192 (allows for detailed recipes)

### Prompt Engineering
- System prompt defines role and JSON output format
- User prompt includes all family preferences
- Validates required fields (name, ingredients, instructions)
- Ensures realistic cooking times and costs

### Recipe Validation
- Checks for required fields
- Normalizes ingredient units to match Recipe type
- Generates consistent IDs for AI recipes
- Falls back to sensible defaults (servings: 4, difficulty: medium)

## Troubleshooting

### Development Server Not Picking Up .env.local
1. Stop the dev server (Ctrl+C)
2. Run `pnpm dev` again
3. Verify the file is at `/apps/web/.env.local` (not root)

### API Returns Empty Recipes Array
- Check Gemini API status at [Google Cloud Status](https://status.cloud.google.com/)
- Verify API key is correct
- Check browser console for detailed error messages

### Recipes Don't Match Preferences
- Update your family settings at `/settings`
- The AI uses these settings in the prompt
- More specific preferences = better results

## Next Steps

Once AI generation is working:
1. **Test different cuisines** - Update settings and regenerate
2. **Adjust budget/time** - See how recipes change
3. **Add dietary restrictions** - Test gluten-free, high-protein, etc.
4. **Track history** (WO14) - Avoid recipe repetition
5. **Fine-tune prompts** - Adjust in `lib/prompts/recipeGeneration.ts`

## Support

For issues or questions:
- Check console logs (browser and server)
- Review Gemini API quotas at [AI Studio](https://aistudio.google.com)
- Test API connection: Call `testGeminiConnection()` in browser console
