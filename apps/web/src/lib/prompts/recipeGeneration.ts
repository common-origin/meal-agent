/**
 * AI Prompt Generation for Recipe Suggestions
 * 
 * This module creates prompts for Gemini to generate personalized weekly meal plans
 * based on family settings, dietary preferences, and constraints.
 */

import type { FamilySettings } from '../types/settings';
import { getCurrentSeason, getSeasonalDescription, type Hemisphere } from '../seasonal';

export interface RecipeGenerationRequest {
  familySettings: FamilySettings;
  numberOfRecipes: number;
  excludeRecipeIds?: string[]; // Recipes to avoid (for variety)
  specificDays?: ('weeknight' | 'weekend')[]; // If generating specific days
  pantryItems?: string[]; // Ingredients already available
}

/**
 * Build the system prompt that defines Gemini's role and output format
 */
export function buildSystemPrompt(): string {
  return `You are an expert chef and meal planning assistant with deep knowledge of culinary traditions, flavor theory, and cooking techniques.

Your task is to suggest recipes that match the user's family settings, dietary requirements, and time and budget constraints while adhering to established cooking principles.

You must respond ONLY with valid JSON in this exact format:
{
  "recipes": [
    {
      "name": "Recipe Name",
      "cuisine": "cuisine_type",
      "totalTime": 30,
      "servings": 4,
      "ingredients": [
        { "name": "ingredient name", "qty": "500", "unit": "g" }
      ],
      "instructions": ["Step 1", "Step 2"],
      "tags": ["quick"],
      "estimatedCost": 18
    }
  ]
}

CUISINE & FUSION RULES:
- Each recipe must have ONE clear primary cuisine (e.g., Italian, Thai, Mexican).
- You may only use cross-cuisine or "fusion" ideas if they are WELL-KNOWN, established dish archetypes that real home cooks already make (e.g., teriyaki chicken burgers, Korean fried chicken tacos, Mediterranean chicken bowls).
- Do NOT invent bizarre or unrealistic fusions (e.g., massaman carbonara, laksa bolognese).
- Ingredients, flavour profiles, and techniques should stay cohesive and believable for the chosen cuisine or fusion family.
- Clearly reflect any fusion in the "name" and appropriate "tags" (e.g., "fusion", "Japanese-inspired").

SUPERMARKET REALISM (AUSTRALIA / COLES-STYLE):
- Use everyday ingredients that are realistically available at a major Australian supermarket (like Coles or Woolworths).
- Prefer common pack sizes (e.g., 500 g mince, 400 g canned beans, 200–300 ml sauces, 200 g cheese blocks).
- Avoid extremely niche, restaurant-only, or hard-to-find ingredients unless they are widely available in Australian supermarkets.
- If an ingredient would be hard to source, choose a more common substitute that keeps the recipe delicious and faithful to its cuisine.

COOKING THEORY & FLAVOUR PRINCIPLES:
- Ensure flavour balance: sweet, salty, sour, bitter, and umami appropriate to the cuisine.
- Use herbs and spices that are traditional or strongly associated with the chosen cuisine.
- Match cooking techniques to the cuisine (e.g., stir-fry in a wok for Chinese, slow-braise or roast for French/Italian, curry simmer for Indian/Thai).
- Create cohesive dishes where all ingredients work together harmoniously.
- Respect traditional ingredient pairings and avoid jarring combinations.

INSTRUCTION STYLE (MEAL KIT):
- Write instructions in a meal-kit style: clear, numbered steps in logical order.
- Use 4–7 steps per recipe (enough detail for reliability, but not walls of text).
- Start with a prep step (e.g., preheat oven, boil water, chop vegetables).
- Group tasks efficiently to minimise dirty dishes and idle time.
- Include approximate timings and doneness cues (e.g., "cook 3–4 minutes until golden").

LOCATION & SEASONALITY:
- The user prompt will provide their location (city, country, hemisphere) for ingredient availability and seasonal awareness.
- If no location is specified in the user prompt, assume Melbourne, Australia (Southern Hemisphere) as the default.
- Prefer ingredients that are in season for the current month in that location when they make sense for the chosen cuisine.
- It is acceptable to use out-of-season ingredients when needed, but seasonal substitutions are preferred when they enhance the dish.

RECIPE QUALITY & SAFETY RULES:
- Return ONLY valid JSON, with no markdown, no code blocks, and no extra text.
- Use 4–7 clear, numbered instruction steps per recipe.
- Keep ingredient lists concise: around 8–12 core ingredients per recipe (basic staples like oil, salt, and pepper may be in addition).
- Use brief, generic ingredient names that can be mapped to supermarket products (e.g., "chicken thigh", "red onion", "soy sauce").
- All times must be in minutes, and all costs in whole dollars.
- Use reasonable, realistic quantities for ingredients; avoid excessive salt or sugar per person that would be a health concern.
- COMPLETE THE JSON – do not cut off mid-response.
- Each recipe must be practical, cookable by a home cook, and likely to taste good.

CHEF VALIDATION CHECKLIST (INTERNAL BEFORE RETURNING JSON):
Before returning each recipe, mentally verify:
- Seasoning: Salt and seasoning levels are appropriate and not excessive for the number of servings.
- Balance: There is enough acid, fat, and aromatics to make the dish flavourful and balanced for the cuisine.
- Texture: There is at least some attention to texture contrast (e.g., creamy vs crunchy, soft vs crisp) where appropriate.
- Doneness & safety: Proteins and starches will be safely and fully cooked within the given times (no raw chicken, no crunchy rice).
- Cohesion: Ingredients, techniques, and flavours all make sense together for the chosen cuisine or acceptable fusion style.
- Complexity: Total effort matches the implied context (e.g., simpler for busy weeknights, optionally more involved at weekends).`;
}


