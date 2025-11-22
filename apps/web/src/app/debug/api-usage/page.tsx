"use client";

import { useState } from "react";
import { Box, Button, Container, Icon, Stack, Typography, ProgressBar } from "@common-origin/design-system";
import Main from "@/components/app/Main";

interface ApiUsageStats {
  used: number;
  limit: number;
  remaining: number;
  resetDate: string;
  dailyUsage: Array<{ date: string; count: number }>;
  topIngredients: Array<{ name: string; count: number }>;
}

export default function ApiUsagePage() {
  const [stats, setStats] = useState<ApiUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    
    // Load from localStorage
    const usageData = localStorage.getItem('coles_api_usage');
    const usage = usageData ? JSON.parse(usageData) : {
      monthlyRequests: {},
      ingredientRequests: {}
    };

    // Get current month key
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Calculate reset date (1st of next month)
    const resetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Get monthly usage
    const used = usage.monthlyRequests[monthKey] || 0;
    const limit = 1000; // Free tier limit
    const remaining = Math.max(0, limit - used);

    // Calculate daily usage for last 30 days
    const dailyUsage: Array<{ date: string; count: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const count = usage.monthlyRequests[dateKey] || 0;
      dailyUsage.push({ date: dateKey, count });
    }

    // Get top ingredients
    const topIngredients = Object.entries(usage.ingredientRequests || {})
      .map(([name, count]) => ({ name, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setStats({
      used,
      limit,
      remaining,
      resetDate: resetDate.toLocaleDateString('en-AU', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      dailyUsage,
      topIngredients
    });
    
    setLoading(false);
  };

  const clearUsageData = () => {
    if (confirm('Are you sure you want to clear all API usage data? This cannot be undone.')) {
      localStorage.removeItem('coles_api_usage');
      loadStats();
    }
  };

  if (loading || !stats) {
    return (
      <Main>
        <Container>
          <Box p="xl">
            <Typography variant="body">Loading...</Typography>
          </Box>
        </Container>
      </Main>
    );
  }

  const usagePercent = (stats.used / stats.limit) * 100;
  const isWarning = usagePercent > 80;
  const isCritical = usagePercent > 95;

  return (
    <Main>
      <Container>
        <Box p="xl">
          <Stack direction="column" gap="xl">
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="column" gap="xs">
                <Typography variant="h1">API Usage Monitor</Typography>
                <Typography variant="body" color="subdued">
                  Track your Coles Product Price API usage
                </Typography>
              </Stack>
              <Button 
                variant="secondary" 
                iconName="refresh" 
                onClick={loadStats}
              >
                Refresh
              </Button>
            </Stack>

            {/* Warning Banner */}
            {isWarning && (
              <Box 
                bg={isCritical ? "error" : "warning"} 
                borderRadius="4" 
                p="md"
              >
                <Stack direction="row" gap="sm" alignItems="center">
                  <Icon 
                    name="info" 
                    iconColor={isCritical ? "error" : "warning"}
                  />
                  <Stack direction="column" gap="xs">
                    <Typography variant="subtitle" color="inverse">
                      {isCritical ? 'Critical: API Quota Almost Exhausted' : 'Warning: High API Usage'}
                    </Typography>
                    <Typography variant="small" color="inverse">
                      {isCritical 
                        ? 'You have used over 95% of your monthly quota. API calls will be disabled when limit is reached.'
                        : 'You have used over 80% of your monthly quota. Consider reducing API calls or waiting for quota reset.'
                      }
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* Usage Overview */}
            <Box border="subtle" borderRadius="4" p="lg" bg="surface">
              <Stack direction="column" gap="lg">
                <Typography variant="h3">Monthly Usage</Typography>
                
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="column" gap="xs">
                    <Typography variant="h2">
                      {stats.used} / {stats.limit}
                    </Typography>
                    <Typography variant="small" color="subdued">
                      Requests this month
                    </Typography>
                  </Stack>
                  
                  <Stack direction="column" gap="xs" alignItems="flex-end">
                    <Typography variant="h3" color="subdued">
                      {stats.remaining}
                    </Typography>
                    <Typography variant="small" color="subdued">
                      Remaining
                    </Typography>
                  </Stack>
                </Stack>

                <Box>
                  <ProgressBar 
                    value={usagePercent}
                  />
                  <Box mt="xs">
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="small" color="subdued">
                        {usagePercent.toFixed(1)}% used
                      </Typography>
                      <Typography variant="small" color="subdued">
                        Resets: {stats.resetDate}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              </Stack>
            </Box>            {/* Daily Usage Chart */}
            <Box border="subtle" borderRadius="4" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Daily Usage (Last 30 Days)</Typography>
                
                <Box style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
                  {stats.dailyUsage.map((day) => {
                    const maxCount = Math.max(...stats.dailyUsage.map(d => d.count), 1);
                    const heightPercent = (day.count / maxCount) * 100;
                    
                    return (
                      <Box
                        key={day.date}
                        style={{
                          flex: 1,
                          height: `${heightPercent}%`,
                          backgroundColor: day.count > 50 ? '#ef4444' : day.count > 20 ? '#f59e0b' : '#3b82f6',
                          borderRadius: '2px',
                          minHeight: day.count > 0 ? '4px' : '0',
                        }}
                      />
                    );
                  })}
                </Box>
                
                <Typography variant="small" color="subdued">
                  Hover over bars to see daily request counts
                </Typography>
              </Stack>
            </Box>

            {/* Top Ingredients */}
            {stats.topIngredients.length > 0 && (
              <Box border="subtle" borderRadius="4" p="lg" bg="surface">
                <Stack direction="column" gap="md">
                  <Typography variant="h3">Most Searched Ingredients</Typography>
                  
                  <Stack direction="column" gap="sm">
                    {stats.topIngredients.map((ingredient, index) => (
                      <Stack 
                        key={ingredient.name} 
                        direction="row" 
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Stack direction="row" gap="sm" alignItems="center">
                          <Box style={{ minWidth: '20px' }}>
                            <Typography variant="small" color="subdued">
                              {index + 1}.
                            </Typography>
                          </Box>
                          <Typography variant="body">{ingredient.name}</Typography>
                        </Stack>
                        <Typography variant="small" color="subdued">
                          {ingredient.count} requests
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </Box>
            )}

            {/* Tips & Best Practices */}
            <Box border="subtle" borderRadius="4" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Optimization Tips</Typography>
                
                <Stack direction="column" gap="sm">
                  <Stack direction="row" gap="xs" alignItems="flex-start">
                    <Icon name="checkRing" iconColor="success" size="sm" />
                    <Typography variant="small">
                      <strong>Cache is working:</strong> API results are cached for 24 hours in localStorage and 30 days in persistent cache
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" gap="xs" alignItems="flex-start">
                    <Icon name="checkRing" iconColor="success" size="sm" />
                    <Typography variant="small">
                      <strong>Batch requests:</strong> Use &quot;Get Live Prices&quot; button once per week instead of refreshing frequently
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" gap="xs" alignItems="flex-start">
                    <Icon name="checkRing" iconColor="success" size="sm" />
                    <Typography variant="small">
                      <strong>Static fallback:</strong> 179 products have pre-mapped prices that don&apos;t use API quota
                    </Typography>
                  </Stack>
                  
                  <Stack direction="row" gap="xs" alignItems="flex-start">
                    <Icon name="info" iconColor="subdued" size="sm" />
                    <Typography variant="small">
                      <strong>Quota resets:</strong> Your 1,000 request limit resets on the 1st of each month
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </Box>

            {/* Danger Zone */}
            <Box border="error" borderRadius="4" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Danger Zone</Typography>
                
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="column" gap="xs">
                    <Typography variant="body">Clear Usage Data</Typography>
                    <Typography variant="small" color="subdued">
                      Remove all tracked API usage data. This will not affect your actual API quota.
                    </Typography>
                  </Stack>
                  <Button 
                    variant="secondary" 
                    iconName="trash"
                    onClick={clearUsageData}
                  >
                    Clear Data
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Main>
  );
}
