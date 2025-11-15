"use client";

import { ReactNode } from "react";
import { Box, Divider, Stack } from "@common-origin/design-system";

export interface ButtonGroupProps {
  left?: ReactNode;
  right?: ReactNode;
  fixed?: boolean;
}

export default function ButtonGroup({ 
  left,
  right,
  fixed = false 
}: ButtonGroupProps) {
  return (
    <div
      style={{
        ...(fixed && {
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          zIndex: 10,
        }),
      }}
    >
      <Divider size="small" />
      <Box py="lg">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {left && (
              <Stack direction="row" gap="sm">
                {left}
              </Stack>
            )}
          </div>
          <div>
            {right && (
              <Stack direction="row" gap="sm">
                {right}
              </Stack>
            )}
          </div>
        </div>
      </Box>
    </div>
  );
}
