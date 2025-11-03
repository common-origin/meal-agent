/**
 * API Route: Test Gemini with Direct REST API
 * GET /api/test-gemini-rest
 * 
 * Tests Gemini using direct REST API calls instead of SDK
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  console.log('🔍 Testing Gemini REST API...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured',
    });
  }
  
  // Try both v1 and v1beta APIs with different models
  const tests = [
    {
      name: 'v1 - gemini-pro',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
    },
    {
      name: 'v1beta - gemini-pro',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
    },
    {
      name: 'v1 - gemini-1.5-flash',
      url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    },
    {
      name: 'v1beta - gemini-1.5-flash-latest',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    },
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`Testing: ${test.name}...`);
      
      const response = await fetch(test.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: 'Hello, say "working" if you can read this.'
            }]
          }]
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        results.push({
          test: test.name,
          status: 'working',
          statusCode: response.status,
          response: JSON.stringify(data).substring(0, 200),
        });
        console.log(`✅ ${test.name} works!`);
      } else {
        results.push({
          test: test.name,
          status: 'failed',
          statusCode: response.status,
          error: JSON.stringify(data).substring(0, 200),
        });
        console.log(`❌ ${test.name} failed:`, response.status);
      }
      
    } catch (error) {
      results.push({
        test: test.name,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`❌ ${test.name} error:`, error);
    }
  }
  
  const workingTests = results.filter(r => r.status === 'working');
  
  return NextResponse.json({
    success: workingTests.length > 0,
    workingApis: workingTests.length,
    results,
    recommendation: workingTests.length > 0 
      ? `Use: ${workingTests[0].test}` 
      : 'Check API key permissions at https://aistudio.google.com/app/apikey',
  });
}
