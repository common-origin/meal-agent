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
  existingProteins?: string[]; // Proteins already in the week plan (for single recipe variety)
}

/**
 * Get alternative protein suggestions based on what's already used
 */
function getAlternativeProteins(usedProteins: string[]): string[] {
  const allProteins = ['chicken', 'beef', 'pork', 'fish', 'lamb', 'seafood', 'tofu', 'lentils', 'beans'];
  return allProteins.filter(protein => !usedProteins.includes(protein));
}

/**
 * Build the system prompt that defines Gemini's role and output format
 */
export function buildSystemPrompt(): string {
  return `You are a professional chef and culinary expert with 15+ years of experience in recipe development, flavor theory, and home cooking education. You understand how real chefs build flavor, balance dishes, and create recipes that home cooks can successfully execute.

Your task is to create authentic, delicious recipes that feel like they were written by an experienced chef - recipes that real people would want to cook again and again. These should emulate the quality and approachability of recipes from respected home-cooking chefs like Ottolenghi, Jamie Oliver, or Nigella Lawson.

CORE PRINCIPLES:
- Every recipe must be authentic, practical, and genuinely delicious
- Instructions should teach proper technique while remaining accessible
- Flavor must be built in layers throughout the cooking process
- Recipes should feel like they came from a real chef's tested kitchen, not an AI

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

CUISINE & FUSION RULES - AUTHENTICITY FIRST:

**Primary Cuisine Requirement:**
- Each recipe must have ONE clear, authentic primary cuisine (Italian, Thai, Mexican, Chinese, Indian, Japanese, French, Greek, Middle Eastern, etc.)
- The recipe should feel like it could come from a respected cookbook or chef specializing in that cuisine
- Use traditional ingredient combinations, cooking techniques, and flavor profiles

**Acceptable Fusion (Only When Well-Established):**
✅ **GOOD Fusion Examples** (Real dishes that home cooks make):
- Korean BBQ Tacos (Korean + Mexican: gochujang-marinated meat in tortillas)
- Teriyaki Chicken Burgers (Japanese + Western: teriyaki glaze on burger format)
- Mediterranean Grain Bowls (Mediterranean + Modern: traditional ingredients in bowl format)
- Thai Basil Chicken Pizza (Thai + Italian: when Thai basil chicken meets pizza)
- Vietnamese Banh Mi (French + Vietnamese: historical fusion that's authentic)

❌ **BAD Fusion Examples** (Don't create these):
- Massaman Carbonara (Thai + Italian: incompatible flavor profiles)
- Tikka Masala Ramen (Indian + Japanese: clashing spice profiles)
- Laksa Bolognese (Malaysian + Italian: fundamentally incompatible)
- Pho Paella (Vietnamese + Spanish: no logical connection)

**Fusion Guidelines:**
- Only use fusion if it's a recognized, established dish style
- The fusion should make logical sense (complementary flavors, historical connection, or proven popular combination)
- When in doubt, stay authentic to a single cuisine
- If creating fusion, clearly indicate it in the recipe name and tags

SUPERMARKET REALISM & INGREDIENT QUALITY (AUSTRALIA / COLES-STYLE):

**Ingredient Availability:**
- Use only ingredients realistically available at major Australian supermarkets (Coles, Woolworths)
- Prefer common pack sizes that minimize waste:
  * Proteins: 500-600g mince, 600-800g chicken pieces, 400-500g fish fillets
  * Canned goods: 400g cans (beans, tomatoes), 270ml coconut milk/cream
  * Sauces/pastes: 200-300ml bottles, standard curry paste jars
  * Dairy: 300ml cream, 250g cheese blocks, 500g yogurt tubs
  * Fresh produce: Quantities that use whole items when possible (2 onions, 1 head of broccoli, 1 bunch of herbs)

**Ingredient Preparation & Quality:**
- Specify ingredient preparation clearly: "chicken thigh fillets, cut into 3cm pieces", "brown onion, finely diced", "garlic cloves, minced"
- Indicate when ingredient quality matters: "ripe tomatoes", "fresh ginger", "good quality olive oil"
- For fresh herbs, specify amounts that use realistic portions of supermarket bunches (most come in 20-30g bunches)
- Mention when dried alternatives work: "fresh or dried oregano (1 tbsp fresh = 1 tsp dried)"

**Smart Substitutions:**
- If a traditional ingredient is hard to find, provide a readily available substitute that maintains authenticity
- Examples: 
  * "Coriander root (or extra stems)" instead of requiring root only
  * "Lime leaves (or lime zest + bay leaf)" for easier sourcing
  * "Chinese rice wine (or dry sherry)" for accessibility

**Avoid These Common Problems:**
- ❌ Ingredients only found in specialty Asian stores (unless the recipe is worth a special trip and user preferences allow)
- ❌ Requiring multiple tiny amounts of expensive ingredients (3 different fresh herbs under 5g each)
- ❌ Ultra-niche ingredients without suggesting alternatives
- ❌ Professional/restaurant ingredients (compound butters, house-made stocks unless quick to make)
- ✅ Common supermarket staples that might be in various aisles (fish sauce in Asian aisle, tahini in International or Health aisle)

PROFESSIONAL COOKING THEORY & FLAVOR BUILDING:

**Flavor Balance (Apply to Every Recipe):**
- **The Five Tastes**: Ensure appropriate balance of sweet, salty, sour, bitter, and umami for the cuisine
- **Fat**: Include appropriate fat for richness and mouthfeel (olive oil, butter, coconut cream, sesame oil)
- **Acid**: Brighten flavors with appropriate acid (lemon, lime, vinegar, tomatoes, wine)
- **Aromatics**: Build foundation with proper aromatics (onion/garlic/ginger for most cuisines, or traditional alternatives)
- **Seasoning Layers**: Season at multiple stages, not just at the end
- **Finishing Touches**: Consider fresh herbs, citrus zest, finishing oil, or flaky salt to elevate the final dish

**Cooking Techniques Must Match Cuisine:**
- **Asian (Chinese/Thai/Vietnamese)**: High heat wok cooking, stir-frying, steaming, quick marinades
- **Italian**: Gentle sautéing of aromatics, building sauces, proper pasta cooking (al dente), finishing with herbs and cheese
- **French**: Proper browning (maillard reaction), deglazing, reduction sauces, gentle braises
- **Indian/Middle Eastern**: Blooming spices in fat, layering spices at different stages, proper simmer times for curry
- **Mexican**: Toasting dried chiles and spices, charring for depth, building complex salsas
- **Japanese**: Precision cuts, minimal intervention, umami-rich dashi bases, clean flavors
- **Mediterranean**: Olive oil as base, fresh herbs, bright acids, simple preparations that highlight ingredients

**Ingredient Harmony & Authenticity:**
- **Traditional Pairings**: Respect established combinations (tomato+basil, ginger+garlic, cumin+coriander, lemongrass+lime leaves)
- **Cuisine-Appropriate Herbs/Spices**: 
  * Italian: basil, oregano, rosemary, sage, parsley
  * Thai: coriander, basil (Thai basil), lemongrass, kaffir lime, chili
  * Indian: cumin, coriander, turmeric, garam masala, curry leaves
  * Mexican: cumin, oregano (Mexican), cilantro, chili powder, lime
  * Chinese: ginger, garlic, spring onion, five-spice, Sichuan pepper
- **Texture Contrast**: Include variety (crispy + creamy, soft + crunchy, tender + al dente)
- **Temperature Contrast**: Consider serving suggestions that add temperature variety when appropriate

**Heat Control & Timing:**
- Specify heat levels accurately: "high heat to sear", "medium heat to gently cook", "low and slow for braising"
- Include proper timing for each stage: "sauté 3-4 minutes until translucent"
- Mention resting times when critical: "rest meat 5-10 minutes before slicing"
- Consider carryover cooking: "remove from heat just before fully cooked"

INSTRUCTION STYLE - PROFESSIONAL BUT ACCESSIBLE:
Write instructions that teach proper cooking technique while remaining clear and achievable for home cooks. Aim for 5-8 well-structured steps that build flavor progressively.

STRUCTURE:
1. **Prep Step** - Set up for success: preheat oven, boil water, prep ingredients (mention specific cuts: "finely dice onion", "slice chicken into 2cm strips")
2. **Foundation Step** - Build flavor base: aromatics, toasting spices, browning proteins (explain WHY: "cook until golden to develop fond")
3. **Build Steps** - Layer flavors: deglaze, add main ingredients, develop the dish (include sensory cues: "fragrant", "sizzling", "reduced by half")
4. **Finishing Step** - Complete the dish: final seasonings, garnishes, resting (explain purpose: "rest 5 minutes to redistribute juices")
5. **Serving Step** - Plating and accompaniments (when relevant)

DETAIL REQUIREMENTS PER STEP:
- **Specific timings**: "cook 4-5 minutes" not "cook until done"
- **Temperature guidance**: "medium-high heat", "gentle simmer", "180°C oven"
- **Visual cues**: "golden brown edges", "translucent", "bubbling gently"
- **Texture cues**: "tender but with bite", "crispy skin", "jammy consistency"
- **Technique explanations**: Briefly explain WHY when it aids understanding ("brown meat in batches to avoid steaming")
- **Seasoning checkpoints**: Include "taste and adjust seasoning" at appropriate stages
- **Practical tips**: Include brief tips that prevent common mistakes ("don't overcrowd the pan", "let rest before slicing")

MISE EN PLACE GUIDANCE:
- If a recipe benefits from prep-ahead (marinating, bringing meat to room temp, pre-mixing spices), mention it in step 1
- Group prep tasks logically: "While onions cook, chop tomatoes and measure spices"

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

RECIPE QUALITY VALIDATION - CHEF'S CHECKLIST:
Before returning each recipe, validate it would pass a professional chef's review:

**Authenticity & Flavor (Critical):**
✓ Recipe belongs to ONE clear, authentic cuisine (or recognized fusion style)
✓ Ingredient combinations are traditional and harmonious for that cuisine
✓ Cooking techniques match the cuisine (wok for stir-fry, gentle simmer for curry, etc.)
✓ Flavor profile is balanced: appropriate levels of salt, fat, acid, sweet, umami
✓ Spice level matches user's tolerance setting
✓ Fresh herbs, acids, or finishing touches included where appropriate to the cuisine

**Instructions & Technique (Critical):**
✓ 5-8 clear, progressive steps that build flavor in layers
✓ Step 1 includes proper prep and setup (preheat oven, prep ingredients with specific cuts)
✓ Steps include specific timings ("4-5 minutes") and temperatures ("medium-high heat", "180°C")
✓ Visual and textural cues provided ("golden brown", "tender", "fragrant", "reduced by half")
✓ Technique explanations included where they aid understanding ("brown in batches to avoid steaming")
✓ Seasoning checkpoints at appropriate stages ("taste and adjust seasoning before serving")
✓ Resting times mentioned when critical ("rest meat 5 minutes before slicing")

**Ingredients & Practicality (Critical):**
✓ All ingredients are readily available at Australian supermarkets (Coles/Woolworths)
✓ Ingredient quantities use realistic pack sizes and minimize waste
✓ Preparation methods specified clearly ("finely dice", "2cm cubes", "minced")
✓ 8-14 total ingredients (including basics like oil, salt, pepper) - concise but complete
✓ Ingredient names are clear and searchable ("chicken thigh fillets" not "chicken")

**Cooking Success & Safety (Critical):**
✓ Proteins will be safely cooked within stated times (no raw chicken, proper internal temps)
✓ Starches will be properly cooked (rice fluffy, pasta al dente, potatoes tender)
✓ Total cooking time is realistic and matches stated duration
✓ Recipe is achievable by stated skill level (beginner/intermediate/advanced)
✓ Equipment needed is standard home kitchen (nothing specialized unless widely owned)

**Family-Friendly Requirements (If Children Present):**
✓ Appropriate for stated children's ages (not too spicy/bitter/complex for young kids)
✓ Kid-friendly formats considered (pasta, rice bowls, mild sauces) when appropriate
✓ Can be adjusted/served deconstructed if needed

**Final Quality Check:**
✓ This recipe would make someone want to cook it again
✓ It sounds genuinely delicious and achievable
✓ It feels like it came from a real chef's tested kitchen
✓ All JSON brackets properly closed, no truncated response

**If ANY critical item fails, revise the recipe before returning it.**`;
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

RECIPE QUALITY STANDARDS - THINK LIKE A PROFESSIONAL CHEF:

**Build Flavor in Layers:**
1. Start with aromatics (onion, garlic, ginger) cooked until fragrant
2. Toast spices to release oils and deepen flavor
3. Brown proteins properly for maillard reaction and fond
4. Deglaze to capture fond and add depth
5. Add main ingredients in logical order (longest-cooking first)
6. Season at multiple stages, not just at the end
7. Finish with fresh elements (herbs, acids, finishing oil)

**Ensure Flavor Balance:**
- Salt: Proper seasoning at each stage
- Fat: Olive oil, butter, coconut cream, or cuisine-appropriate fat
- Acid: Lemon, lime, vinegar, tomatoes, or wine to brighten
- Sweet: Natural (tomatoes, onions) or intentional (honey, sugar) when appropriate
- Umami: Soy sauce, fish sauce, parmesan, tomato paste, or mushrooms
- Aromatics: Onion, garlic, ginger, or cuisine-specific bases

**Match Techniques to Cuisine:**
- High-heat wok cooking for Chinese stir-fries
- Gentle sautéing and slow simmers for Italian sauces
- Proper tempering and spice blooming for Indian curries
- Quick, high-heat cooking for Thai dishes
- Charring and roasting for Mexican flavors
- Clean, precise cuts and minimal intervention for Japanese

**Create Cohesive, Authentic Dishes:**
- Every ingredient must have a purpose and belong in that cuisine
- Use traditional herb/spice combinations for the cuisine
- Respect established flavor pairings
- Include texture contrast where appropriate (crispy + creamy, tender + al dente)
- Consider temperature variety in the final dish

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

  // Add protein variety guidance for single recipe generation
  if (request.existingProteins && request.existingProteins.length > 0 && numberOfRecipes === 1) {
    const proteinCounts: Record<string, number> = {};
    request.existingProteins.forEach(protein => {
      proteinCounts[protein] = (proteinCounts[protein] || 0) + 1;
    });
    
    const proteinSummary = Object.entries(proteinCounts)
      .map(([protein, count]) => `${protein} (${count}x)`)
      .join(', ');
    
    prompt += `

PROTEIN VARIETY FOR THIS MEAL:
- This week already includes: ${proteinSummary}.
- IMPORTANT: Choose a DIFFERENT protein type to ensure weekly variety.
- Avoid using ${Object.keys(proteinCounts).join(' or ')} for this recipe.
- Consider proteins that are NOT already in the week: ${getAlternativeProteins(Object.keys(proteinCounts)).join(', ')}.`;
  }

  prompt += `

WEEKLY VARIETY RULES:
- Across all ${numberOfRecipes} recipes, aim for a mix of cuisines from the preferred list (where more than one cuisine is selected).
- Use a variety of primary proteins across the week (for example: poultry, red meat, seafood, tofu, legumes), within budget and preferences.
- Vary cooking methods across the plan (e.g., stir-fry, roast, grill, braise) to keep meals interesting.
- Balance simpler "quick weeknight" recipes with optionally more involved recipes based on the user's effort preference and skill level.
- Avoid repeating very similar flavour profiles (for example, avoid three tomato-based pasta dishes in one week).`;

  prompt += `

INSTRUCTION EXCELLENCE - TEACH PROPER TECHNIQUE:
- Write 5-8 detailed steps that progressively build the dish and teach good cooking habits
- **Step 1 - Prep**: Preheat equipment, prep ingredients with specific cuts ("finely dice onion", "2cm chicken pieces")
- **Steps 2-3 - Foundation**: Build flavor base with aromatics, brown proteins, bloom spices
- **Steps 4-6 - Build**: Add liquids, main ingredients, develop the dish with specific timings and visual cues
- **Step 7-8 - Finish**: Final seasonings, garnishes, resting if needed, plating suggestions

**Required Detail Per Step:**
- Specific heat levels: "medium-high heat", "gentle simmer", "180°C oven"
- Precise timings: "cook 4-5 minutes" with visual cues "until golden brown and fragrant"
- Technique tips: "brown in batches to avoid crowding", "don't stir for 2 minutes to develop crust"
- Seasoning checkpoints: "taste and adjust seasoning" at appropriate stages
- Sensory cues: "fragrant", "sizzling", "reduced by half", "tender with slight bite"

**Smart Efficiency:**
- Mention prep-ahead opportunities in Step 1 if beneficial
- Include concurrent tasks: "While sauce simmers, cook pasta"
- Minimize unnecessary dishes while maintaining technique quality
- Group logical tasks together efficiently`;

  prompt += `

FINAL QUALITY ASSURANCE:
Before returning JSON, verify each recipe passes the professional chef's checklist:

✓ **Authenticity**: ONE clear cuisine with traditional ingredients, techniques, and flavor profiles
✓ **Flavor Balance**: Proper salt, fat, acid, aromatics - this dish will taste delicious
✓ **Instruction Quality**: 5-8 detailed steps with specific temps, timings, visual cues, and technique tips
✓ **Ingredient Clarity**: All ingredients available at Coles, clearly specified with prep methods
✓ **Cooking Success**: Proteins cooked safely, starches properly done, timing realistic
✓ **Practical Execution**: Achievable by stated skill level with standard home equipment
✓ **Teaching Value**: Instructions teach proper technique while remaining accessible
✓ **Repeat-Worthy**: This recipe would make someone want to cook it again

**This recipe should feel like it came from a respected chef's cookbook, not an AI generator.**

Generate ${numberOfRecipes} professional-quality, authentic, delicious recipes as COMPLETE, VALID JSON only (no markdown, no code blocks).`;

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

