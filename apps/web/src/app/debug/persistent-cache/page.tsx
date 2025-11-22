"use client";

import { useState } from "react";
import { Box, Button, Divider, ResponsiveGrid, Stack, Typography } from "@common-origin/design-system";
import { 
  getPersistentCacheStats, 
  getCachedIngredientNames,
  clearExpiredEntries,
  exportCacheForPersistence 
} from "@/lib/colesApiPersistentCache";

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export default function PersistentCachePage() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [cachedNames, setCachedNames] = useState<string[]>([]);
  const [exportedData, setExportedData] = useState<string>("");

  const loadStats = () => {
    const cacheStats = getPersistentCacheStats();
    setStats(cacheStats);
    setCachedNames(getCachedIngredientNames());
  };

  if (!stats) {
    loadStats();
  }

  const handleClearExpired = () => {
    const cleared = clearExpiredEntries();
    alert(`Cleared ${cleared} expired entries`);
    loadStats();
  };

  const handleExport = () => {
    const exported = exportCacheForPersistence();
    setExportedData(exported);
    
    // Copy to clipboard
    navigator.clipboard.writeText(exported);
    alert('Cache data copied to clipboard! Paste this into /apps/web/src/data/colesApiCache.json to persist.');
  };

  if (!stats) {
    return (
      <Box p="lg">
        <Typography variant="body">Loading cache statistics...</Typography>
      </Box>
    );
  }

  const oldestDate = stats.oldestEntry ? new Date(stats.oldestEntry).toLocaleDateString() : 'N/A';
  const newestDate = stats.newestEntry ? new Date(stats.newestEntry).toLocaleDateString() : 'N/A';

  return (
    <Box p="lg">
      <Stack direction="column" gap="lg">
        <Stack direction="column" gap="sm">
          <Typography variant="h1">Persistent API Cache</Typography>
          <Typography variant="body" color="subdued">
            View and manage the persistent cache for Coles API product data (30-day TTL)
          </Typography>
        </Stack>

        <Divider />

        {/* Cache Statistics */}
        <ResponsiveGrid cols={1} colsSm={2} colsLg={4}>
          <Box bg="surface" borderRadius="3" p="lg" border="default">
            <Stack direction="column" gap="xs">
              <Typography variant="caption" color="subdued">Total Entries</Typography>
              <Typography variant="h2">{stats.totalEntries}</Typography>
            </Stack>
          </Box>

          <Box bg="surface" borderRadius="3" p="lg" border="default">
            <Stack direction="column" gap="xs">
              <Typography variant="caption" color="subdued">Valid Entries</Typography>
              <Typography variant="h2">
                {stats.validEntries}
              </Typography>
            </Stack>
          </Box>

          <Box bg="surface" borderRadius="3" p="lg" border="default">
            <Stack direction="column" gap="xs">
              <Typography variant="caption" color="subdued">Expired Entries</Typography>
              <Typography variant="h2">
                {stats.expiredEntries}
              </Typography>
            </Stack>
          </Box>

          <Box bg="surface" borderRadius="3" p="lg" border="default">
            <Stack direction="column" gap="xs">
              <Typography variant="caption" color="subdued">Cache Age Range</Typography>
              <Typography variant="small">
                {oldestDate} - {newestDate}
              </Typography>
            </Stack>
          </Box>
        </ResponsiveGrid>

        <Divider />

        {/* Actions */}
        <Box>
          <Box style={{ marginBottom: '16px' }}>
            <Typography variant="h2">Cache Management</Typography>
          </Box>
          <Stack direction="row" gap="md">
            <Button onClick={handleClearExpired} variant="secondary" size="medium">
              Clear Expired Entries
            </Button>
            <Button onClick={handleExport} variant="primary" size="medium">
              Export Cache to Clipboard
            </Button>
            <Button onClick={loadStats} variant="secondary" size="medium">
              Refresh Stats
            </Button>
          </Stack>
        </Box>

        {/* Cached Ingredients List */}
        {cachedNames.length > 0 && (
          <>
            <Divider />
            <Box>
              <Box style={{ marginBottom: '16px' }}>
                <Typography variant="h2">
                  Cached Ingredients ({cachedNames.length})
                </Typography>
              </Box>
              <Box 
                bg="surface" 
                borderRadius="2" 
                p="md"
                style={{ maxHeight: '400px', overflow: 'auto' }}
              >
                <Stack direction="column" gap="xs">
                  {cachedNames.map((name, index) => (
                    <Box key={index} style={{ fontFamily: 'monospace' }}>
                      <Typography variant="small">• {name}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          </>
        )}

        {/* Export Preview */}
        {exportedData && (
          <>
            <Divider />
            <Box>
              <Box style={{ marginBottom: '16px' }}>
                <Typography variant="h2">
                  Exported Cache Data
                </Typography>
              </Box>
              <Box style={{ marginBottom: '8px' }}>
                <Typography variant="small" color="subdued">
                  Copy this data to /apps/web/src/data/colesApiCache.json to persist the cache
                </Typography>
              </Box>
              <Box 
                bg="surface" 
                borderRadius="2" 
                p="md"
                style={{ maxHeight: '400px', overflow: 'auto' }}
              >
                <pre style={{ 
                  fontSize: '12px', 
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {exportedData}
                </pre>
              </Box>
            </Box>
          </>
        )}

        <Divider />

        {/* How it Works */}
        <Box bg="surface" borderRadius="3" p="lg" border="default">
          <Stack direction="column" gap="md">
            <Typography variant="h3">How Persistent Cache Works</Typography>
            <Stack direction="column" gap="sm">
              <Typography variant="body">
                • <strong>30-Day TTL:</strong> Cached products expire after 30 days (vs 24 hours for localStorage)
              </Typography>
              <Typography variant="body">
                • <strong>In-Memory Cache:</strong> Loaded from colesApiCache.json at runtime
              </Typography>
              <Typography variant="body">
                • <strong>Manual Persistence:</strong> Use &quot;Export Cache&quot; button and paste into colesApiCache.json
              </Typography>
              <Typography variant="body">
                • <strong>Auto-Save:</strong> New API results are logged to console for manual copying
              </Typography>
              <Typography variant="body">
                • <strong>Reduces API Usage:</strong> Checks cache before making API calls
              </Typography>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
