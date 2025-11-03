/**
 * Test API Route for Gemini Connection
 * GET /api/test-gemini
 * 
 * Quick endpoint to verify Gemini API is working
 */

import { NextResponse } from 'next/server';
import { testGeminiConnection } from '@/lib/aiRecipeGenerator';

export const runtime = 'nodejs';

export async function GET() {
  console.log('🧪 Testing Gemini API connection...');
  
  // Check if API key exists
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      success: false,
      message: 'GEMINI_API_KEY not found in environment variables',
      details: 'Add your API key to .env.local',
    });
  }
  
  console.log('✅ API key found (length:', apiKey.length, ')');
  
  // Test connection
  try {
    const result = await testGeminiConnection();
    
    console.log('Test result:', result);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      apiKeyConfigured: true,
      apiKeyLength: apiKey.length,
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to test Gemini connection',
      error: error instanceof Error ? error.message : String(error),
      apiKeyConfigured: true,
    });
  }
}
