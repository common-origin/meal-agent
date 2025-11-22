import { NextResponse } from 'next/server';

/**
 * API endpoint for ingredient analytics
 * GET /api/ingredient-analytics
 * 
 * Returns JSON data about ingredient usage frequency and unmapped ingredients.
 * This is a server-side endpoint that can be used for admin dashboards or reporting.
 * 
 * Note: The actual analytics functions use localStorage, so this endpoint
 * returns instructions for client-side usage. For server-side analytics,
 * we'd need to store data in a database instead of localStorage.
 */
export async function GET() {
  return NextResponse.json({
    message: 'Ingredient analytics are stored client-side in localStorage',
    usage: {
      clientSide: 'Import getIngredientAnalytics() from @/lib/ingredientAnalytics',
      dataLocation: 'localStorage key: meal-agent:ingredient-frequency:v1',
      functions: [
        'getIngredientAnalytics() - Get full analytics report',
        'generatePriorityReport() - Get text report of top unmapped ingredients',
        'exportIngredientData() - Export as JSON',
        'resetIngredientAnalytics() - Clear all data'
      ]
    },
    note: 'To view analytics, use the /debug/ingredient-analytics page in the app'
  });
}