/**
 * Build the user prompt with specific family requirements
 */
export function buildRecipeGenerationPrompt(request: RecipeGenerationRequest): string {
  const { familySettings, numberOfRecipes, excludeRecipeIds, specificDays, pantryItems } = request;
  
  const cuisineList = familySettings.cuisines.length > 0 
    ? familySettings.cuisines.join(', ')
    : 'any cuisine';
  
  const dayType = specificDays && specificDays.length > 0
    ? specificDays[0]
    : 'mixed weeknight and weekend';
  
  const maxTime = dayType === 'weekend' 
    ? familySettings.maxCookTime.weekend
    : familySettings.maxCookTime.weeknight;

  let prompt = `Generate ${numberOfRecipes} ${dayType === 'weekend' ? 'weekend' : 'weeknight'} dinner recipes with these requirements:

FAMILY DETAILS:
- Servings needed: ${familySettings.totalServings} (${familySettings.adults} adults, ${familySettings.children.length} children aged ${familySettings.children.map(c => c.age).join(', ')})`;

  prompt += `

CUISINE PREFERENCES:
- Preferred cuisines: ${cuisineList}
- Each recipe must clearly belong to ONE primary cuisine from this list.
- Cross-cuisine or fusion recipes are only allowed when they reflect a well-known, established dish archetype that real home cooks already make (e.g., "Korean fried chicken burgers", "Mediterranean chicken bowls").
- Do NOT invent strange or unrealistic fusions. Ingredients and flavours must stay cohesive and believable.`;

  if (familySettings.preferredChef) {
    prompt += `\n- Recipe inspiration: Generate recipes in the approachable, home-cook-friendly style of ${familySettings.preferredChef}'s traditional approach (not restaurant-level complexity).`;
  }

  prompt += `

DIETARY REQUIREMENTS:`;

  if (familySettings.glutenFreePreference) {
    prompt += `\n- Prefer gluten-free options when possible.`;
  }
  
  if (familySettings.proteinFocus) {
    prompt += `\n- Focus on high-protein meals (at least 20 g protein per serving).`;
  }

  if (familySettings.allergies.length > 0) {
    prompt += `\n- MUST AVOID (allergies): ${familySettings.allergies.join(', ')}.`;
  }

  if (familySettings.avoidFoods.length > 0) {
    prompt += `\n- Avoid these foods: ${familySettings.avoidFoods.join(', ')}.`;
  }

  if (familySettings.favoriteIngredients.length > 0) {
    prompt += `\n- Try to include these favourite ingredients where they suit the cuisine and recipe: ${familySettings.favoriteIngredients.join(', ')}.`;
  }

  prompt += `

USER COOKING & FLAVOUR PROFILE:`;

  // Spice tolerance
  const spiceDescriptions = {
    very_mild: 'no spice at all - completely mild dishes only',
    mild: 'mild heat only - a gentle kick is acceptable',
    medium: 'moderate heat - can handle medium-spiced dishes',
    hot: 'loves spicy food - bring the heat',
    loves_hot: 'loves extra hot food - the spicier the better'
  };
  prompt += `\n- Spice tolerance: ${spiceDescriptions[familySettings.spiceTolerance]}.`;

  // Cooking skill
  const skillDescriptions = {
    beginner: 'new to cooking - keep techniques simple and instructions very clear',
    intermediate: 'comfortable with basic cooking - can handle standard home-cooking techniques',
    confident_home_cook: 'confident home cook - comfortable with most techniques and multi-step recipes',
    advanced: 'advanced cook - enjoys challenges and can handle complex techniques'
  };
  prompt += `\n- Cooking skill level: ${skillDescriptions[familySettings.cookingSkill]}.`;

  // Effort preference
  const effortDescriptions = {
    minimal_clean_up: 'prefers minimal clean-up - favor one-pot meals and simple prep',
    balanced: 'balanced effort - willing to use a few pots/pans for better results',
    happy_to_spend_time_on_weekends: 'happy to spend extra time on weekends - can handle more involved recipes'
  };
  prompt += `\n- Effort preference: ${effortDescriptions[familySettings.effortPreference]}.`;

  // Flavor profile description
  if (familySettings.flavorProfileDescription) {
    prompt += `\n- Flavor preferences: ${familySettings.flavorProfileDescription}.`;
  }

  // Disliked patterns
  if (familySettings.dislikedPatterns && familySettings.dislikedPatterns.length > 0) {
    prompt += `\n- Avoid these patterns: ${familySettings.dislikedPatterns.join(', ')}.`;
  }

  // Disliked recipe IDs
  if (familySettings.dislikedRecipeIds && familySettings.dislikedRecipeIds.length > 0) {
    prompt += `\n- Previously disliked recipe IDs (avoid similar styles): ${familySettings.dislikedRecipeIds.slice(0, 5).join(', ')}.`;
  }

  // Add pantry items section with priority based on preference
  if (pantryItems && pantryItems.length > 0) {
    const preferenceLevel = familySettings.pantryPreference || 'hard';
    
    if (preferenceLevel === 'hard') {
      prompt += `

PANTRY/FRIDGE ITEMS (HIGH PRIORITY - MUST USE):
- The following ingredients are already available: ${pantryItems.join(', ')}
- PRIORITISE recipes that use these ingredients to reduce waste.
- Try to incorporate as many of these items as possible into the weekly plan.
- When possible, choose cuisines or dishes where these pantry items are traditionally or commonly used.`;
    } else {
      prompt += `

PANTRY/FRIDGE ITEMS (LOW PRIORITY - CONSIDER IF SUITABLE):
- Available ingredients: ${pantryItems.join(', ')}
- Consider using these if they fit well with the meal plan and chosen cuisines.
- Never force a strange or unrealistic combination just to use them.`;
    }
  }

  prompt += `

COOKING THEORY & FLAVOUR PRINCIPLES:
- Ensure flavour balance: sweet, salty, sour, bitter, and umami appropriate to the cuisine.
- Use complementary herbs and spices that belong to the chosen cuisine.
- Match cooking techniques to the cuisine (e.g., stir-fry for Asian, slow-braise for French or Italian).
- Create cohesive dishes where all ingredients work together harmoniously.

TIME & BUDGET CONSTRAINTS:
- Maximum cooking time: ${maxTime} minutes (total time including prep).
- Budget per meal: $${familySettings.budgetPerMeal.min}-$${familySettings.budgetPerMeal.max}.
- Servings: ${familySettings.totalServings}.`;

  if (familySettings.leftoverFriendly) {
    prompt += `\n- Recipes should make good leftovers (reheat well and still taste good).`;
  }

  if (familySettings.batchCooking.enabled) {
    prompt += `\n- Family does batch cooking ${familySettings.batchCooking.frequency}, so recipes that scale well and store well are preferred.`;
  }

  prompt += `

KID-FRIENDLY REQUIREMENTS:`;

  if (familySettings.children.length > 0) {
    const ages = familySettings.children.map(c => c.age);
    const hasYoungKids = ages.some(age => age < 8);
    
    if (hasYoungKids) {
      prompt += `\n- Make recipes kid-friendly for ages ${ages.join(', ')}.`;
      prompt += `\n- Avoid overly spicy, bitter, or very complex flavours for younger children.`;
      prompt += `\n- Prefer familiar ingredients and formats that children are likely to eat (e.g., mild sauces, simple textures).`;
    }
  }

  prompt += `

LOCATION & SEASONALITY:`;

  // Use dynamic location from settings
  const hemisphere = (familySettings.location?.hemisphere || 'southern') as Hemisphere;
  const locationStr = familySettings.location && familySettings.location.city && familySettings.location.country
    ? `${familySettings.location.city}, ${familySettings.location.country} (${familySettings.location.hemisphere === 'southern' ? 'Southern' : 'Northern'} Hemisphere)`
    : 'Melbourne, Australia (Southern Hemisphere)';
  
  const currentSeason = getCurrentSeason(hemisphere);
  const seasonalDesc = getSeasonalDescription(hemisphere);
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  
  prompt += `\n- The family is located in ${locationStr}.`;
  prompt += `\n- Current month: ${currentMonth} (${currentSeason} season).`;
  prompt += `\n- PRIORITISE seasonal ingredients for ${currentSeason} in the ${hemisphere} hemisphere.`;
  prompt += `\n- Prefer ingredients that are in season for this time of year when they make sense for the chosen cuisine.`;
  prompt += `\n- Seasonal substitutions are strongly encouraged if they keep the recipe delicious and aligned with the cuisine.`;
  prompt += `\n- Examples of ${currentSeason} ingredients (use as inspiration where appropriate): Consider what's naturally fresh and abundant during ${currentMonth} in ${hemisphere === 'southern' ? 'Australia' : 'the Northern Hemisphere'}.`;

  if (excludeRecipeIds && excludeRecipeIds.length > 0) {
    prompt += `

VARIETY:
- Avoid repeating similar recipes to these recently used recipe IDs: ${excludeRecipeIds.slice(0, 10).join(', ')}.`;
  }

  prompt += `

WEEKLY VARIETY RULES:
- Across all ${numberOfRecipes} recipes, aim for a mix of cuisines from the preferred list (where more than one cuisine is selected).
- Use a variety of primary proteins across the week (for example: poultry, red meat, seafood, tofu, legumes), within budget and preferences.
- Vary cooking methods across the plan (e.g., stir-fry, roast, grill, braise) to keep meals interesting.
- Balance simpler "quick weeknight" recipes with optionally more involved recipes based on the user's effort preference and skill level.
- Avoid repeating very similar flavour profiles (for example, avoid three tomato-based pasta dishes in one week).`;

  prompt += `

MEAL KIT STYLE EXPECTATIONS:
- Structure each recipe like a meal kit card with clear, numbered steps.
- Start with a prep-focused step, followed by cooking steps that are sequenced efficiently.
- Aim to minimise unnecessary pots, pans, and clean-up while still producing great flavour.`;

  prompt += `

IMPORTANT VALIDATION CHECKLIST:
Before returning each recipe, verify:
✓ The recipe has ONE clear primary cuisine (and only uses fusion if it is a well-known, established archetype).
✓ Flavours are complementary and balanced according to cooking theory.
✓ Cooking techniques match the cuisine style.
✓ All ingredients work together harmoniously and are realistically available at a supermarket like Coles.
✓ Instructions are 4–7 clear, numbered steps.
✓ Ingredient lists are concise (around 8–12 core ingredients, plus basic staples).
✓ The recipe is practical for a home cook, with realistic times and quantities.
✓ JSON is COMPLETE with all brackets closed.

Generate ${numberOfRecipes} realistic, family-friendly recipes as COMPLETE, VALID JSON only.`;

  return prompt;
}

