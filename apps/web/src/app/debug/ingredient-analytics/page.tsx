"use client";

import { useState, useEffect } from "react";
import { Box, Button, Stack, Typography, Alert, Divider, ResponsiveGrid } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { 
  getIngredientAnalytics, 
  generatePriorityReport, 
  exportIngredientData,
  resetIngredientAnalytics,
  type IngredientAnalytics 
} from "@/lib/ingredientAnalytics";

export default function IngredientAnalyticsPage() {
  const [analytics, setAnalytics] = useState<IngredientAnalytics | null>(null);
  const [showFullReport, setShowFullReport] = useState(false);
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    const loadData = () => {
      const data = getIngredientAnalytics();
      setAnalytics(data);
    };
    loadData();
  }, []);

  const loadAnalytics = () => {
    const data = getIngredientAnalytics();
    setAnalytics(data);
  };

  const handleGenerateReport = () => {
    const report = generatePriorityReport();
    setReportText(report);
    setShowFullReport(true);
  };

  const handleExportJSON = () => {
    const json = exportIngredientData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ingredient-analytics-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all ingredient analytics data? This cannot be undone.')) {
      resetIngredientAnalytics();
      loadAnalytics();
      setShowFullReport(false);
      setReportText("");
    }
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(reportText);
    alert('Report copied to clipboard!');
  };

  if (!analytics) {
    return (
      <Main>
        <Stack direction="column" gap="xl">
          <Typography variant="h1">Ingredient Analytics</Typography>
          <Alert variant="info">
            Loading analytics data... If no data appears, generate some meal plans first to start tracking ingredient usage.
          </Alert>
        </Stack>
      </Main>
    );
  }

  const coveragePercent = analytics.totalIngredients > 0
    ? Math.round((analytics.mappedIngredients / analytics.totalIngredients) * 100)
    : 0;

  const unmappedPercent = analytics.totalIngredients > 0
    ? Math.round((analytics.unmappedIngredients / analytics.totalIngredients) * 100)
    : 0;

  return (
    <Main>
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="column" gap="sm">
          <Typography variant="h1">Ingredient Analytics</Typography>
          <Typography variant="body" color="subdued">
            Track ingredient usage frequency to prioritize price mapping expansion
          </Typography>
        </Stack>

        {/* Summary Stats */}
        <Stack direction="column" gap="md">
          <Typography variant="h2">Summary</Typography>
          <ResponsiveGrid cols={1} colsSm={2} colsLg={4} gapX={4} gapY={4}>
            <Box bg="surface" p="lg" borderRadius="lg" border="subtle">
              <Stack direction="column" gap="xs">
                <Typography variant="caption" color="subdued">Tracked Recipes</Typography>
                <Typography variant="h2">{analytics.totalTrackedRecipes}</Typography>
              </Stack>
            </Box>
            <Box bg="surface" p="lg" borderRadius="lg" border="subtle">
              <Stack direction="column" gap="xs">
                <Typography variant="caption" color="subdued">Total Ingredients</Typography>
                <Typography variant="h2">{analytics.totalIngredients}</Typography>
              </Stack>
            </Box>
            <Box bg="success-subtle" border="success" p="lg" borderRadius="lg">
              <Stack direction="column" gap="xs">
                <Typography variant="caption" color="subdued">Mapped (Have Prices)</Typography>
                <Typography variant="h2">{analytics.mappedIngredients} ({coveragePercent}%)</Typography>
              </Stack>
            </Box>
            <Box bg="warning-subtle" border="warning" p="lg" borderRadius="lg">
              <Stack direction="column" gap="xs">
                <Typography variant="caption" color="subdued">Unmapped (Need Prices)</Typography>
                <Typography variant="h2">{analytics.unmappedIngredients} ({unmappedPercent}%)</Typography>
              </Stack>
            </Box>
          </ResponsiveGrid>
          <Typography variant="caption" color="subdued">
            Last updated: {new Date(analytics.lastUpdated).toLocaleString()}
          </Typography>
        </Stack>

        <Divider size="small" />

        {/* Actions */}
        <Stack direction="column" gap="md">
          <Typography variant="h2">Actions</Typography>
          <Stack direction="row" gap="sm">
            <Button onClick={handleGenerateReport} variant="primary">
              Generate Priority Report
            </Button>
            <Button onClick={handleExportJSON} variant="secondary">
              Export as JSON
            </Button>
            <Button onClick={handleReset} variant="secondary">
              Reset All Data
            </Button>
          </Stack>
        </Stack>

        {/* Report Display */}
        {showFullReport && (
          <>
            <Divider size="small" />
            <Stack direction="column" gap="md">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h2">Priority Report</Typography>
                <Button onClick={handleCopyReport} variant="secondary">
                  Copy to Clipboard
                </Button>
              </Stack>
              <Box 
                bg="surface" 
                p="lg" 
                borderRadius="lg"
                style={{ 
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  whiteSpace: 'pre',
                  overflowX: 'auto'
                }}
              >
                {reportText}
              </Box>
            </Stack>
          </>
        )}

        {/* Top Unmapped List Preview */}
        {analytics.unmappedPriorityList.length > 0 && !showFullReport && (
          <>
            <Divider size="small" />
            <Stack direction="column" gap="md">
              <Typography variant="h2">Top 10 Unmapped Ingredients</Typography>
              <Box bg="surface" p="lg" borderRadius="lg" border="subtle">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Rank</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Count</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Ingredient</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Normalized Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.unmappedPriorityList.slice(0, 10).map((ing, idx) => (
                      <tr key={ing.normalizedName} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{ing.count}</td>
                        <td style={{ padding: '0.5rem' }}>{ing.displayName}</td>
                        <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {ing.normalizedName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Stack>
          </>
        )}

        {/* Top Used Ingredients */}
        {analytics.mostUsedIngredients.length > 0 && !showFullReport && (
          <>
            <Divider size="small" />
            <Stack direction="column" gap="md">
              <Typography variant="h2">Top 10 Most Used Ingredients</Typography>
              <Box bg="surface" p="lg" borderRadius="lg" border="subtle">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Rank</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Count</th>
                      <th style={{ textAlign: 'center', padding: '0.5rem' }}>Mapped</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Ingredient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.mostUsedIngredients.slice(0, 10).map((ing, idx) => (
                      <tr key={ing.normalizedName} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{ing.count}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {ing.isMapped ? '✓' : '✗'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{ing.displayName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Stack>
          </>
        )}

        {/* Empty State */}
        {analytics.totalIngredients === 0 && (
          <>
            <Divider size="small" />
            <Alert variant="info">
              <Stack direction="column" gap="xs">
                <Typography variant="h3">No data yet</Typography>
                <Typography variant="body">
                  Generate some meal plans to start tracking ingredient usage. The system will automatically
                  record which ingredients are used most frequently to help prioritize price mapping expansion.
                </Typography>
              </Stack>
            </Alert>
          </>
        )}
      </Stack>
    </Main>
  );
}
