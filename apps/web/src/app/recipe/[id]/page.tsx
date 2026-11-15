"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack, Typography, Box, Button, Checkbox, ChipGroup, IconButton, Alert, Menu, MenuDivider, MenuItem, Modal, ResponsiveGrid, TextField } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { tokens } from "@common-origin/design-system";
import { isFavorite, getRecipeRating, saveRecipeRating, blockRecipe, isRecipeBlocked } from "@/lib/storage";
import { hydrateFavoritesFromSupabase, hydrateRecipesFromSupabase, toggleFavorite } from "@/lib/hybridStorage";
import { RecipeLibrary } from "@/lib/library";
import { type Recipe } from "@/lib/types/recipe";
import { track } from "@/lib/analytics";
import { getRecipeSourceDisplay } from "@/lib/recipeDisplay";
import { formatTagsForDisplay } from "@/lib/tagNormalizer";
import RateRecipeModal from "@/components/app/RateRecipeModal";
import { getFamilySettings } from "@/lib/hybridStorage";
import type { RecipeRecipient } from "@/lib/types/settings";

/**
 * Parse instruction text that may contain markdown bold syntax
 * Converts **text** to actual bold rendering
 */
function parseInstructionWithHeading(instruction: string): { heading: string | null; body: string } {
  // Match pattern like "**Heading:** rest of text" or "**Heading** rest of text"
  const match = instruction.match(/^\*\*([^*]+)\*\*:?\s*/);
  
  if (match) {
    return {
      heading: match[1].trim(),
      body: instruction.slice(match[0].length).trim()
    };
  }
  
  return { heading: null, body: instruction };
}

type RecipePageProps = {
  params: Promise<{ id: string }>;
};

const stepNumberStyle: React.CSSProperties = {
  minWidth: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: tokens.semantic.color.fill.emphasis,
  font: tokens.semantic.typography.overline,
  borderRadius: '999px',
  color: tokens.semantic.color.text.inverse,
  fontWeight: 600,
  fontSize: '14px',
};

const metadataContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

