/**
 * Persistent API Cache for Coles Products
 * Stores API results in colesApiCache.json to reduce API usage long-term
 * Separate from localStorage cache (24h) - this has 30-day TTL
 */

import type { ColesApiProduct } from './colesApi';
import colesCacheData from '@/data/colesApiCache.json';

const PERSISTENT_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

export interface CachedProductData {
  product: ColesApiProduct;
  quantity: number;
  unit: string;
  timestamp: number;
  expiresAt: number;
  searchTerm: string; // The term used to find this product
}

export interface PersistentCacheData {
  meta: {
    version: string;
    lastUpdated: number | null;
    cacheTTL: number;
    description: string;
  };
  products: {
    [normalizedName: string]: CachedProductData;
  };
}

// In-memory cache to avoid re-reading JSON file
let inMemoryCache: PersistentCacheData | null = null;

/**
 * Load persistent cache from JSON file
 */
function loadPersistentCache(): PersistentCacheData {
  if (inMemoryCache) {
    return inMemoryCache;
  }
  
  try {
    inMemoryCache = colesCacheData as PersistentCacheData;
    return inMemoryCache;
  } catch (error) {
    console.error('Failed to load persistent cache:', error);
    return {
      meta: {
        version: '1.0.0',
        lastUpdated: null,
        cacheTTL: PERSISTENT_CACHE_TTL,
        description: 'Persistent cache for Coles API product data'
      },
      products: {}
    };
  }
}

/**
 * Get cached product from persistent cache
 * Returns null if not found or expired
 */
export function getCachedProduct(normalizedName: string): CachedProductData | null {
  const cache = loadPersistentCache();
  const cached = cache.products[normalizedName];
  
  if (!cached) {
    return null;
  }
  
  // Check if expired
  if (Date.now() > cached.expiresAt) {
    console.log(`⏰ Persistent cache expired for "${normalizedName}"`);
    return null;
  }
  
  console.log(`💾 Found "${normalizedName}" in persistent cache`);
  return cached;
}

/**
 * Save product to persistent cache
 * Note: This only updates the in-memory cache
 * To persist to disk, you'll need to manually update colesApiCache.json
 */
export function saveProductToCache(
  normalizedName: string,
  product: ColesApiProduct,
  quantity: number,
  unit: string,
  searchTerm: string
): void {
  const cache = loadPersistentCache();
  const now = Date.now();
  
  cache.products[normalizedName] = {
    product,
    quantity,
    unit,
    timestamp: now,
    expiresAt: now + PERSISTENT_CACHE_TTL,
    searchTerm
  };
  
  cache.meta.lastUpdated = now;
  
  console.log(`💾 Saved "${normalizedName}" to persistent cache (in-memory)`);
  console.log(`📋 To persist to disk, add this entry to colesApiCache.json:`);
  console.log(JSON.stringify({ [normalizedName]: cache.products[normalizedName] }, null, 2));
}

/**
 * Get cache statistics
 */
export function getPersistentCacheStats(): {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  const cache = loadPersistentCache();
  const entries = Object.values(cache.products);
  const now = Date.now();
  
  const validEntries = entries.filter(e => e.expiresAt > now);
  const expiredEntries = entries.filter(e => e.expiresAt <= now);
  
  const timestamps = entries.map(e => e.timestamp).filter(t => t > 0);
  
  return {
    totalEntries: entries.length,
    validEntries: validEntries.length,
    expiredEntries: expiredEntries.length,
    oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
    newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
  };
}

/**
 * Export cache for manual backup/update
 * Returns JSON string that can be copied to colesApiCache.json
 */
export function exportCacheForPersistence(): string {
  const cache = loadPersistentCache();
  return JSON.stringify(cache, null, 2);
}

/**
 * Get all cached ingredient names
 */
export function getCachedIngredientNames(): string[] {
  const cache = loadPersistentCache();
  return Object.keys(cache.products);
}

/**
 * Clear expired entries from in-memory cache
 */
export function clearExpiredEntries(): number {
  const cache = loadPersistentCache();
  const now = Date.now();
  let clearedCount = 0;
  
  Object.keys(cache.products).forEach(key => {
    if (cache.products[key].expiresAt <= now) {
      delete cache.products[key];
      clearedCount++;
    }
  });
  
  if (clearedCount > 0) {
    cache.meta.lastUpdated = now;
    console.log(`🗑️ Cleared ${clearedCount} expired entries from persistent cache`);
  }
  
  return clearedCount;
}
