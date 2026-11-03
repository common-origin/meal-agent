"use client";

import styled, { keyframes } from "styled-components";
import { tokens } from "@common-origin/design-system";

/**
 * Loading placeholders shared by the plan's day cards and the recipe cards
 * (#177, #181): grey bars that pulse, still under reduced motion.
 */

const pulse = keyframes`
  from { opacity: 1; }
  to { opacity: 0.5; }
`;

/** A grey bar in place of text or a control. Inline, so on a text line it keeps that line's height. */
export const Bone = styled.span<{ $width: string }>`
  display: inline-block;
  vertical-align: middle;
  width: ${({ $width }) => $width};
  max-width: 100%;
  height: 0.75em;
  border-radius: ${tokens.semantic.radius.sm};
  background: ${tokens.semantic.color.fill.muted};
  animation: ${pulse} 1s ${tokens.semantic.motion.easing.standard} infinite alternate;
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

/** The ⋮ icon's footprint: a thin, rounded upright. */
export const KebabMark = styled(Bone)`
  height: 1rem;
  border-radius: ${tokens.semantic.radius.full};
`;

/** A Chip's footprint: a pill the chip's height. */
export const ChipBone = styled(Bone)`
  display: block;
  height: 1.5rem;
  border-radius: ${tokens.semantic.radius.full};
`;
