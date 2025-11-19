/**
 * Shared utility functions for API requests
 */

import { API_MAX_RETRIES, API_INITIAL_RETRY_DELAY_MS } from '../constants';

/**
 * Retry a function with exponential backoff
 * Useful for handling transient API errors
 */
export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = API_MAX_RETRIES,
  initialDelayMs: number = API_INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a retryable error (503, 429, network issues)
      const isRetryable = 
        lastError.message.includes('503') || 
        lastError.message.includes('429') ||
        lastError.message.includes('overloaded') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT');
      
      if (!isRetryable || attempt === maxRetries - 1) {
        throw lastError;
      }
      
      const delay = initialDelayMs * Math.pow(2, attempt);
      console.log(`⏳ Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Debounce a function call
 * Useful for text inputs to avoid excessive re-renders
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return function(this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delayMs);
  };
}
