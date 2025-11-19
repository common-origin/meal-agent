/**
 * StarRating Component
 * Interactive star rating component for recipes
 */

import { useState } from 'react';
import { Stack, IconButton } from '@common-origin/design-system';
import { tokens } from '@common-origin/design-system/tokens';

export type StarRatingProps = {
  rating: number; // Current rating (0-5)
  onChange?: (rating: number) => void; // Callback when rating changes
  readonly?: boolean; // If true, not interactive
  size?: 'small' | 'medium' | 'large';
};

export default function StarRating({ rating, onChange, readonly = false, size = 'medium' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  const displayRating = hoverRating !== null ? hoverRating : rating;
  
  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;
  
  const handleClick = (starRating: number) => {
    if (!readonly && onChange) {
      onChange(starRating);
    }
  };
  
  const handleMouseEnter = (starRating: number) => {
    if (!readonly) {
      setHoverRating(starRating);
    }
  };
  
  const handleMouseLeave = () => {
    if (!readonly) {
      setHoverRating(null);
    }
  };
  
  return (
    <div 
      style={{ 
        cursor: readonly ? 'default' : 'pointer',
        userSelect: 'none'
      }}
      onMouseLeave={handleMouseLeave}
    >
    <Stack 
      direction="row" 
      gap="xs" 
      alignItems="center"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayRating;
        
        return readonly ? (
          <div 
            key={star}
            style={{
              width: iconSize,
              height: iconSize,
              color: isFilled 
                ? tokens.semantic.color.icon.warning 
                : tokens.semantic.color.icon.subdued
            }}
          >
            <svg 
              width={iconSize} 
              height={iconSize} 
              viewBox="0 0 24 24" 
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        ) : (
          <IconButton
            key={star}
            variant="naked"
            iconName={isFilled ? 'star' : 'star'}
            size={size}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
          />
        );
      })}
      {rating > 0 && (
        <span 
          style={{ 
            fontSize: size === 'small' ? '12px' : size === 'large' ? '18px' : '14px',
            color: tokens.semantic.color.text.subdued,
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
