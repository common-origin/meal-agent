/**
 * AI Prompt Generation for Recipe Suggestions
 * 
 * This module creates prompts for Gemini to generate personalized weekly meal plans
 * based on family settings, dietary preferences, and constraints.
 */

import type { FamilySettings } from '../types/settings';

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

Your task is to suggest recipes that match the user's family settings, dietary requirements, and time constraints while adhering to established cooking principles.

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

CRITICAL COOKING PRINCIPLES:
- Each recipe MUST be grounded in ONE specific cuisine or cooking style (Italian, Thai, Mexican, etc.)
- DO NOT mix cuisines or cooking styles within a single recipe (e.g., no "Thai curry pasta" or "Mexican-Asian fusion")
- Use only ingredients and flavor combinations authentic to that cuisine's culinary tradition
- Ensure complementary flavors based on established cooking theory:
  * Herbs/spices should be traditional for that cuisine
  * Cooking methods should match the cuisine (e.g., wok for Chinese, tagine for Moroccan)
  * Flavor profiles should be cohesive (sweet/salty/sour/bitter/umami balance)
- Respect traditional ingredient pairings and avoid jarring combinations

RECIPE QUALITY RULES:
- Return ONLY valid JSON, no markdown, no code blocks, no extra text
- Keep instructions SHORT (3-5 steps max per recipe)
- Keep ingredient lists CONCISE (8-12 ingredients max)
- Use brief ingredient names
- All times in minutes, costs in dollars
- COMPLETE THE JSON - don't cut off mid-response
- Each recipe should be practical and actually work when cooked`;
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
- Servings needed: ${familySettings.totalServings} (${familySettings.adults} adults, ${familySettings.children.length} children aged ${familySettings.children.map(c => c.age).join(', ')})

CUISINE PREFERENCES:
- Preferred cuisines: ${cuisineList}
- IMPORTANT: Each recipe must stay strictly within ONE cuisine. Do not mix cuisines or create fusion dishes.
- Use only authentic ingredients and techniques for each cuisine type.`;

  if (familySettings.preferredChef) {
    prompt += `\n- Recipe inspiration: Generate recipes in the authentic style of ${familySettings.preferredChef}'s traditional approach`;
  }

  prompt += `\n\nDIETARY REQUIREMENTS:`;

  if (familySettings.glutenFreePreference) {
    prompt += `\n- Prefer gluten-free options when possible`;
  }
  
  if (familySettings.proteinFocus) {
    prompt += `\n- Focus on high-protein meals (at least 20g protein per serving)`;
  }

  if (familySettings.allergies.length > 0) {
    prompt += `\n- MUST AVOID (allergies): ${familySettings.allergies.join(', ')}`;
  }

  if (familySettings.avoidFoods.length > 0) {
    prompt += `\n- Avoid these foods: ${familySettings.avoidFoods.join(', ')}`;
  }

  if (familySettings.favoriteIngredients.length > 0) {
    prompt += `\n- Try to include: ${familySettings.favoriteIngredients.join(', ')}`;
  }

  // Add pantry items section with priority based on preference
  if (pantryItems && pantryItems.length > 0) {
    const preferenceLevel = familySettings.pantryPreference || 'hard';
    
    if (preferenceLevel === 'hard') {
      prompt += `\n\nPANTRY/FRIDGE ITEMS (HIGH PRIORITY - MUST USE):
- The following ingredients are already available: ${pantryItems.join(', ')}
- PRIORITIZE recipes that use these ingredients to reduce waste
- Try to incorporate as many of these items as possible into the weekly plan`;
    } else {
      prompt += `\n\nPANTRY/FRIDGE ITEMS (LOW PRIORITY - CONSIDER IF SUITABLE):
- Available ingredients: ${pantryItems.join(', ')}
- Consider using these if they fit well with the meal plan
- Don't force them if they don't suit the cuisine or preferences`;
    }
  }

  prompt += `\n\nCOOKING THEORY & FLAVOR PRINCIPLES:
- Ensure flavor balance: sweet, salty, sour, bitter, umami (appropriate to the cuisine)
- Use complementary herbs and spices that belong to the chosen cuisine
- Match cooking techniques to the cuisine (e.g., stir-fry for Asian, slow-braise for French)
- Create cohesive dishes where all ingredients work together harmoniously
- NO fusion or mixing of cuisines in a single dish

TIME & BUDGET CONSTRAINTS:
- Maximum cooking time: ${maxTime} minutes (total time including prep)
- Budget per meal: $${familySettings.budgetPerMeal.min}-$${familySettings.budgetPerMeal.max}
- Servings: ${familySettings.totalServings}`;

  if (familySettings.leftoverFriendly) {
    prompt += `\n- Recipes should make good leftovers`;
  }

  if (familySettings.batchCooking.enabled) {
    prompt += `\n- Family does batch cooking ${familySettings.batchCooking.frequency}, so recipes that scale well are preferred`;
  }

  prompt += `\n\nKID-FRIENDLY REQUIREMENTS:`;
  
  if (familySettings.children.length > 0) {
    const ages = familySettings.children.map(c => c.age);
    const hasYoungKids = ages.some(age => age < 8);
    
    if (hasYoungKids) {
      prompt += `\n- Make recipes kid-friendly for ages ${ages.join(', ')}`;
      prompt += `\n- Avoid overly spicy or complex flavors`;
      prompt += `\n- Include familiar ingredients children will eat`;
    }
  }

  if (excludeRecipeIds && excludeRecipeIds.length > 0) {
    prompt += `\n\nVARIETY:
- Avoid repeating similar recipes to these recently used: ${excludeRecipeIds.slice(0, 10).join(', ')}
- Ensure variety in protein sources, cuisines, and cooking methods`;
  }

  prompt += `\n\nIMPORTANT VALIDATION CHECKLIST:
Before returning each recipe, verify:
✓ Recipe uses ingredients from ONLY ONE cuisine tradition
✓ Flavors are complementary and balanced according to cooking theory
✓ Cooking techniques match the cuisine style
✓ No inappropriate fusion or mixing of culinary traditions
✓ All ingredients work together harmoniously
✓ Instructions are brief (3-5 steps per recipe)
✓ Ingredients are concise (8-12 per recipe)
✓ Recipe is practical and will actually work when cooked
✓ JSON is COMPLETE with all brackets closed

Generate ${numberOfRecipes} cuisine-authentic recipes as COMPLETE, VALID JSON only.`;

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

  return `Generate 1 ${cuisine} dinner recipe for ${familySettings.totalServings} servings.
- Maximum cooking time: ${maxTime} minutes
- Budget: $${familySettings.budgetPerMeal.min}-$${familySettings.budgetPerMeal.max}
${familySettings.glutenFreePreference ? '- Gluten-free preferred' : ''}
${familySettings.proteinFocus ? '- High protein (20g+ per serving)' : ''}
${familySettings.children.length > 0 ? `- Kid-friendly for ages ${familySettings.children.map(c => c.age).join(', ')}` : ''}

Return as JSON only (no markdown).`;
}
