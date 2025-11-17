/**
 * Family Settings Types
 * Used for AI-powered meal plan generation
 */

export interface Child {
  age: number;
}

export interface BudgetRange {
  min: number;
  max: number;
}

export interface CookingTimeConstraints {
  weeknight: number; // minutes
  weekend: number; // minutes
}

export interface BatchCookingPreferences {
  enabled: boolean;
  frequency: 'weekly' | 'biweekly' | 'none';
  preferredDay: 'sunday' | 'saturday' | 'friday';
}

export interface LocationSettings {
  city: string;
  country: string;
  hemisphere: 'northern' | 'southern';
}

export interface GitHubSyncSettings {
  enabled: boolean;
  token: string; // GitHub Personal Access Token
  owner: string; // GitHub username
  repo: string; // Repository name (without owner)
  lastSynced?: string; // ISO timestamp
  autoSync: boolean; // Auto-sync on changes
}

export interface FamilySettings {
  // Household
  adults: number;
  children: Child[];
  totalServings: number;
  
  // Cuisine preferences
  cuisines: string[];
  customCuisines?: string[];
  preferredChef?: string; // e.g., "Jamie Oliver", "Ottolenghi", "Nagi Maehashi"
  
  // Dietary
  glutenFreePreference: boolean; // Prefer but not strict
  proteinFocus: boolean; // Ensure adequate protein
  allergies: string[];
  avoidFoods: string[];
  favoriteIngredients: string[];
  
  // Cooking Profile
  spiceTolerance: 'very_mild' | 'mild' | 'medium' | 'hot' | 'loves_hot';
  cookingSkill: 'beginner' | 'intermediate' | 'confident_home_cook' | 'advanced';
  effortPreference: 'minimal_clean_up' | 'balanced' | 'happy_to_spend_time_on_weekends';
  flavorProfileDescription: string; // Free-text summary, e.g., "fresh & herby, avoids heavy cream"
  
  // Location & Seasonality
  location: LocationSettings;
  
  // Learning & Preferences
  dislikedRecipeIds: string[]; // Recipe IDs rated poorly
  dislikedPatterns?: string[]; // Optional derived tags like 'too_spicy', 'too_creamy'
  
  // Budget & Time
  budgetPerMeal: BudgetRange;
  maxCookTime: CookingTimeConstraints;
  
  // Meal Planning
  batchCooking: BatchCookingPreferences;
  varietyLevel: number; // 1-5, 3 = balanced
  leftoverFriendly: boolean;
  pantryPreference: 'hard' | 'soft'; // How strongly to prioritize pantry items
  weeklyReminderTime?: string; // HH:MM format, e.g., "18:00" for 6pm reminder to plan the week
  weeklyReminderDay?: 'saturday' | 'sunday' | 'monday'; // Day to send weekly reminder
  
  // GitHub Sync (optional)
  github?: GitHubSyncSettings;
  
  // Metadata
  lastUpdated: string; // ISO date
}

/**
 * Available cuisine options
 */
export const CUISINE_OPTIONS = [
  { id: 'mexican', label: 'Mexican', emoji: '🌮' },
  { id: 'australian', label: 'Australian', emoji: '🦘' },
  { id: 'italian', label: 'Italian', emoji: '🍝' },
  { id: 'indian', label: 'Indian', emoji: '🍛' },
  { id: 'asian', label: 'Asian', emoji: '🥢' },
  { id: 'mediterranean', label: 'Mediterranean', emoji: '🫒' },
  { id: 'middle-eastern', label: 'Middle Eastern', emoji: '🧆' },
  { id: 'thai', label: 'Thai', emoji: '🍜' },
  { id: 'vietnamese', label: 'Vietnamese', emoji: '🥙' },
  { id: 'japanese', label: 'Japanese', emoji: '🍱' },
  { id: 'greek', label: 'Greek', emoji: '🥗' },
  { id: 'spanish', label: 'Spanish', emoji: '🥘' },
  { id: 'american', label: 'American/BBQ', emoji: '🍔' },
  { id: 'chinese', label: 'Chinese', emoji: '🥟' },
  { id: 'korean', label: 'Korean', emoji: '🍲' },
  { id: 'french', label: 'French', emoji: '🥐' },
] as const;

/**
 * Default family settings based on user requirements
 */
export const DEFAULT_FAMILY_SETTINGS: FamilySettings = {
  adults: 2,
  children: [{ age: 5 }, { age: 7 }],
  totalServings: 4,
  
  cuisines: ['mexican', 'australian', 'italian', 'indian', 'asian'],
  customCuisines: [],
  preferredChef: undefined,
  
  glutenFreePreference: true,
  proteinFocus: true,
  allergies: [],
  avoidFoods: [],
  favoriteIngredients: [],
  
  // Cooking Profile
  spiceTolerance: 'medium',
  cookingSkill: 'intermediate',
  effortPreference: 'balanced',
  flavorProfileDescription: '',
  
  // Location & Seasonality
  location: {
    city: 'Melbourne',
    country: 'Australia',
    hemisphere: 'southern',
  },
  
  // Learning & Preferences
  dislikedRecipeIds: [],
  dislikedPatterns: [],
  
  budgetPerMeal: {
    min: 15,
    max: 20,
  },
  maxCookTime: {
    weeknight: 30,
    weekend: 45,
  },
  
  batchCooking: {
    enabled: true,
    frequency: 'weekly',
    preferredDay: 'sunday',
  },
  varietyLevel: 3, // Balanced
  leftoverFriendly: true,
  pantryPreference: 'hard', // Default to prioritizing pantry items
  weeklyReminderTime: '18:00', // Default 6pm reminder
  weeklyReminderDay: 'saturday', // Default Saturday reminder
  
  lastUpdated: new Date().toISOString(),
};

/**
 * Validation functions
 */
export function validateFamilySettings(settings: Partial<FamilySettings>): string[] {
  const errors: string[] = [];
  
  if (settings.adults !== undefined && (settings.adults < 1 || settings.adults > 10)) {
    errors.push('Adults must be between 1 and 10');
  }
  
  if (settings.children) {
    settings.children.forEach((child, index) => {
      if (child.age < 0 || child.age > 18) {
        errors.push(`Child ${index + 1} age must be between 0 and 18`);
      }
    });
  }
  
  if (settings.budgetPerMeal) {
    if (settings.budgetPerMeal.min < 5 || settings.budgetPerMeal.min > 100) {
      errors.push('Minimum budget must be between $5 and $100');
    }
    if (settings.budgetPerMeal.max < 5 || settings.budgetPerMeal.max > 100) {
      errors.push('Maximum budget must be between $5 and $100');
    }
    if (settings.budgetPerMeal.min > settings.budgetPerMeal.max) {
      errors.push('Minimum budget cannot be greater than maximum budget');
    }
  }
  
  if (settings.maxCookTime) {
    if (settings.maxCookTime.weeknight < 10 || settings.maxCookTime.weeknight > 120) {
      errors.push('Weeknight cooking time must be between 10 and 120 minutes');
    }
    if (settings.maxCookTime.weekend < 10 || settings.maxCookTime.weekend > 180) {
      errors.push('Weekend cooking time must be between 10 and 180 minutes');
    }
  }
  
  if (settings.varietyLevel !== undefined && (settings.varietyLevel < 1 || settings.varietyLevel > 5)) {
    errors.push('Variety level must be between 1 and 5');
  }
  
  if (settings.cuisines && settings.cuisines.length === 0) {
    errors.push('At least one cuisine must be selected');
  }
  
  return errors;
}
