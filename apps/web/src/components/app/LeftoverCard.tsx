"use client";

import { Stack, Typography, Box, ChipGroup } from "@common-origin/design-system";

export type LeftoverCardProps = {
  originalRecipeTitle: string;
  originalDay: string; // e.g., "Monday"
};

/**
 * Leftover Card Component
 * Visual placeholder for leftover days from bulk cook meals
 */
export default function LeftoverCard({ 
  originalRecipeTitle,
  originalDay
}: LeftoverCardProps) {
  return (
    <Box 
      bg="default"
      borderRadius="md"
      p="md"
      border="default"
    >
      <div 
        role="article"
        aria-label={`Leftovers from ${originalDay}'s ${originalRecipeTitle} - no cooking needed today`}
        style={{
          opacity: 0.85,
          background: "linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%)",
          borderRadius: "8px",
          padding: "16px"
        }}
      >
        <Stack direction="column" gap="md">
          <Stack direction="row" gap="sm" alignItems="center">
            <div style={{ opacity: 0.7 }}>
              <Typography variant="h3">
                <span role="img" aria-label="Food bowl">🍲</span> Leftovers
              </Typography>
            </div>
            <div aria-label="This is a bulk cook meal">
              <ChipGroup labels={["Bulk Cook"]} variant="default" />
            </div>
          </Stack>
          
          <div style={{ opacity: 0.7 }}>
            <Typography variant="body">
              From {originalDay}&apos;s {originalRecipeTitle}
            </Typography>
          </div>
          
          <div style={{ opacity: 0.6 }}>
            <Typography variant="small">
              No cooking needed today! Enjoy the prepared meal from yesterday.
            </Typography>
          </div>
        </Stack>
      </div>
    </Box>
  );
}