export default function RecipePage({ params }: RecipePageProps) {
  const router = useRouter();
  const { id } = use(params);
  // The recipe and its per-recipe flags live in localStorage, which only the
  // browser has. Reading them during render made the server render "not
  // found" and the browser the recipe, a hydration mismatch (#200), so
  // they're read after mount. `undefined` means not loaded yet.
  const [loaded, setLoaded] = useState<{ id: string; recipe: Recipe | null } | null>(null);
  const recipe = loaded?.id === id ? loaded.recipe : undefined;
  const [favorited, setFavorited] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [blocked, setBlocked] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setFavorited(isFavorite(id));
    setRating(getRecipeRating(id) || 0);
    setBlocked(isRecipeBlocked(id));
    const cached = RecipeLibrary.getById(id);
    if (cached) {
      setLoaded({ id, recipe: cached });
    } else {
      // Not in this browser yet: it may be the household's, saved on another
      // device or by another member (#233). Check before saying "not found".
      hydrateRecipesFromSupabase({ force: true })
        .catch(() => false)
        .then(() => {
          if (!cancelled) setLoaded({ id, recipe: RecipeLibrary.getById(id) ?? null });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  // The household's favourites, from any device or member (#222)
  useEffect(() => {
    let cancelled = false;
    hydrateFavoritesFromSupabase()
      .then((favorites) => {
        if (!cancelled) setFavorited(favorites.includes(id));
      })
      .catch((err) => console.warn('Could not load favourites:', err));
    return () => {
      cancelled = true;
    };
  }, [id]);
  const [showBlockConfirm, setShowBlockConfirm] = useState<boolean>(false);

  // Email-recipe state
  const [savedRecipients, setSavedRecipients] = useState<RecipeRecipient[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [emailNote, setEmailNote] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getFamilySettings()
      .then((s) => {
        if (!cancelled) setSavedRecipients(s.recipeRecipients ?? []);
      })
      .catch(() => {
        if (!cancelled) setSavedRecipients([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  
  useEffect(() => {
    if (recipe) {
      track('page_view', { 
        page: 'recipe',
        recipeId: id,
        title: recipe.title,
        source: recipe.source.chef,
      });
    }
  }, [id, recipe]);

  const handleFavoriteClick = () => {
    setFavorited(toggleFavorite(id));
    track(favorited ? 'favorite_removed' : 'favorite_added', { recipeId: id });
  };
  
  // Rating lives in a modal from the options menu (RateRecipeModal holds the draft)
  const [showRatingModal, setShowRatingModal] = useState(false);

  const handleSaveRating = (newRating: number) => {
    setRating(newRating);
    saveRecipeRating(id, newRating);
    setShowRatingModal(false);
  };
  
  const handleBlockRecipe = () => {
    blockRecipe(id);
    setBlocked(true);
    setShowBlockConfirm(false);
  };

  const openEmailModal = () => {
    setEmailResult(null);
    setEmailNote('');
    setSelectedEmails(new Set(savedRecipients.map((r) => r.email)));
    setShowEmailModal(true);
  };

  const toggleRecipientSelected = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleSendEmail = async () => {
    if (selectedEmails.size === 0 || emailSending) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/share-recipe-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeId: id,
          recipientEmails: Array.from(selectedEmails),
          note: emailNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailResult({ kind: 'error', message: data?.error || 'Failed to send email' });
      } else {
        const sentCount = Array.isArray(data?.sent) ? data.sent.length : 0;
        const failedCount = Array.isArray(data?.failed) ? data.failed.length : 0;
        track('recipe_emailed', { recipeId: id, recipientCount: sentCount });
        if (failedCount > 0) {
          setEmailResult({
            kind: 'error',
            message: `Sent to ${sentCount}. Failed: ${failedCount}.`,
          });
        } else {
          setEmailResult({
            kind: 'success',
            message: `Recipe sent to ${sentCount} recipient${sentCount === 1 ? '' : 's'}.`,
          });
          setTimeout(() => setShowEmailModal(false), 1500);
        }
      }
    } catch (err) {
      setEmailResult({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Failed to send email',
      });
    } finally {
      setEmailSending(false);
    }
  };

  
  if (recipe === undefined) {
    return (
      <Main>
        <Typography variant="body" color="subdued">Loading recipe…</Typography>
      </Main>
    );
  }

  if (!recipe) {
    return (
      <Main>
        <Stack direction="column" gap="lg">
          <Button 
            variant="secondary" 
            size="large"
            iconName="arrowLeft"
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Typography variant="h1">Recipe not found</Typography>
          <Typography variant="body">
            The recipe with ID &quot;{id}&quot; could not be found.
          </Typography>
        </Stack>
      </Main>
    );
  }

  const chefName = getRecipeSourceDisplay(recipe);
  const isAIGenerated = recipe.id.startsWith("custom-ai-");

  return (
    <Main maxWidth={tokens.base.breakpoint.md}>
      <Stack direction="column" gap="xl">
        {/* Back button and favorite */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button 
            variant="secondary" 
            size="large"
            iconName="arrowLeft"
            onClick={() => router.back()}
          >
            Back
          </Button>
          
          {/* The design system's Menu: keyboard navigation, Escape, menu roles and focus come with it */}
          <Menu
            align="end"
            trigger={
              <IconButton
                variant="secondary"
                // kebab: the "more options" icon, as on the plan's meal menu
                iconName="kebab"
                size="medium"
                aria-label="Recipe options"
              />
            }
          >
            <MenuItem onSelect={handleFavoriteClick}>
              {favorited ? 'Remove from favourites' : 'Favourite this recipe'}
            </MenuItem>
            <MenuItem
              description={rating > 0 ? `Rated ${rating} of 5` : 'Not rated yet'}
              onSelect={() => setShowRatingModal(true)}
            >
              Rate this recipe…
            </MenuItem>
            <MenuItem
              description={
                savedRecipients.length === 0
                  ? 'Add recipients in Settings first'
                  : `${savedRecipients.length} recipient${savedRecipients.length === 1 ? '' : 's'} saved`
              }
              disabled={savedRecipients.length === 0}
              onSelect={openEmailModal}
            >
              Email recipe…
            </MenuItem>
            <MenuDivider />
            <MenuItem destructive disabled={blocked} onSelect={() => setShowBlockConfirm(true)}>
              Remove from plans
            </MenuItem>
          </Menu>
        </Stack>

        {/* Page-level, at the top of the content, so the default outlined Alert */}
        {blocked && (
          <Alert variant="warning">
            This recipe is blocked and will not appear in future AI meal plans.
          </Alert>
        )}

        {/* Recipe Header */}
        <Stack direction="column" gap="md">
          <Typography variant="h1">{recipe.title}</Typography>
          
          <div style={metadataContainerStyle}>
            {recipe.timeMins && (
              <Typography variant="body">{recipe.timeMins} mins</Typography>
            )}
            {recipe.serves && (
              <Typography variant="body">• Serves {recipe.serves}</Typography>
            )}
            {recipe.costPerServeEst && (
              <Typography variant="body">• ${recipe.costPerServeEst.toFixed(2)} per serve</Typography>
            )}
          </div>

          {recipe.tags && recipe.tags.length > 0 && (
            <ChipGroup 
              labels={formatTagsForDisplay([...new Set(recipe.tags)]).slice(0, 8)} 
            />
          )}
        </Stack>

        {/* Nutrition */}
        {recipe.nutrition && (
          <Box border="default" borderRadius="lg" p="lg" bg="surface.raised">
            <Stack direction="column" gap="md">
              <ResponsiveGrid cols={2} colsMd={4} gap="2">
                <Stack direction="column" gap="none">
                  <Typography variant="overline" color="subdued">CALORIES</Typography>
                  <Typography variant="subtitle">{recipe.nutrition.calories} kcal</Typography>
                </Stack>
                <Stack direction="column" gap="none">
                  <Typography variant="overline" color="subdued">PROTEIN</Typography>
                  <Typography variant="subtitle">{recipe.nutrition.protein}g</Typography>
                </Stack>
                <Stack direction="column" gap="none">
                  <Typography variant="overline" color="subdued">CARBS</Typography>
                  <Typography variant="subtitle">{recipe.nutrition.carbs}g</Typography>
                </Stack>
                <Stack direction="column" gap="none">
                  <Typography variant="overline" color="subdued">FAT</Typography>
                  <Typography variant="subtitle">{recipe.nutrition.fat}g</Typography>
                </Stack>
              </ResponsiveGrid>
            </Stack>
          </Box>
        )}

        {/* Ingredients */}
        <Box border="default" borderRadius="lg" p="lg" bg="surface.raised">
          <Stack direction="column" gap="md">
            <Typography variant="h2">Ingredients</Typography>
            
            <Stack direction="column" gap="sm">
              {recipe.ingredients.map((ingredient, index) => (
                <Stack key={index} direction="row" gap="sm" alignItems="baseline">
                  <Typography variant="body">•</Typography>
                  <Typography variant="body">
                    {ingredient.qty > 0 && `${ingredient.qty} `}
                    {ingredient.unit !== 'unit' && `${ingredient.unit} `}
                    {ingredient.name}
                    {ingredient.prep && `, ${ingredient.prep}`}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Box>

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 ? (
          <Box border="default" borderRadius="lg" p="lg" bg="surface.raised">
            <Stack direction="column" gap="md">
              <Typography variant="h2">Instructions</Typography>
              
              <Stack direction="column" gap="md">
                {recipe.instructions.map((instruction, index) => {
                  const { heading, body } = parseInstructionWithHeading(instruction);
                  return (
                    <Stack key={index} direction="row" gap="md" alignItems="flex-start">
                      <div style={stepNumberStyle}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Typography variant="body">
                          {heading && <><strong>{heading}</strong>{' '}</>}
                          {body}
                        </Typography>
                      </div>
                    </Stack>
                  );
                })}
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Box border="default" borderRadius="md" p="lg" bg="surface.raised">
            <Stack direction="column" gap="md">
              <Typography variant="h2">Preparation</Typography>
              <Typography variant="body">
                This recipe serves {recipe.serves || 4} people and takes approximately {recipe.timeMins || 30} minutes to prepare and cook.
              </Typography>
              <Typography variant="body">
                For detailed cooking instructions, please visit the source link below.
              </Typography>
            </Stack>
          </Box>
        )}

        {/* Rate recipe modal, from the options menu */}
        <RateRecipeModal
          isOpen={showRatingModal}
          recipeTitle={recipe.title}
          rating={rating}
          onSave={handleSaveRating}
          onClose={() => setShowRatingModal(false)}
        />

        {/* Block recipe confirmation modal */}
        <Modal
          isOpen={showBlockConfirm}
          onClose={() => setShowBlockConfirm(false)}
          title="Remove from plans"
          size="small"
          actions={[
            {
              label: 'Yes, block it',
              onClick: handleBlockRecipe,
              variant: 'danger',
            },
            {
              label: 'Cancel',
              onClick: () => setShowBlockConfirm(false),
              variant: 'secondary',
            },
          ]}
        >
          <Typography variant="body">
            Are you sure? This recipe will not appear in future AI meal plans.
          </Typography>
        </Modal>

        {/* Email recipe modal */}
        <Modal
          isOpen={showEmailModal}
          onClose={() => (emailSending ? undefined : setShowEmailModal(false))}
          title="Email this recipe"
          size="medium"
          actions={[
            {
              label: emailSending ? 'Sending…' : 'Send',
              onClick: handleSendEmail,
              variant: 'primary',
              disabled: selectedEmails.size === 0 || emailSending,
            },
            {
              label: 'Cancel',
              onClick: () => setShowEmailModal(false),
              variant: 'secondary',
              disabled: emailSending,
            },
          ]}
        >
          <Stack direction="column" gap="md">
            {savedRecipients.length === 0 ? (
              <Alert variant="info" appearance="borderless">
                You haven&apos;t saved any recipients yet. Add one in Settings to email recipes.
              </Alert>
            ) : (
              <>
                <Typography variant="small" color="subdued">
                  Select who should receive {recipe.title}.
                </Typography>
                <Stack direction="column" gap="sm">
                  {savedRecipients.map((r) => (
                    <Checkbox
                      key={r.email}
                      label={`${r.name} (${r.email})`}
                      checked={selectedEmails.has(r.email)}
                      onChange={() => toggleRecipientSelected(r.email)}
                    />
                  ))}
                </Stack>
                <TextField
                  label="Add a note (optional)"
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value.slice(0, 280))}
                  placeholder="e.g., Let's try this on Friday!"
                  helperText={`${emailNote.length}/280`}
                />
                {emailResult && (
                  <Alert variant={emailResult.kind === 'success' ? 'success' : 'error'} appearance="borderless">
                    {emailResult.message}
                  </Alert>
                )}
              </>
            )}
          </Stack>
        </Modal>

        {/* Source Attribution */}
        <Box border="default" borderRadius="md" p="md" bg="surface.raised">
          <Stack direction="column" gap="sm">
            <Typography variant="h4">Source</Typography>
            <Typography variant="small">
              {isAIGenerated ? (
                <>AI-generated recipe based on your family preferences</>
              ) : (
                <>
                  Recipe from {chefName}
                  {recipe.source.url && (
                    <>
                      {' • '}
                      <a 
                        href={recipe.source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: tokens.semantic.color.text.accent, textDecoration: 'underline' }}
                      >
                        View original
                      </a>
                    </>
                  )}
                </>
              )}
            </Typography>
            {recipe.source.domain && !isAIGenerated && (
              <Typography variant="small" color="subdued">
                {recipe.source.domain}
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Main>
  );
}