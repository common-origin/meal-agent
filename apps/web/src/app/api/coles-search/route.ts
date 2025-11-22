/**
 * Coles Product Search API Route
 * Proxies requests to RapidAPI Coles Product Price API
 * Handles authentication and error handling
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawProduct {
  productName?: string;
  name?: string;
  title?: string;
  brand?: string;
  currentPrice?: string;
  price?: string;
  size?: string;
  packageSize?: string;
  url?: string;
  link?: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }
    
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    if (!rapidApiKey) {
      console.error('RAPIDAPI_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }
    
    // Normalize query
    const normalizedQuery = query.trim();
    
    console.log(`🔍 Searching Coles API for: "${normalizedQuery}"`);
    
    // Call RapidAPI Coles Product Price API
    // Note: The endpoint is /coles/product-search/ not /product-search
    const apiUrl = new URL('https://coles-product-price-api.p.rapidapi.com/coles/product-search/');
    apiUrl.searchParams.set('query', normalizedQuery);
    
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'coles-product-price-api.p.rapidapi.com'
      }
    });
    
    if (!response.ok) {
      console.error(`RapidAPI error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch from Coles API',
          details: response.statusText,
          statusCode: response.status
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('📦 Raw API response:', JSON.stringify(data).substring(0, 500));
    
    // Handle different possible response structures
    const products = data.products || data.results || [];
    
    // Transform response to match our interface
    const transformedResponse = {
      query: data.query || normalizedQuery,
      totalResults: data.total_results || data.totalResults || products.length,
      totalPages: data.total_pages || data.totalPages || 1,
      currentPage: data.current_page || data.currentPage || 1,
      results: products.map((product: RawProduct) => ({
        productName: product.productName || product.name || product.title || '',
        brand: product.brand || '',
        currentPrice: product.currentPrice || product.price || '',
        size: product.size || product.packageSize || '',
        url: product.url || product.link || ''
      }))
    };
    
    console.log(`✅ Found ${transformedResponse.results.length} products`);
    console.log('📋 First product:', JSON.stringify(transformedResponse.results[0], null, 2));
    
    return NextResponse.json(transformedResponse);
    
  } catch (error) {
    console.error('Coles API route error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
