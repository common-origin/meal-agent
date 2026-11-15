/**
 * StarRating Component
 * Interactive star rating component for recipes
 */

import { useState } from 'react';
import styled from 'styled-components';
import { Stack, IconButton } from '@common-origin/design-system';
import { tokens } from '@common-origin/design-system/tokens';

export type StarRatingProps = {
  rating: number; // Current rating (0-5)
  onChange: (rating: number) => void; // Called with the star clicked (1-5)
  size?: 'small' | 'medium' | 'large';
};

/**
 * A star the household can click: solid amber up to the rating (or the star being hovered or
 * focused), grey outline after it. The design system's icons are line icons since 3.3, so the
 * selected ones fill in here. Colours come from the theme variables, falling back to the light
 * values, so they'd follow a dark theme. `data-filled` drives the style and lets tests check it.
 */
const RatingStarButton = styled(IconButton)`
  & svg {
    color: var(--co-semantic-color-icon-muted, ${tokens.semantic.color.icon.muted});
    fill: none;
  }

  &[data-filled='true'] svg {
    color: var(--co-semantic-color-icon-warning, ${tokens.semantic.color.icon.warning});
    fill: currentColor;
  }
`;

export default function StarRating({ rating, onChange, size = 'medium' }: StarRatingProps) {
  // The star being previewed, by mouse hover or keyboard focus; null shows the saved rating
  const [previewRating, setPreviewRating] = useState<number | null>(null);

  const displayRating = previewRating ?? rating;

  return (
    <div
      // One labelled group that states the current rating; each star is a plain "Rate n stars" action
      role="group"
      aria-label={rating > 0 ? `Rating: ${rating} of 5` : 'Not rated yet'}
      style={{ userSelect: 'none' }}
      onMouseLeave={() => setPreviewRating(null)}
    >
    <Stack
      direction="row"
      gap="xs"
      alignItems="center"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <RatingStarButton
          key={star}
          variant="naked"
          iconName="star"
          size={size}
          data-filled={star <= displayRating}
          onClick={() => onChange(star)}
          onMouseEnter={() => setPreviewRating(star)}
          // Keyboard users get the same preview as hovering
          onFocus={() => setPreviewRating(star)}
          onBlur={() => setPreviewRating(null)}
          aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
        />
      ))}
      {rating > 0 && (
        <span
          // The group's label already says the rating
          aria-hidden="true"
          style={{
            fontSize: size === 'small' ? '12px' : size === 'large' ? '18px' : '14px',
            color: tokens.semantic.color.text.muted,
            marginLeft: '4px'
          }}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </Stack>
    </div>
  );
}
