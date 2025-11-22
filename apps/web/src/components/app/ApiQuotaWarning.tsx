"use client";

import { useEffect, useState } from "react";
import { Box, Button, Icon, Stack, Typography } from "@common-origin/design-system";
import { getQuotaStatus, setApiEnabled, isApiEnabled, getDaysUntilReset, type QuotaStatus } from "@/lib/apiQuota";

export default function ApiQuotaWarning() {
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [apiEnabled, setApiEnabledState] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadStatus = () => {
      // Load quota status
      const status = getQuotaStatus();
      setQuotaStatus(status);
      setApiEnabledState(isApiEnabled());
      
      // Check if user has dismissed warning for this session
      const dismissedKey = `quota_warning_dismissed_${status.status}`;
      setDismissed(sessionStorage.getItem(dismissedKey) === 'true');
    };
    
    loadStatus();
  }, []);

  const handleDismiss = () => {
    if (quotaStatus) {
      sessionStorage.setItem(`quota_warning_dismissed_${quotaStatus.status}`, 'true');
      setDismissed(true);
    }
  };

  const handleToggleApi = () => {
    const newState = !apiEnabled;
    setApiEnabled(newState);
    setApiEnabledState(newState);
  };

  // Don't show if no quota data, dismissed, or status is ok
  if (!quotaStatus || dismissed || quotaStatus.status === 'ok') {
    return null;
  }

  const daysUntilReset = getDaysUntilReset();

  // Color scheme based on status
  const bgColor = quotaStatus.status === 'exceeded' ? 'error' : 
                  quotaStatus.status === 'critical' ? 'error' : 
                  'warning';
  
  const iconColor = quotaStatus.status === 'exceeded' ? 'error' : 
                    quotaStatus.status === 'critical' ? 'error' : 
                    'warning';

  return (
    <Box 
      bg={bgColor}
      borderRadius="4" 
      p="md"
      mb="md"
    >
      <Stack direction="row" gap="md" alignItems="flex-start">
        <Icon 
          name="info"
          iconColor={iconColor}
          size="md"
        />
        
        <Stack direction="column" gap="sm"  >
          <Typography variant="subtitle" color="inverse">
            {quotaStatus.status === 'exceeded' && 'API Quota Exceeded'}
            {quotaStatus.status === 'critical' && 'API Quota Almost Exhausted'}
            {quotaStatus.status === 'warning' && 'High API Usage'}
          </Typography>
          
          <Typography variant="small" color="inverse">
            {quotaStatus.message}
          </Typography>
          
          <Stack direction="row" gap="md" alignItems="center">
            <Typography variant="small" color="inverse">
              {quotaStatus.used} / {quotaStatus.limit} requests used ({quotaStatus.percentage.toFixed(1)}%)
            </Typography>
            <Typography variant="small" color="inverse">
              • Resets in {daysUntilReset} {daysUntilReset === 1 ? 'day' : 'days'}
            </Typography>
          </Stack>
          
          <Box mt="sm">
            <Stack direction="row" gap="sm">
              {quotaStatus.status !== 'exceeded' && (
                <Button 
                  variant="secondary" 
                  size="small"
                  onClick={handleToggleApi}
                >
                  {apiEnabled ? 'Disable API Calls' : 'Enable API Calls'}
                </Button>
              )}
              
              <Button 
                variant="naked" 
                size="small"
                onClick={handleDismiss}
              >
                Dismiss
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
