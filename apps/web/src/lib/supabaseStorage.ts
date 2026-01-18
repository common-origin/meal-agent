/**
 * Supabase Storage Layer
 * 
 * This replaces localStorage with PostgreSQL database storage.
 * All data is scoped to the user's household for proper isolation.
 */

import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { FamilySettings } from './types/settings';
import type { Recipe } from './types/recipe';
import type { Database } from './supabase/database.types';

/**
 * Get the current user's household ID
 */
async function getHouseholdId(): Promise<string | null> {
  const supabase = createBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any)?.household_id || null;
}

/**
 * Family Settings
 * Stores the complete FamilySettings object in full_settings JSONB column
 * Also maintains backward compatibility by updating the simplified columns
 */
export async function saveFamilySettingsToDb(settings: FamilySettings): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return false;
    
    const supabase = createBrowserClient();
    
    // Store complete settings in JSONB column
    // Also update simplified columns for backward compatibility
    const dbSettings: Database['public']['Tables']['family_settings']['Insert'] = {
      household_id: householdId,
      total_servings: settings.totalServings,
      adults: settings.adults,
      kids: settings.children.length,
      kids_ages: settings.children.map(c => c.age),
      cuisines: settings.cuisines || [],
      dietary_restrictions: [
        ...(settings.glutenFreePreference ? ['gluten-free-preference'] : []),
        ...(settings.proteinFocus ? ['high-protein'] : []),
        ...(settings.allergies || []),
        ...(settings.avoidFoods || []),
      ],
      cooking_time_preference: (settings.maxCookTime?.weeknight || 45) <= 30 ? 'quick' : 'standard',
      skill_level: settings.cookingSkill || 'intermediate',
      updated_at: new Date().toISOString(),
      // Store complete settings object
      full_settings: settings as any,
    };
    
    const { error } = await supabase
      .from('family_settings')
      .upsert(dbSettings, {
        onConflict: 'household_id',
      });
    
    if (error) {
      console.error('Error saving family settings:', error);
      console.error('Settings data:', dbSettings);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveFamilySettingsToDb:', error);
    return false;
  }
}

export async function loadFamilySettingsFromDb(): Promise<FamilySettings | null> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return null;
    
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('family_settings')
      .select('*')
      .eq('household_id', householdId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Get defaults to merge with
    const { DEFAULT_FAMILY_SETTINGS } = await import('./types/settings');
    
    // If full_settings exists, use it (new format) and merge with defaults
    if (data.full_settings && typeof data.full_settings === 'object' && !Array.isArray(data.full_settings)) {
      const loadedSettings = data.full_settings as unknown as FamilySettings;
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_FAMILY_SETTINGS,
        ...loadedSettings,
        // Ensure nested objects are properly merged
        location: {
          ...DEFAULT_FAMILY_SETTINGS.location,
          ...(loadedSettings.location || {}),
        },
        budgetPerMeal: {
          ...DEFAULT_FAMILY_SETTINGS.budgetPerMeal,
          ...(loadedSettings.budgetPerMeal || {}),
        },
        maxCookTime: {
          ...DEFAULT_FAMILY_SETTINGS.maxCookTime,
          ...(loadedSettings.maxCookTime || {}),
        },
        batchCooking: {
          ...DEFAULT_FAMILY_SETTINGS.batchCooking,
          ...(loadedSettings.batchCooking || {}),
        },
      };
    }
    
    // Fallback: reconstruct from simplified columns (backward compatibility)
    return {
      ...DEFAULT_FAMILY_SETTINGS,
      totalServings: data.total_servings,
      adults: data.adults,
      children: data.kids_ages.map(age => ({ age })),
      cuisines: data.cuisines,
      glutenFreePreference: data.dietary_restrictions.includes('gluten-free-preference'),
      proteinFocus: data.dietary_restrictions.includes('high-protein'),
      avoidFoods: data.dietary_restrictions.filter(r => !['gluten-free-preference', 'high-protein'].includes(r)),
      cookingSkill: data.skill_level as 'beginner' | 'intermediate' | 'confident_home_cook' | 'advanced',
      maxCookTime: {
        weeknight: data.cooking_time_preference === 'quick' ? 30 : data.cooking_time_preference === 'moderate' ? 45 : 60,
        weekend: 90,
      },
      lastUpdated: data.updated_at,
    };
  } catch (error) {
    console.error('Error in loadFamilySettingsFromDb:', error);
    return null;
  }
}

/**
 * Meal Plans
 */
export interface MealPlan {
  weekStart: string; // ISO date string (YYYY-MM-DD)
  meals: {
    [day: string]: {
      recipeId: string;
      servings?: number;
    } | null;
  };
}

export async function saveMealPlan(plan: MealPlan): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return false;
    
    const supabase = createBrowserClient();
    
    const { error } = await supabase
      .from('meal_plans')
      .upsert({
        household_id: householdId,
        week_start: plan.weekStart,
        meals: plan.meals,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'household_id,week_start',
      });
    
    if (error) {
      console.error('Error saving meal plan:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveMealPlan:', error);
    return false;
  }
}

export async function loadMealPlan(weekStart: string): Promise<MealPlan | null> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return null;
    
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      weekStart: data.week_start,
      meals: data.meals as MealPlan['meals'],
    };
  } catch (error) {
    console.error('Error in loadMealPlan:', error);
    return null;
  }
}

/**
 * Recipes
 */
