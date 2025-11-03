/**
 * API Route: Test Gemini Models
 * GET /api/list-models
 * 
 * Tests which model names work with your API key
 */

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';

export async function GET() {
  console.log('🔍 Testing available Gemini models...');
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({
      error: 'GEMINI_API_KEY not configured',
    });
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Try common model names
  const modelNamesToTry = [
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
    'gemini-pro-vision',
    'models/gemini-1.5-flash-latest',
    'models/gemini-1.5-pro-latest',
    'models/gemini-pro',
  ];
  
  const results = [];
  
  for (const modelName of modelNamesToTry) {
    try {
      console.log(`Testing: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Hello');
      
      results.push({
        name: modelName,
        status: 'working',
        response: result.response.text().substring(0, 50),
      });
      
      console.log(`✅ ${modelName} works!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({
        name: modelName,
        status: 'failed',
        error: errorMessage.substring(0, 100),
      });
      
      console.log(`❌ ${modelName} failed:`, errorMessage.substring(0, 100));
    }
  }
  
  const workingModels = results.filter(r => r.status === 'working');
  
  return NextResponse.json({
    success: true,
    workingModels: workingModels.length,
    results,
    recommendation: workingModels.length > 0 
      ? `Use: ${workingModels[0].name}` 
      : 'No working models found',
  });
}

