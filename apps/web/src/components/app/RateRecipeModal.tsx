"use client";

import { useState } from "react";
import { Modal, Stack, Typography } from "@common-origin/design-system";
import StarRating from "@/components/app/StarRating";

interface RateRecipeModalProps {
  isOpen: boolean;
  recipeTitle: string;
  /** The saved rating (0 when not rated): where the stars start each time the modal opens */
  rating: number;
  /** Called with the picked rating (1-5) when the household saves it */
  onSave: (rating: number) => void;
  onClose: () => void;
}

/**
 * Rates a recipe from its options menu: the stars set a draft, Save submits it, and Cancel or
 * closing discards it.
 */
export default function RateRecipeModal({ isOpen, recipeTitle, rating, onSave, onClose }: RateRecipeModalProps) {
  const [draftRating, setDraftRating] = useState(rating);

  // Start from the saved rating each time it opens, so a cancelled draft doesn't come back.
  // Adjusted while rendering when isOpen changes, rather than in an effect (React's guidance).
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraftRating(rating);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rate this recipe"
      size="small"
      actions={[
        {
          label: 'Save rating',
          onClick: () => onSave(draftRating),
          variant: 'primary',
          disabled: draftRating === 0,
        },
        {
          label: 'Cancel',
          onClick: onClose,
          variant: 'secondary',
        },
      ]}
    >
      <Stack direction="column" gap="md">
        <Typography variant="body" color="subdued">
          How did {recipeTitle} go down? Ratings shape which recipes we suggest.
        </Typography>
        <StarRating rating={draftRating} onChange={setDraftRating} size="large" />
      </Stack>
    </Modal>
  );
}