export async function saveRecipe(recipe: Recipe): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) {
      console.error('❌ Cannot save recipe: no household ID');
      return false;
    }
    
    const supabase = createBrowserClient();
    
    // Validate required fields
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
      console.error('❌ Invalid recipe: missing or invalid ingredients', recipe.id);
      return false;
    }
    
    console.log(`💾 Saving recipe to Supabase: ${recipe.title} (${recipe.id})`);
    
    const recipeData: Database['public']['Tables']['recipes']['Insert'] = {
      id: recipe.id,
      household_id: householdId,
      title: recipe.title || 'Untitled Recipe',
      source_url: recipe.source?.url || null,
      source_domain: recipe.source?.domain || 'unknown',
      source_chef: recipe.source?.chef || null,
      time_mins: recipe.timeMins || 30,
      serves: recipe.serves || 4,
      tags: recipe.tags || [],
      ingredients: recipe.ingredients as unknown as Database['public']['Tables']['recipes']['Insert']['ingredients'],
      instructions: recipe.instructions || null,
      cost_per_serve_est: recipe.costPerServeEst || null,
      nutrition: recipe.nutrition ? recipe.nutrition as unknown as Database['public']['Tables']['recipes']['Insert']['nutrition'] : null,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('recipes')
      .upsert(recipeData, {
        onConflict: 'id',
      });
    
    if (error) {
      console.error('❌ Error saving recipe:', error);
      console.error('Recipe ID:', recipe.id, 'Title:', recipe.title);
      console.error('Full recipe data:', recipeData);
      return false;
    }
    
    console.log(`✅ Recipe saved successfully: ${recipe.title}`);
    return true;
  } catch (error) {
    console.error('Error in saveRecipe:', error);
    return false;
  }
}

export async function loadRecipe(recipeId: string): Promise<Recipe | null> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return null;
    
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('household_id', householdId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      id: data.id,
      title: data.title,
      source: {
        url: data.source_url || '',
        domain: data.source_domain,
        chef: data.source_chef || '',
        license: 'unknown',
        fetchedAt: data.created_at,
      },
      timeMins: data.time_mins,
      serves: data.serves,
      tags: data.tags,
      ingredients: data.ingredients as Recipe['ingredients'],
      instructions: data.instructions || undefined,
      costPerServeEst: data.cost_per_serve_est || undefined,
      nutrition: data.nutrition as Recipe['nutrition'] || undefined,
    };
  } catch (error) {
    console.error('Error in loadRecipe:', error);
    return null;
  }
}

export async function loadAllRecipes(): Promise<Recipe[]> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) {
      console.warn('⚠️ Cannot load recipes: no household ID');
      return [];
    }
    
    const supabase = createBrowserClient();
    
    console.log(`📚 Loading all recipes for household: ${householdId}`);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error loading recipes:', error);
      return [];
    }
    
    if (!data) {
      console.log('📚 No recipes found in database');
      return [];
    }
    
    console.log(`✅ Loaded ${data.length} recipes from Supabase`);
    return data.map(row => ({
      id: row.id,
      title: row.title,
      source: {
        url: row.source_url || '',
        domain: row.source_domain,
        chef: row.source_chef || '',
        license: 'unknown',
        fetchedAt: row.created_at,
      },
      timeMins: row.time_mins,
      serves: row.serves,
      tags: row.tags,
      ingredients: row.ingredients as Recipe['ingredients'],
      instructions: row.instructions || undefined,
      costPerServeEst: row.cost_per_serve_est || undefined,
      nutrition: row.nutrition as Recipe['nutrition'] || undefined,
    }));
  } catch (error) {
    console.error('Error in loadAllRecipes:', error);
    return [];
  }
}

export async function deleteRecipe(recipeId: string): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) {
      console.warn('⚠️ Cannot delete recipe: no household ID');
      return false;
    }
    
    const supabase = createBrowserClient();
    
    console.log(`🗑️ Deleting recipe from Supabase: ${recipeId}`);
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('household_id', householdId);
    
    if (error) {
      console.error('❌ Error deleting recipe:', error);
      return false;
    }
    
    console.log(`✅ Recipe deleted successfully: ${recipeId}`);
    return true;
  } catch (error) {
    console.error('Error in deleteRecipe:', error);
    return false;
  }
}

/**
 * Shopping Lists
 */
export interface ShoppingList {
  weekStart: string;
  items: {
    name: string;
    qty: number;
    unit: string;
    checked?: boolean;
    recipeIds?: string[];
  }[];
}

export async function saveShoppingList(list: ShoppingList): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return false;
    
    const supabase = createBrowserClient();
    
    const { error } = await supabase
      .from('shopping_lists')
      .upsert({
        household_id: householdId,
        week_start: list.weekStart,
        items: list.items,
        updated_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('Error saving shopping list:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in saveShoppingList:', error);
    return false;
  }
}

export async function loadShoppingList(weekStart: string): Promise<ShoppingList | null> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return null;
    
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('household_id', householdId)
      .eq('week_start', weekStart)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      weekStart: data.week_start,
      items: data.items as ShoppingList['items'],
    };
  } catch (error) {
    console.error('Error in loadShoppingList:', error);
    return null;
  }
}

/**
 * Pantry Preferences
 */
export async function savePantryItems(items: string[]): Promise<boolean> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return false;
    
    const supabase = createBrowserClient();
    
    const { error } = await supabase
      .from('pantry_preferences')
      .upsert({
        household_id: householdId,
        items,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'household_id',
      });
    
    if (error) {
      console.error('Error saving pantry items:', error);
      console.error('Pantry data:', { household_id: householdId, items });
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in savePantryItems:', error);
    return false;
  }
}

export async function loadPantryItems(): Promise<string[]> {
  try {
    const householdId = await getHouseholdId();
    if (!householdId) return [];
    
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase
      .from('pantry_preferences')
      .select('items')
      .eq('household_id', householdId)
      .single();
    
    if (error || !data) {
      return [];
    }
    
    return data.items;
  } catch (error) {
    console.error('Error in loadPantryItems:', error);
    return [];
  }
}
