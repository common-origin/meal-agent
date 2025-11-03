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
}

/**
 * Build the system prompt that defines Gemini's role and output format
 */
export function buildSystemPrompt(): string {
  return `You are a helpful meal planning assistant that suggests recipes based on family preferences.

Your task is to suggest recipes that match the user's family settings, dietary requirements, and time constraints.

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

CRITICAL RULES:
- Return ONLY valid JSON, no markdown, no code blocks, no extra text
- Keep instructions SHORT (3-5 steps max per recipe)
- Keep ingredient lists CONCISE (8-12 ingredients max)
- Use brief ingredient names
- All times in minutes, costs in dollars
- COMPLETE THE JSON - don't cut off mid-response`;
}

/**
 * Build the user prompt with specific family requirements
 */
export function buildRecipeGenerationPrompt(request: RecipeGenerationRequest): string {
  const { familySettings, numberOfRecipes, excludeRecipeIds, specificDays } = request;
  
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

DIETARY REQUIREMENTS:`;

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

  prompt += `\n\nTIME & BUDGET CONSTRAINTS:
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

  prompt += `\n\nIMPORTANT:
- Keep instructions brief (3-5 steps per recipe)
- Keep ingredients concise (8-12 per recipe)
- Make recipes practical and achievable
- COMPLETE THE JSON - ensure all brackets are closed

Generate ${numberOfRecipes} recipes as COMPLETE, VALID JSON only.`;

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
