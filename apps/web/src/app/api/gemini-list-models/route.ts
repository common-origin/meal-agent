/**
 * API Route: List Available Models via REST API
 * GET /api/gemini-list-models
 * 
 * Calls the ListModels API to see what's actually available
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  console.log('🔍 Calling ListModels API...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured',
    });
  }
  
  // Try both v1 and v1beta
  const apis = [
    {
      version: 'v1',
      url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
    },
    {
      version: 'v1beta',
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    },
  ];
  
  const results = [];
  
  for (const api of apis) {
    try {
      console.log(`Fetching ${api.version} models...`);
      
      const response = await fetch(api.url);
      const data = await response.json();
      
      if (response.ok && data.models) {
        const modelNames = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m: any) => ({
            name: m.name,
            displayName: m.displayName,
            description: m.description,
            supportedMethods: m.supportedGenerationMethods,
          }));
        
        results.push({
          version: api.version,
          status: 'success',
          modelCount: modelNames.length,
          models: modelNames,
        });
        
        console.log(`✅ Found ${modelNames.length} models in ${api.version}`);
      } else {
        results.push({
          version: api.version,
          status: 'failed',
          error: JSON.stringify(data).substring(0, 200),
        });
        console.log(`❌ ${api.version} failed`);
      }
      
    } catch (error) {
      results.push({
        version: api.version,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`❌ ${api.version} error:`, error);
    }
  }
  
  // Find the first working API version
  const working = results.find(r => r.status === 'success');
  
  return NextResponse.json({
    success: working !== undefined,
    results,
    recommendation: working 
      ? `Use API version: ${working.version}, Available models: ${working.models?.map((m: any) => m.name.split('/').pop()).join(', ')}`
      : 'No working API versions found. Check your API key at https://aistudio.google.com/app/apikey',
  });
}
