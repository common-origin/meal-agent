/**
 * Coles Product Price API Client
 * Integrates with RapidAPI's Coles Product Price API
 * Handles product search, caching, and rate limiting
 */

// Cache key prefix for localStorage
const CACHE_PREFIX = 'coles-api-cache:';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const RATE_LIMIT_KEY = 'coles-api-usage';
const MONTHLY_LIMIT = 1000; // Free tier limit

export interface ColesApiProduct {
  productName: string;
  brand: string;
  currentPrice: string; // e.g., "$7.50"
  size: string; // e.g., "500g"
  url: string;
}

export interface ColesApiResponse {
  query: string;
  totalResults: number;
  totalPages: number;
  currentPage: number;
  results: ColesApiProduct[];
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

export interface RateLimitData {
  count: number;
  month: string; // YYYY-MM format
}

/**
 * Get current month string for rate limiting
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Check if we're within rate limit
 */
export function checkRateLimit(): { allowed: boolean; remaining: number } {
  if (typeof window === 'undefined') return { allowed: true, remaining: MONTHLY_LIMIT };
  
  const data = localStorage.getItem(RATE_LIMIT_KEY);
  if (!data) return { allowed: true, remaining: MONTHLY_LIMIT };
  
  const rateLimit: RateLimitData = JSON.parse(data);
  const currentMonth = getCurrentMonth();
  
  // Reset count if new month
  if (rateLimit.month !== currentMonth) {
    return { allowed: true, remaining: MONTHLY_LIMIT };
  }
  
  const remaining = MONTHLY_LIMIT - rateLimit.count;
  return {
    allowed: rateLimit.count < MONTHLY_LIMIT,
    remaining: Math.max(0, remaining)
  };
}

/**
 * Increment rate limit counter and track usage details
 */
function incrementRateLimit(ingredientName?: string): void {
  if (typeof window === 'undefined') return;
  
  const currentMonth = getCurrentMonth();
  const today = new Date().toISOString().split('T')[0];
  
  // Get or initialize usage data
  const usageKey = 'coles_api_usage';
  const usageData = localStorage.getItem(usageKey);
  const usage = usageData ? JSON.parse(usageData) : {
    monthlyRequests: {},
    dailyRequests: {},
    ingredientRequests: {}
  };
  
  // Increment monthly counter
  usage.monthlyRequests[currentMonth] = (usage.monthlyRequests[currentMonth] || 0) + 1;
  
  // Increment daily counter
  usage.dailyRequests[today] = (usage.dailyRequests[today] || 0) + 1;
  
  // Track ingredient requests
  if (ingredientName) {
    const normalizedName = ingredientName.toLowerCase().trim();
    usage.ingredientRequests[normalizedName] = (usage.ingredientRequests[normalizedName] || 0) + 1;
  }
  
  localStorage.setItem(usageKey, JSON.stringify(usage));
  
  // Also update the old rate limit key for compatibility
  const data = localStorage.getItem(RATE_LIMIT_KEY);
  let rateLimit: RateLimitData;
  if (data) {
    rateLimit = JSON.parse(data);
    if (rateLimit.month !== currentMonth) {
      rateLimit = { count: 0, month: currentMonth };
    }
  } else {
    rateLimit = { count: 0, month: currentMonth };
  }
  rateLimit.count++;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimit));
}

/**
 * Get rate limit usage stats
 */
export function getRateLimitStats(): { used: number; limit: number; remaining: number; month: string } {
  if (typeof window === 'undefined') {
    return { used: 0, limit: MONTHLY_LIMIT, remaining: MONTHLY_LIMIT, month: getCurrentMonth() };
  }
  
  const data = localStorage.getItem(RATE_LIMIT_KEY);
  const currentMonth = getCurrentMonth();
  
  if (!data) {
    return { used: 0, limit: MONTHLY_LIMIT, remaining: MONTHLY_LIMIT, month: currentMonth };
  }
  
  const rateLimit: RateLimitData = JSON.parse(data);
  
  // Reset if new month
  if (rateLimit.month !== currentMonth) {
    return { used: 0, limit: MONTHLY_LIMIT, remaining: MONTHLY_LIMIT, month: currentMonth };
  }
  
  return {
    used: rateLimit.count,
    limit: MONTHLY_LIMIT,
    remaining: Math.max(0, MONTHLY_LIMIT - rateLimit.count),
    month: currentMonth
  };
}

