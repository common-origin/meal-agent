// Privacy-safe local analytics using localStorage
// No data leaves the user's device

export type AnalyticsEventType = 
  // Navigation
  | 'page_view'
  
  // Plan Management
  | 'plan_composed'
  | 'plan_regenerated'
  | 'plan_confirmed'
  | 'plan_reviewed'
  
  // Meal Swapping
  | 'swap'
  | 'swap_suggested'
  
  // Shopping List
  | 'export_csv'
  | 'ingredient_reused'
  | 'cost_optimized'
  
  // User Preferences
  | 'favorite_added'
  | 'favorite_removed'
  | 'override_saved'
  
  // Price Reports
  | 'price_reported';

export type AnalyticsEvent = {
  type: AnalyticsEventType;
  timestamp: string;
  meta?: Record<string, unknown>;
};

// Metadata interfaces for type safety
export interface PlanComposedMeta extends Record<string, unknown> {
  dayCount: number;
  cost: number;
  conflicts: number;
  leftoverDays?: number;
  proteinVariety?: number;
}

export interface PlanRegeneratedMeta extends Record<string, unknown> {
  pinnedDays: number[];
  constraints?: {
    maxCost?: number;
    maximizeReuse?: boolean;
    kidFriendlyOnly?: boolean;
  };
  previousCost?: number;
  newCost?: number;
}

export interface SwapMeta extends Record<string, unknown> {
  day: string;
  oldRecipeId: string;
  newRecipeId: string;
  reason?: string;
}

export interface CostOptimizedMeta extends Record<string, unknown> {
  originalCost: number;
  optimizedCost: number;
  savingsPercent: number;
  method: 'ingredient_reuse' | 'pack_optimization' | 'bulk_discount';
}

export interface IngredientReusedMeta extends Record<string, unknown> {
  ingredient: string;
  recipeCount: number;
  totalQuantity: number;
  packsSaved: number;
}

const STORAGE_KEY = 'ma_analytics';
const OPT_OUT_KEY = 'ma_analytics_optout';

/**
 * Check if user has opted out of analytics
 */
export function isOptedOut(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(OPT_OUT_KEY) === 'true';
}

/**
 * Set opt-out preference
 */
export function setOptOut(optOut: boolean): void {
  if (typeof window === 'undefined') return;
  if (optOut) {
    localStorage.setItem(OPT_OUT_KEY, 'true');
  } else {
    localStorage.removeItem(OPT_OUT_KEY);
  }
}

/**
 * Track an analytics event
 */
export function track(type: AnalyticsEventType, meta?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (isOptedOut()) return;

  const event: AnalyticsEvent = {
    type,
    timestamp: new Date().toISOString(),
    meta
  };

  try {
    const events = getEvents();
    events.push(event);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (error) {
    console.warn('Failed to track analytics event', error);
  }
}

/**
 * Get all analytics events
 */
export function getEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as AnalyticsEvent[];
  } catch (error) {
    console.warn('Failed to get analytics events', error);
    return [];
  }
}

/**
 * Clear all analytics events
 */
export function clearEvents(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear analytics events', error);
  }
}

/**
 * Get event count by type
 */
export function getEventCountByType(): Record<string, number> {
  const events = getEvents();
  const counts: Record<string, number> = {};
  
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }
  
  return counts;
}

/**
 * Get events from the last N days
 */
export function getRecentEvents(days: number = 7): AnalyticsEvent[] {
  const events = getEvents();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  
  return events.filter(event => new Date(event.timestamp) >= cutoff);
}

/**
 * Get aggregate metrics for plan composition
 */
export function getPlanMetrics(days: number = 30): {
  totalPlans: number;
  totalRegenerations: number;
  avgCost: number;
  avgDayCount: number;
  conflictRate: number;
} {
  const events = getRecentEvents(days);
  const planEvents = events.filter(e => e.type === 'plan_composed');
  const regenEvents = events.filter(e => e.type === 'plan_regenerated');
  
  if (planEvents.length === 0) {
    return {
      totalPlans: 0,
      totalRegenerations: 0,
      avgCost: 0,
      avgDayCount: 0,
      conflictRate: 0
    };
  }
  
  const totalCost = planEvents.reduce((sum, e) => {
    const meta = e.meta as PlanComposedMeta | undefined;
    return sum + (meta?.cost || 0);
  }, 0);
  
  const totalDays = planEvents.reduce((sum, e) => {
    const meta = e.meta as PlanComposedMeta | undefined;
    return sum + (meta?.dayCount || 0);
  }, 0);
  
  const totalConflicts = planEvents.reduce((sum, e) => {
    const meta = e.meta as PlanComposedMeta | undefined;
    return sum + (meta?.conflicts || 0);
  }, 0);
  
  return {
    totalPlans: planEvents.length,
    totalRegenerations: regenEvents.length,
    avgCost: totalCost / planEvents.length,
    avgDayCount: totalDays / planEvents.length,
    conflictRate: totalConflicts / planEvents.length
  };
}