/**
 * Build a simpler prompt for single recipe generation
 */
export function buildSingleRecipePrompt(
  cuisine: string,
  familySettings: FamilySettings,
  dayType: 'weeknight' | 'weekend' = 'weeknight'
): string {
  const maxTime = dayType === 'weekend' 
    ? familySettings.maxCookTime.weekend
    : familySettings.maxCookTime.weeknight;

  // Build spice hint
  const spiceHints = {
    very_mild: 'no spice',
    mild: 'mild spice only',
    medium: 'moderate spice ok',
    hot: 'make it spicy',
    loves_hot: 'extra hot'
  };
  const spiceHint = spiceHints[familySettings.spiceTolerance];

  // Build skill hint
  const skillHints = {
    beginner: 'simple techniques',
    intermediate: 'standard home cooking',
    confident_home_cook: 'can handle complexity',
    advanced: 'advanced techniques ok'
  };
  const skillHint = skillHints[familySettings.cookingSkill];

  // Build effort hint
  const effortHints = {
    minimal_clean_up: 'minimal clean-up',
    balanced: 'reasonable effort',
    happy_to_spend_time_on_weekends: 'can be more involved'
  };
  const effortHint = effortHints[familySettings.effortPreference];

  return `Generate 1 ${cuisine} dinner recipe for ${familySettings.totalServings} servings.
- Context: ${dayType === 'weekend' ? 'weekend' : 'busy weeknight'} meal.
- Maximum cooking time: ${maxTime} minutes.
- Budget: $${familySettings.budgetPerMeal.min}-$${familySettings.budgetPerMeal.max}.
${familySettings.glutenFreePreference ? '- Gluten-free preferred.\n' : ''}${familySettings.proteinFocus ? '- High protein (20 g+ per serving).\n' : ''}${familySettings.children.length > 0 ? `- Kid-friendly for ages ${familySettings.children.map(c => c.age).join(', ')}.\n` : ''}- Spice level: ${spiceHint}; Skill: ${skillHint}; Effort: ${effortHint}.
- Structure instructions in 4–7 clear, numbered, meal-kit-style steps.
- Return as JSON only (no markdown, no code fences).`;
}

