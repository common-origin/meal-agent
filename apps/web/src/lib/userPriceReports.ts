/**
 * User Price Reports
 * Allows users to report actual prices they paid for ingredients
 * Stores in localStorage for MVP (will move to database later)
 */

export interface UserPriceReport {
  ingredientName: string;
  normalizedName: string;
  price: number;
  quantity: number;
  unit: string;
  location?: string; // Optional: suburb/store
  reportedAt: string; // ISO timestamp
  userId?: string; // Optional: for future user tracking
}

const STORAGE_KEY = 'meal-agent-price-reports';

/**
 * Get all price reports from localStorage
 */
export function getAllPriceReports(): UserPriceReport[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load price reports:', error);
    return [];
  }
}

/**
 * Add a new price report
 */
export function addPriceReport(report: Omit<UserPriceReport, 'reportedAt'>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const reports = getAllPriceReports();
    const newReport: UserPriceReport = {
      ...report,
      reportedAt: new Date().toISOString(),
    };
    
    reports.push(newReport);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
    
    console.log('✅ Price report saved:', newReport);
  } catch (error) {
    console.error('Failed to save price report:', error);
  }
}

/**
 * Get recent price reports for a specific ingredient (within last N days)
 */
export function getRecentPriceReports(
  normalizedName: string,
  maxDays: number = 14
): UserPriceReport[] {
  const allReports = getAllPriceReports();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxDays);
  
  return allReports.filter(report => {
    const reportDate = new Date(report.reportedAt);
    return report.normalizedName === normalizedName && reportDate >= cutoff;
  });
}

/**
 * Get average price from recent reports
 */
export function getAveragePriceFromReports(
  normalizedName: string,
  maxDays: number = 14
): { avgPrice: number; reportCount: number; lastUpdated: string } | null {
  const reports = getRecentPriceReports(normalizedName, maxDays);
  
  if (reports.length === 0) {
    return null;
  }
  
  // Calculate average price (weighted by quantity for fairness)
  const totalPrice = reports.reduce((sum, r) => sum + r.price, 0);
  const avgPrice = totalPrice / reports.length;
  
  // Get most recent report date
  const mostRecent = reports.reduce((latest, r) => {
    return new Date(r.reportedAt) > new Date(latest.reportedAt) ? r : latest;
  });
  
  return {
    avgPrice: Math.round(avgPrice * 100) / 100,
    reportCount: reports.length,
    lastUpdated: mostRecent.reportedAt,
  };
}

/**
 * Clear all price reports (for testing/debugging)
 */
export function clearAllPriceReports(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  console.log('🗑️ All price reports cleared');
}

/**
 * Get statistics about price reports
 */
export function getPriceReportStats(): {
  totalReports: number;
  uniqueIngredients: number;
  oldestReport: string | null;
  newestReport: string | null;
} {
  const reports = getAllPriceReports();
  
  if (reports.length === 0) {
    return {
      totalReports: 0,
      uniqueIngredients: 0,
      oldestReport: null,
      newestReport: null,
    };
  }
  
  const uniqueIngredients = new Set(reports.map(r => r.normalizedName)).size;
  
  const sortedByDate = [...reports].sort((a, b) => 
    new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime()
  );
  
  return {
    totalReports: reports.length,
    uniqueIngredients,
    oldestReport: sortedByDate[0].reportedAt,
    newestReport: sortedByDate[sortedByDate.length - 1].reportedAt,
  };
}