/**
 * Get cached data if valid
 */
function getCachedData<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  const cacheKey = CACHE_PREFIX + key;
  const cached = localStorage.getItem(cacheKey);
  
  if (!cached) return null;
  
  try {
    const { data, timestamp }: CachedData<T> = JSON.parse(cached);
    const age = Date.now() - timestamp;
    
    if (age < CACHE_TTL) {
      console.log(`📦 Cache HIT for "${key}" (age: ${Math.round(age / 1000 / 60)}min)`);
      return data;
    } else {
      console.log(`🗑️  Cache EXPIRED for "${key}"`);
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Set cached data
 */
function setCachedData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  
  const cacheKey = CACHE_PREFIX + key;
  const cached: CachedData<T> = {
    data,
    timestamp: Date.now()
  };
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cached));
    console.log(`💾 Cached data for "${key}"`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Normalize ingredient name for cache key
 */
function normalizeCacheKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Search for Coles products by ingredient name
 * Uses enhanced search term mapping for better results
 * Uses cache first, then API if cache miss
 */
export async function searchColesProducts(
  ingredientName: string,
  pageSize: number = 10,
  category?: string
): Promise<ColesApiResponse | null> {
  // Enhance search term for better product matching
  const { generateSearchTerm } = await import('./ingredientSearchMapping');
  const enhancedSearchTerm = generateSearchTerm(ingredientName, category);
  
  if (enhancedSearchTerm !== ingredientName) {
    console.log(`🔍 Enhanced search: "${ingredientName}" → "${enhancedSearchTerm}"`);
  }
  
  // Check cache first (use enhanced term for cache key)
  const cacheKey = normalizeCacheKey(enhancedSearchTerm);
  const cached = getCachedData<ColesApiResponse>(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  // Check rate limit
  const { allowed, remaining } = checkRateLimit();
  if (!allowed) {
    console.warn('⚠️  Coles API rate limit exceeded for this month');
    return null;
  }
  
  console.log(`🔍 Searching Coles API for "${enhancedSearchTerm}" (${remaining} requests remaining)`);
  
  try {
    // Call our backend API route (which proxies to RapidAPI)
    // Use enhanced search term for better results
    console.log('📡 Calling /api/coles-search endpoint...');
    const response = await fetch('/api/coles-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: enhancedSearchTerm, pageSize })
    });
    
    console.log(`📨 Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('📄 Response body:', errorText);
      console.error('🔗 Request URL:', response.url);
      return null;
    }
    
    const data: ColesApiResponse = await response.json();
    
    // Increment rate limit counter with ingredient name for tracking
    incrementRateLimit(ingredientName);
    
    // Cache the result
    setCachedData(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error('Coles API search error:', error);
    return null;
  }
}

/**
 * Parse price string to number
 * "$7.50" -> 7.50
 */
export function parsePrice(priceStr: string): number {
  const match = priceStr.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

/**
 * Parse size string to extract numeric value and unit
 * "500g" -> { value: 500, unit: "g" }
 */
export function parseSize(sizeStr: string): { value: number; unit: string } {
  const match = sizeStr.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
  if (match) {
    return {
      value: parseFloat(match[1]),
      unit: match[2].toLowerCase()
    };
  }
  return { value: 0, unit: '' };
}

/**
 * Calculate price per unit for comparison
 * Handles g, kg, ml, l conversions
 */
export function calculatePricePerUnit(price: number, size: string): number {
  const { value, unit } = parseSize(size);
  if (value === 0) return 0;
  
  // Convert to base units (g or ml)
  let baseValue = value;
  if (unit === 'kg') baseValue = value * 1000;
  if (unit === 'l') baseValue = value * 1000;
  
  // Price per 100g or 100ml
  return (price / baseValue) * 100;
}

/**
 * Clear all Coles API cache
 */
export function clearColesApiCache(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  let cleared = 0;
  
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
      cleared++;
    }
  });
  
  console.log(`🗑️  Cleared ${cleared} cached Coles API responses`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { entries: number; sizeKB: number } {
  if (typeof window === 'undefined') return { entries: 0, sizeKB: 0 };
  
  const keys = Object.keys(localStorage);
  let entries = 0;
  let totalSize = 0;
  
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      entries++;
      const value = localStorage.getItem(key);
      if (value) totalSize += value.length;
    }
  });
  
  return {
    entries,
    sizeKB: Math.round(totalSize / 1024)
  };
}
