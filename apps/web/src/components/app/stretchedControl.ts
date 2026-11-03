import { css } from "styled-components";
import { tokens } from "@common-origin/design-system";

/**
 * A card's main control (its title link or button) stretched over the whole
 * card, so the card is one click target without nesting other controls inside
 * it (#160, #180). The card must be positioned; other controls on it sit above
 * with `position: relative; z-index: 1`. Focus shows as a ring on the card.
 */
export const stretchedControl = css`
  color: inherit;
  text-decoration: none;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: ${tokens.semantic.radius.lg};
  }
  &:focus-visible {
    outline: none;
  }
  &:focus-visible::after {
    outline: ${tokens.semantic.border.focus};
    outline-offset: ${tokens.semantic.border.focusOffset};
  }
`;
