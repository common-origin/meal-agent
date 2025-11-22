/**
 * API Quota Management
 * Handles rate limiting, warnings, and fallback behavior
 */

import { getRateLimitStats } from './colesApi';

const QUOTA_WARNING_THRESHOLD = 0.8; // 80%
const QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%

export interface QuotaStatus {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'critical' | 'exceeded';
  canMakeRequest: boolean;
  message?: string;
}

/**
 * Get current quota status
 */
export function getQuotaStatus(): QuotaStatus {
  const stats = getRateLimitStats();
  const percentage = (stats.used / stats.limit) * 100;
  
  let status: QuotaStatus['status'] = 'ok';
  let message: string | undefined;
  let canMakeRequest = true;
  
  if (stats.remaining === 0) {
    status = 'exceeded';
    message = `API quota exceeded. Resets next month. Using static prices only.`;
    canMakeRequest = false;
  } else if (percentage >= QUOTA_CRITICAL_THRESHOLD * 100) {
    status = 'critical';
    message = `Critical: ${stats.remaining} API requests remaining. Consider using cached prices.`;
  } else if (percentage >= QUOTA_WARNING_THRESHOLD * 100) {
    status = 'warning';
    message = `Warning: ${stats.remaining} API requests remaining this month.`;
  }
  
  return {
    used: stats.used,
    limit: stats.limit,
    remaining: stats.remaining,
    percentage,
    status,
    canMakeRequest,
    message
  };
}

/**
 * Check if we should make an API request
 * Returns false if quota exceeded or user has disabled API calls
 */
export function shouldMakeApiRequest(): { allowed: boolean; reason?: string } {
  const quotaStatus = getQuotaStatus();
  
  if (!quotaStatus.canMakeRequest) {
    return {
      allowed: false,
      reason: quotaStatus.message
    };
  }
  
  // Check user preference
  if (typeof window !== 'undefined') {
    const disabled = localStorage.getItem('disable_coles_api');
    if (disabled === 'true') {
      return {
        allowed: false,
        reason: 'API calls disabled by user preference'
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Enable/disable API calls
 */
export function setApiEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    if (enabled) {
      localStorage.removeItem('disable_coles_api');
    } else {
      localStorage.setItem('disable_coles_api', 'true');
    }
  }
}

/**
 * Check if API calls are enabled
 */
export function isApiEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('disable_coles_api') !== 'true';
}

/**
 * Get time until quota reset (in days)
 */
export function getDaysUntilReset(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diff = nextMonth.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
