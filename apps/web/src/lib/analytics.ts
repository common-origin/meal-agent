// Privacy-safe local analytics using localStorage
// No data leaves the user's device

export type AnalyticsEventType = 
  | 'page_view' 
  | 'swap' 
  | 'export_csv' 
  | 'favorite_added' 
  | 'favorite_removed'
  | 'override_saved';

export type AnalyticsEvent = {
  type: AnalyticsEventType;
  timestamp: string;
  meta?: Record<string, unknown>;
};

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