/**
 * Get cost optimization insights
 */
export function getCostOptimizationMetrics(days: number = 30): {
  totalSavings: number;
  avgSavingsPercent: number;
  topMethod: string;
} {
  const events = getRecentEvents(days);
  const costEvents = events.filter(e => e.type === 'cost_optimized');
  
  if (costEvents.length === 0) {
    return {
      totalSavings: 0,
      avgSavingsPercent: 0,
      topMethod: 'none'
    };
  }
  
  const totalSavings = costEvents.reduce((sum, e) => {
    const meta = e.meta as CostOptimizedMeta | undefined;
    if (!meta) return sum;
    return sum + (meta.originalCost - meta.optimizedCost);
  }, 0);
  
  const avgSavingsPercent = costEvents.reduce((sum, e) => {
    const meta = e.meta as CostOptimizedMeta | undefined;
    return sum + (meta?.savingsPercent || 0);
  }, 0) / costEvents.length;
  
  // Count methods
  const methodCounts: Record<string, number> = {};
  costEvents.forEach(e => {
    const meta = e.meta as CostOptimizedMeta | undefined;
    if (meta?.method) {
      methodCounts[meta.method] = (methodCounts[meta.method] || 0) + 1;
    }
  });
  
  const topMethod = Object.entries(methodCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'none';
  
  return {
    totalSavings,
    avgSavingsPercent,
    topMethod
  };
}

/**
 * Get ingredient reuse insights
 */
export function getIngredientReuseMetrics(days: number = 30): {
  totalReuses: number;
  avgRecipeCount: number;
  totalPacksSaved: number;
  topIngredients: Array<{ ingredient: string; count: number }>;
} {
  const events = getRecentEvents(days);
  const reuseEvents = events.filter(e => e.type === 'ingredient_reused');
  
  if (reuseEvents.length === 0) {
    return {
      totalReuses: 0,
      avgRecipeCount: 0,
      totalPacksSaved: 0,
      topIngredients: []
    };
  }
  
  const ingredientCounts: Record<string, number> = {};
  let totalRecipeCount = 0;
  let totalPacksSaved = 0;
  
  reuseEvents.forEach(e => {
    const meta = e.meta as IngredientReusedMeta | undefined;
    if (meta) {
      ingredientCounts[meta.ingredient] = (ingredientCounts[meta.ingredient] || 0) + 1;
      totalRecipeCount += meta.recipeCount;
      totalPacksSaved += meta.packsSaved || 0;
    }
  });
  
  const topIngredients = Object.entries(ingredientCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([ingredient, count]) => ({ ingredient, count }));
  
  return {
    totalReuses: reuseEvents.length,
    avgRecipeCount: totalRecipeCount / reuseEvents.length,
    totalPacksSaved,
    topIngredients
  };
}

/**
 * Get swap behavior insights
 */
export function getSwapMetrics(days: number = 30): {
  totalSwaps: number;
  avgSwapsPerPlan: number;
  topDays: Array<{ day: string; count: number }>;
} {
  const events = getRecentEvents(days);
  const swapEvents = events.filter(e => e.type === 'swap');
  const planEvents = events.filter(e => e.type === 'plan_composed');
  
  if (swapEvents.length === 0) {
    return {
      totalSwaps: 0,
      avgSwapsPerPlan: 0,
      topDays: []
    };
  }
  
  const dayCounts: Record<string, number> = {};
  swapEvents.forEach(e => {
    const meta = e.meta as SwapMeta | undefined;
    if (meta?.day) {
      dayCounts[meta.day] = (dayCounts[meta.day] || 0) + 1;
    }
  });
  
  const topDays = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day, count]) => ({ day, count }));
  
  return {
    totalSwaps: swapEvents.length,
    avgSwapsPerPlan: planEvents.length > 0 ? swapEvents.length / planEvents.length : 0,
    topDays
  };
}
