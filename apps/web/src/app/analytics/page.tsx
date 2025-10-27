"use client";

import { useEffect, useState } from "react";
import { Stack, Typography, Button } from "@common-origin/design-system";
import { 
  getEventCountByType, 
  getPlanMetrics, 
  getCostOptimizationMetrics,
  getIngredientReuseMetrics,
  getSwapMetrics,
  clearEvents,
  isOptedOut,
  setOptOut,
  track
} from "@/lib/analytics";

export default function AnalyticsPage() {
  const [optOut, setOptOutState] = useState(isOptedOut);

  useEffect(() => {
    track('page_view', { page: '/analytics' });
  }, []);

  const handleToggleOptOut = () => {
    const newValue = !optOut;
    setOptOut(newValue);
    setOptOutState(newValue);
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      clearEvents();
      window.location.reload();
    }
  };

  if (optOut) {
    return (
      <main style={{ padding: 24 }}>
        <Stack direction="column" gap="xl">
          <Typography variant="h1">Analytics Dashboard</Typography>
          
          <div style={{
            padding: "24px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            border: "1px solid #dee2e6"
          }}>
            <Stack direction="column" gap="md">
              <Typography variant="h3">Analytics Disabled</Typography>
              <Typography variant="body">
                You have opted out of local analytics tracking. No usage data is being collected.
              </Typography>
              <Button variant="secondary" size="medium" onClick={handleToggleOptOut}>
                Enable Analytics
              </Button>
            </Stack>
          </div>
        </Stack>
      </main>
    );
  }

  const eventCounts = getEventCountByType();
  const planMetrics = getPlanMetrics(30);
  const costMetrics = getCostOptimizationMetrics(30);
  const reuseMetrics = getIngredientReuseMetrics(30);
  const swapMetrics = getSwapMetrics(30);

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h1">Analytics Dashboard</Typography>
          <Stack direction="row" gap="md">
            <Button variant="secondary" size="small" onClick={handleClearData}>
              Clear Data
            </Button>
            <Button variant="secondary" size="small" onClick={handleToggleOptOut}>
              Disable Analytics
            </Button>
          </Stack>
        </Stack>

        <Typography variant="body">
          Privacy-first analytics. All data stays on your device. Nothing is sent to external servers.
        </Typography>

        {/* Plan Metrics */}
        <div style={{
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #dee2e6"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">📋 Meal Planning (Last 30 Days)</Typography>
            
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Total Plans</Typography>
                <Typography variant="h2">{planMetrics.totalPlans}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Regenerations</Typography>
                <Typography variant="h2">{planMetrics.totalRegenerations}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Avg Cost</Typography>
                <Typography variant="h2">${planMetrics.avgCost.toFixed(2)}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Avg Days</Typography>
                <Typography variant="h2">{planMetrics.avgDayCount.toFixed(1)}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Conflict Rate</Typography>
                <Typography variant="h2">{planMetrics.conflictRate.toFixed(2)}</Typography>
              </div>
            </div>
          </Stack>
        </div>

        {/* Cost Optimization */}
        <div style={{
          padding: "16px",
          backgroundColor: "#d4edda",
          borderRadius: "8px",
          border: "1px solid #c3e6cb"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">💰 Cost Optimization</Typography>
            
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Total Savings</Typography>
                <div style={{ color: "#155724" }}>
                  <Typography variant="h2">
                    ${costMetrics.totalSavings.toFixed(2)}
                  </Typography>
                </div>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Avg Savings</Typography>
                <div style={{ color: "#155724" }}>
                  <Typography variant="h2">
                    {costMetrics.avgSavingsPercent.toFixed(1)}%
                  </Typography>
                </div>
              </div>
              
              <div style={{ flex: "1 1 200px" }}>
                <Typography variant="small">Top Method</Typography>
                <div style={{ color: "#155724" }}>
                  <Typography variant="h2">
                    {costMetrics.topMethod.replace(/_/g, ' ')}
                  </Typography>
                </div>
              </div>
            </div>
          </Stack>
        </div>

        {/* Ingredient Reuse */}
        <div style={{
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #dee2e6"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">♻️ Ingredient Reuse</Typography>
            
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Total Reuses</Typography>
                <Typography variant="h2">{reuseMetrics.totalReuses}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Avg Recipes</Typography>
                <Typography variant="h2">{reuseMetrics.avgRecipeCount.toFixed(1)}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Packs Saved</Typography>
                <Typography variant="h2">{reuseMetrics.totalPacksSaved}</Typography>
              </div>
            </div>
            
            {reuseMetrics.topIngredients.length > 0 && (
              <div>
                <Typography variant="h4">Top Reused Ingredients</Typography>
                <Stack direction="column" gap="xs">
                  {reuseMetrics.topIngredients.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body">{item.ingredient}</Typography>
                      <Typography variant="small">{item.count} times</Typography>
                    </div>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </div>

        {/* Swap Behavior */}
        <div style={{
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #dee2e6"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">🔄 Meal Swaps</Typography>
            
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Total Swaps</Typography>
                <Typography variant="h2">{swapMetrics.totalSwaps}</Typography>
              </div>
              
              <div style={{ flex: "1 1 150px" }}>
                <Typography variant="small">Per Plan</Typography>
                <Typography variant="h2">{swapMetrics.avgSwapsPerPlan.toFixed(1)}</Typography>
              </div>
            </div>
            
            {swapMetrics.topDays.length > 0 && (
              <div>
                <Typography variant="h4">Most Swapped Days</Typography>
                <Stack direction="column" gap="xs">
                  {swapMetrics.topDays.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body">{item.day}</Typography>
                      <Typography variant="small">{item.count} swaps</Typography>
                    </div>
                  ))}
                </Stack>
              </div>
            )}
          </Stack>
        </div>

        {/* Event Breakdown */}
        <div style={{
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">📊 Event Breakdown</Typography>
            
            <Stack direction="column" gap="xs">
              {Object.entries(eventCounts)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} style={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body">{type.replace(/_/g, ' ')}</Typography>
                    <Typography variant="small">{count}</Typography>
                  </div>
                ))}
            </Stack>
          </Stack>
        </div>

        <Typography variant="small">
          💡 All analytics data is stored locally in your browser. 
          Clear your browser data or use the &quot;Clear Data&quot; button to delete it.
        </Typography>
      </Stack>
    </main>
  );
}
