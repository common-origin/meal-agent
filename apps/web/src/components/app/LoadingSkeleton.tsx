"use client";

import { Box, Typography } from "@common-origin/design-system";
import styled, { keyframes } from "styled-components";
import { tokens } from "@common-origin/design-system";

const shimmer = keyframes`
  0% {
    background-position: -468px 0;
  }
  100% {
    background-position: 468px 0;
  }
`;

const SkeletonBox = styled(Box)`
  background: linear-gradient(
    to right,
    ${tokens.semantic.color.background.default} 0%,
    ${tokens.semantic.color.background.disabled} 50%,
    ${tokens.semantic.color.background.default} 100%
  );
  background-size: 800px 104px;
  animation: ${shimmer} 2s ease-in-out infinite;
  border-radius: ${tokens.base.border.radius[4]};
  height: 300px;
  width: 100%;
`;

interface LoadingSkeletonProps {
  count?: number;
  ariaLabel?: string;
}

/**
 * Accessible loading skeleton for meal cards
 * Includes proper ARIA labels for screen readers
 */
export default function LoadingSkeleton({ 
  count = 1, 
  ariaLabel = "Loading recipes" 
}: LoadingSkeletonProps) {
  return (
    <div 
      role="status" 
      aria-live="polite" 
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBox 
          key={index}
          border="subtle"
          p="lg"
          mb="md"
        />
      ))}
      {/* Screen reader text */}
      <span className="sr-only"><Typography variant="caption">{ariaLabel}</Typography></span>
    </div>
  );
}
