"use client";

import { ReactNode } from "react";
import styled from "styled-components";
import { tokens } from "@common-origin/design-system";

type BreakpointKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface MainProps {
  children: ReactNode;
  maxWidth?: BreakpointKey | string;
  background?: string;
}

const StyledMain = styled.main<{ $maxWidth: string; $background?: string }>`
  padding: 24px;
  padding-bottom: 64px;
  max-width: ${props => props.$maxWidth};
  margin: 0 auto;
  ${props => props.$background && `background: ${props.$background};`}
`;

export default function Main({ 
  children, 
  maxWidth = 'xl',
  background 
}: MainProps) {
  // Check if maxWidth is a breakpoint token or a custom value
  const isBreakpointToken = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(maxWidth as string);
  const maxWidthValue = isBreakpointToken 
    ? tokens.base.breakpoint[maxWidth as BreakpointKey]
    : maxWidth;
  
  return (
    <StyledMain $maxWidth={maxWidthValue as string} $background={background}>
      {children}
    </StyledMain>
  );
}
