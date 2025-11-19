export type PantryItem = { name: string; qty: number; unit: 'g'|'ml'|'unit' };

export type Household = {
  id: string;
  members: { adults: number; kids: number };
  diet: { glutenLight: boolean; highProtein: boolean; organicPreferred: boolean };
  retailer: 'coles';
  pantry: PantryItem[];
  favorites: string[];
};

export type WeeklyOverrides = {
  weekOfISO: string;
  dinners: number; // default 5, up to 7
  servingsPerMeal: number; // default 4
  kidFriendlyWeeknights: boolean;
  dietAdjust: Partial<Household['diet']>;
  pantryAdds: PantryItem[];
};

export type RecipeSource = { 
  url: string; 
  domain: string; 
  chef: string; // Chef name or source attribution (e.g., "Jamie Oliver", "Mom's Recipe", "AI Generated")
  license: 'unknown'|'restricted'|'permitted'; 
  image?: string; 
  fetchedAt: string 
};

export type Ingredient = { 
  name: string; 
  qty: number; 
  unit: 'g'|'ml'|'tsp'|'tbsp'|'unit';
  seasonal?: boolean; // True if ingredient is in season
};

export type NutritionInfo = {
  calories: number; // kcal per serving
  protein: number; // grams per serving
  carbs: number; // grams per serving
  fat: number; // grams per serving
};

export type Recipe = { 
  id: string; 
  title: string; 
  source: RecipeSource; 
  timeMins?: number; 
  tags: string[]; 
  ingredients: Ingredient[]; 
  instructions?: string[]; // Step-by-step cooking instructions
  serves?: number; 
  costPerServeEst?: number;
  nutrition?: NutritionInfo; // Optional nutrition data per serving
  rating?: number; // User rating 1-5 stars (stored separately in localStorage)
  isBlocked?: boolean; // True if user selected "never show this recipe again"
  seasonalScore?: number; // 0-1 score indicating seasonal relevance (computed based on ingredients + current date)
};

export type PlanDay = { 
  dateISO: string; 
  recipeId: string; 
  scaledServings: number; 
  notes?: string; 
  bulk?: boolean;
  reasons?: string[]; // Explainable reasons for selection (e.g., "favorite", "≤40m", "best value")
};

export type PlanWeek = { 
  startISO: string; 
  days: PlanDay[]; 
  costEstimate: number; 
  conflicts: string[];
  suggestedSwaps?: Record<number, Recipe[]>; // Day index → swap suggestions
};

export type CartLine = { 
  ingredientName: string; 
  qty: number; 
  unit: Ingredient['unit']; 
  mappedSku?: string; 
  status: 'mapped'|'needs_choice'|'oos' 
};