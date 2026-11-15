/**
 * Coles Product Price API Client
 * Integrates with RapidAPI's Coles Product Price API
 * Handles product search, caching, and rate limiting
 */

// Cache key prefix for localStorage
const CACHE_PREFIX = 'coles-api-cache:';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
/** Shown until the server has said otherwise; the real limit is counted on the server (#227). */
const DEFAULT_MONTHLY_LIMIT = 1000;

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

/** The shared monthly lookup quota, as /api/coles-search reports it (lib/coles/quota.ts). */
export interface ColesQuotaStats {
  used: number;
  limit: number;
  remaining: number;
  month: string; // YYYY-MM, UTC
}

/**
 * Current UTC month, matching the server's count
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The quota the server last reported. Every household shares one RapidAPI
 * key, so the count lives on the server (#227); this is only a copy, kept
 * so the app stops asking once the month's lookups are used up.
 */
let lastKnownQuota: ColesQuotaStats | null = null;

function isQuotaStats(value: unknown): value is ColesQuotaStats {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.used === 'number' && typeof v.limit === 'number' && typeof v.remaining === 'number' && typeof v.month === 'string';
}

function rememberQuota(value: unknown): void {
  if (isQuotaStats(value)) lastKnownQuota = value;
}

/** For tests: forget the server's last report. */
export function resetColesQuotaForTests(): void {
  lastKnownQuota = null;
}

/**
 * Asks the server for this month's lookups across every household. Keeps
 * the last report if the server can't be reached.
 */
export async function refreshColesQuota(): Promise<ColesQuotaStats> {
  try {
    const response = await fetch('/api/coles-search', { method: 'GET' });
    if (response.ok) rememberQuota(await response.json());
  } catch (error) {
    console.warn('Could not read the Coles lookup quota:', error);
  }
  return getRateLimitStats();
}

/**
 * Check if we're within rate limit (as last reported by the server)
 */
export function checkRateLimit(): { allowed: boolean; remaining: number } {
  const { remaining } = getRateLimitStats();
  return { allowed: remaining > 0, remaining };
}

/**
 * Track per-browser usage details for the /debug/api-usage page. Not the
 * quota: that's counted on the server.
 */
function recordLocalUsage(ingredientName?: string): void {
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
}

/**
 * Shared quota usage, as the server last reported it. A report from an
 * earlier month no longer applies (the count has reset).
 */
export function getRateLimitStats(): ColesQuotaStats {
  const month = getCurrentMonth();
  if (!lastKnownQuota || lastKnownQuota.month !== month) {
    return { used: 0, limit: lastKnownQuota?.limit ?? DEFAULT_MONTHLY_LIMIT, remaining: lastKnownQuota?.limit ?? DEFAULT_MONTHLY_LIMIT, month };
  }
  return lastKnownQuota;
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
      // The month's shared lookups are used up (#227): remember, so we stop asking.
      if (response.status === 429) {
        const body: unknown = await response.json().catch(() => null);
        if (body && typeof body === 'object' && 'quota' in body) {
          rememberQuota(body.quota);
          console.warn('⚠️  Coles API quota used up for this month');
          return null;
        }
      }
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('📄 Response body:', errorText);
      console.error('🔗 Request URL:', response.url);
      return null;
    }
    
    const { quota, ...data }: ColesApiResponse & { quota?: unknown } = await response.json();
    rememberQuota(quota);
    recordLocalUsage(ingredientName);
    
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
