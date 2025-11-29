'use client';

import { useState } from 'react';
import { Box, Button, Stack, Typography, Alert, Divider, ResponsiveGrid } from '@common-origin/design-system';
import Main from '@/components/app/Main';
import { 
  searchColesProducts, 
  getRateLimitStats, 
  getCacheStats,
  parsePrice,
  calculatePricePerUnit,
  clearColesApiCache,
  type ColesApiProduct 
} from '@/lib/colesApi';

export default function ColesApiTestPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ColesApiProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [rateLimitStats, setRateLimitStats] = useState(getRateLimitStats());
  const [cacheStats, setCacheStats] = useState(getCacheStats());

  const refreshStats = () => {
    setRateLimitStats(getRateLimitStats());
    setCacheStats(getCacheStats());
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const response = await searchColesProducts(searchQuery, 10);
      const endTime = Date.now();
      
      if (response) {
        setResults(response.results);
        setSearchTime(endTime - startTime);
        refreshStats();
      } else {
        setError('No results found or API limit reached');
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    clearColesApiCache();
    setResults([]);
    setError(null);
    setSearchTime(null);
    refreshStats();
    alert('Cache cleared!');
  };

  const handleQuickTest = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <Main>
      <Stack direction="column" gap="xl">
        <Box>
          <Typography variant="h1">Coles API Test Dashboard</Typography>
          <Typography variant="body">
            Test RapidAPI integration, caching, and rate limiting
          </Typography>
        </Box>

        {/* Stats Cards */}
        <ResponsiveGrid cols={1} colsSm={2} gapX={4} gapY={4}>
          <Box bg="surface" p="md" style={{ borderRadius: '8px' }}>
            <Typography variant="h2">Rate Limit</Typography>
            <Stack direction="column" gap="sm">
              <Typography variant="body">
                <strong>Month:</strong> {rateLimitStats.month}
              </Typography>
              <Typography variant="body">
                <strong>Used:</strong> {rateLimitStats.used} / {rateLimitStats.limit}
              </Typography>
              <Typography variant="body">
                <strong>Remaining:</strong> {rateLimitStats.remaining}
              </Typography>
              <Box 
                style={{ 
                  height: '12px', 
                  backgroundColor: '#f0f0f0',
                  borderRadius: '6px', 
                  overflow: 'hidden',
                  marginTop: '12px'
                }}
              >
                <Box 
                  bg={rateLimitStats.used > 900 ? 'error' : 'success'}
                  style={{ 
                    height: '100%', 
                    width: `${(rateLimitStats.used / rateLimitStats.limit) * 100}%`,
                    transition: 'width 0.3s ease'
                  }}
                />
              </Box>
            </Stack>
          </Box>

          <Box bg="surface" p="md" style={{ borderRadius: '8px' }}>
            <Stack direction="column" gap="md">
              <Typography variant="h2">Cache Stats</Typography>
              <Stack direction="column" gap="sm">
              <Typography variant="body">
                <strong>Entries:</strong> {cacheStats.entries}
              </Typography>
              <Typography variant="body">
                <strong>Size:</strong> {cacheStats.sizeKB} KB
              </Typography>
              <Button onClick={handleClearCache} variant="secondary" size="medium">
                Clear Cache
              </Button>
              </Stack>
            </Stack>
          </Box>
        </ResponsiveGrid>

        <Divider />

        {/* Search Interface */}
        <Stack direction="column" gap="md">
          <Typography variant="h2">Product Search</Typography>
          <Stack direction="column" gap="md">
            <Box style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter ingredient name (e.g., chicken breast)"
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '16px'
                }}
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading || !searchQuery.trim()}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </Box>

            {searchTime !== null && (
              <Typography variant="caption" color="subdued">
                Search completed in {searchTime}ms
              </Typography>
            )}

            {error && (
              <Alert variant="error">{error}</Alert>
            )}

            {results.length > 0 && (
              <Stack direction="column" gap="md">
                <Typography variant="h3">
                  Found {results.length} products:
                </Typography>
                <Stack direction="column" gap="md">
                  {results.map((product, index) => {
                    const price = parsePrice(product.currentPrice);
                    const pricePerUnit = calculatePricePerUnit(price, product.size);
                    
                    return (
                      <Box key={index} bg="surface" p="md" style={{ borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                        <Stack direction="column" gap="sm">
                          <Typography variant="h4">{product.productName}</Typography>
                          <Typography variant="body" color="subdued">
                            <strong>Brand:</strong> {product.brand}
                          </Typography>
                          <Typography variant="body">
                            <strong>Price:</strong> {product.currentPrice}
                          </Typography>
                          <Typography variant="body">
                            <strong>Size:</strong> {product.size}
                          </Typography>
                          <Typography variant="caption" color="subdued">
                            Price per 100g/ml: ${pricePerUnit.toFixed(2)}
                          </Typography>
                          <a 
                            href={product.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: '#0066cc', textDecoration: 'underline', fontSize: '14px' }}
                          >
                            View on Coles →
                          </a>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              </Stack>
            )}
          </Stack>
        </Stack>

        {/* Quick Test Buttons */}
        <Stack direction="column" gap="md">
          <Typography variant="h2">Quick Tests</Typography>
          <Box style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button 
              onClick={() => handleQuickTest('chicken breast')}
              variant="secondary"
              size="medium"
            >
              Chicken Breast
            </Button>
            <Button 
              onClick={() => handleQuickTest('milk')}
              variant="secondary"
              size="medium"
            >
              Milk
            </Button>
            <Button 
              onClick={() => handleQuickTest('bread')}
              variant="secondary"
              size="medium"
            >
              Bread
            </Button>
            <Button 
              onClick={() => handleQuickTest('olive oil')}
              variant="secondary"
              size="medium"
            >
              Olive Oil
            </Button>
            <Button 
              onClick={() => handleQuickTest('eggs')}
              variant="secondary"
              size="medium"
            >
              Eggs
            </Button>
          </Box>
        </Stack>
      </Stack>
    </Main>
  );
}
