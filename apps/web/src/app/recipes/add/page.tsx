"use client";

import { useState } from "react";
import { Stack, Typography, Button, Box, TextField, NumberInput, Dropdown, List, ListItem, IconButton } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ButtonGroup from "@/components/app/ButtonGroup";
import { tokens } from "@common-origin/design-system/tokens";
import { RecipeLibrary } from "@/lib/library";
import { track } from "@/lib/analytics";
import type { Recipe, Ingredient } from "@/lib/types/recipe";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AddRecipePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'choice' | 'image' | 'url' | 'manual'>('choice');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [recipeUrl, setRecipeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [timeMins, setTimeMins] = useState('');
  const [serves, setServes] = useState('4');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [instructions, setInstructions] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');

  const [ingredientName, setIngredientName] = useState('');
  const [ingredientQty, setIngredientQty] = useState('');
  const [ingredientUnit, setIngredientUnit] = useState<'g'|'ml'|'tsp'|'tbsp'|'unit'>('g');
  const [instructionInput, setInstructionInput] = useState('');

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractFromImage = async () => {
    if (!imagePreview) return;

    setExtracting(true);
    
    try {
      const response = await fetch('/api/extract-recipe-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a copyright/recitation block
        if (data.blocked && data.reason === 'RECITATION') {
          alert('⚠️ Copyright Detected\n\n' + data.details);
        } else if (data.blocked) {
          alert('⚠️ Content Blocked\n\n' + data.details);
        } else {
          throw new Error(data.error || 'Failed to extract recipe');
        }
        return;
      }

      const recipe = data.recipe;
      setTitle(recipe.title || '');
      setTimeMins(recipe.timeMins?.toString() || '');
      setServes(recipe.serves?.toString() || '4');
      setIngredients(recipe.ingredients || []);
      setInstructions(recipe.instructions || []);

      track('page_view', { page: 'recipe_extraction_success' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to extract recipe');
    } finally {
      setExtracting(false);
    }
  };

  const handleExtractFromUrl = async () => {
    if (!recipeUrl) return;

    setExtracting(true);
    
    try {
      const response = await fetch('/api/extract-recipe-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: recipeUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract recipe');
      }

      const recipe = data.recipe;
      setTitle(recipe.title || '');
      setTimeMins(recipe.timeMins?.toString() || '');
      setServes(recipe.serves?.toString() || '4');
      setIngredients(recipe.ingredients || []);
      setInstructions(recipe.instructions || []);
      setSourceUrl(recipeUrl);

      track('page_view', { page: 'recipe_url_extraction_success' });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to extract recipe from URL');
    } finally {
      setExtracting(false);
    }
  };

  const handleAddIngredient = () => {
    if (!ingredientName) return;
    
    setIngredients([
      ...ingredients,
      {
        name: ingredientName,
        qty: parseFloat(ingredientQty) || 0,
        unit: ingredientUnit,
      },
    ]);
    
    setIngredientName('');
    setIngredientQty('');
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const handleAddInstruction = () => {
    if (!instructionInput.trim()) return;
    setInstructions([...instructions, instructionInput.trim()]);
    setInstructionInput('');
  };

  const handleRemoveInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = () => {
    if (!title || ingredients.length === 0) {
      alert('Please provide at least a title and ingredients');
      return;
    }

    if (!source.trim()) {
      alert('Please provide a source/attribution for this recipe');
      return;
    }

    setSaving(true);

    try {
      // Estimate cost per serve based on number of ingredients (rough heuristic)
      // Average $1.50 per ingredient, divided by servings
      const estimatedCost = ingredients.length > 0 
        ? (ingredients.length * 1.5) / (parseInt(serves) || 4)
        : undefined;
      
      const recipe: Recipe = {
        id: `custom-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        source: {
          url: sourceUrl || '',
          domain: 'user-added',
          chef: source.trim(), // Store the user's source/attribution
          license: 'unknown',
          fetchedAt: new Date().toISOString(),
        },
        timeMins: parseInt(timeMins) || undefined,
        serves: parseInt(serves) || 4,
        tags: [],
        ingredients,
        instructions: instructions.length > 0 ? instructions : undefined,
        costPerServeEst: estimatedCost,
      };

      RecipeLibrary.addCustomRecipes([recipe]);
      
      track('page_view', { page: 'recipe_added', source: mode });
      
      router.push(`/recipe/${recipe.id}`);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      alert('Failed to save recipe');
      setSaving(false);
    }
  };

  if (mode === 'choice') {
    return (
      <Main maxWidth="md">
        <Stack direction="column" gap="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Add recipe</Typography>
            <Link href="/plan" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="large">Cancel</Button>
            </Link>
          </Stack>

          <Typography variant="body">
            Choose how you&apos;d like to add your recipe:
          </Typography>

          <Stack direction="column" gap="md">
            <button
              onClick={() => setMode('image')}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Typography variant="h3">Upload Photo</Typography>
              <Typography variant="body">
                Take a photo of a recipe from a cookbook or magazine. AI will extract the recipe details for you.
              </Typography>
            </button>

            <button
              onClick={() => setMode('url')}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Typography variant="h3">Import from URL</Typography>
              <Typography variant="body">
                Paste a recipe URL from any website. AI will scrape and extract the recipe details.
              </Typography>
            </button>

            <button
              onClick={() => setMode('manual')}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '24px',
                backgroundColor: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Typography variant="h3">Enter Manually</Typography>
              <Typography variant="body">
                Type in the recipe details yourself.
              </Typography>
            </button>
        </Stack>
      </Stack>
    </Main>
  );
}  if (mode === 'image') {
    return (
      <Main maxWidth="md">
        <Stack direction="column" gap="xl">
          <Typography variant="h1">Upload recipe photo</Typography>

          {!imagePreview ? (
            <Box border="default" borderRadius="3" p="xl" bg="surface">
              <Stack direction="column" gap="md" alignItems="center">
                <Typography variant="h3">Choose an image</Typography>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                />
              </Stack>
            </Box>
          ) : (
            <Stack direction="column" gap="md">
              <Box border="default" borderRadius="3" p="md" bg="surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imagePreview} 
                  alt="Recipe preview" 
                  style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }}
                />
              </Box>
              
              <Stack direction="row" gap="md">
                <Button 
                  variant="primary" 
                  onClick={handleExtractFromImage}
                  disabled={extracting}
                >
                  {extracting ? 'Extracting...' : 'Extract Recipe with AI'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setImagePreview('')}
                >
                  Choose different image
                </Button>
              </Stack>

              {title && (
                <RecipeForm 
                  title={title}
                  setTitle={setTitle}
                  source={source}
                  setSource={setSource}
                  timeMins={timeMins}
                  setTimeMins={setTimeMins}
                  serves={serves}
                  setServes={setServes}
                  sourceUrl={sourceUrl}
                  setSourceUrl={setSourceUrl}
                  ingredients={ingredients}
                  instructions={instructions}
                  ingredientName={ingredientName}
                  setIngredientName={setIngredientName}
                  ingredientQty={ingredientQty}
                  setIngredientQty={setIngredientQty}
                  ingredientUnit={ingredientUnit}
                  setIngredientUnit={setIngredientUnit}
                  instructionInput={instructionInput}
                  setInstructionInput={setInstructionInput}
                  onAddIngredient={handleAddIngredient}
                  onRemoveIngredient={handleRemoveIngredient}
                  onAddInstruction={handleAddInstruction}
                  onRemoveInstruction={handleRemoveInstruction}
                  onSave={handleSaveRecipe}
                  onBack={() => setMode('choice')}
                  saving={saving}
                />
              )}
            </Stack>
          )}
        </Stack>
      </Main>
    );
  }

  if (mode === 'url') {
    return (
      <Main maxWidth="md">
        <Stack direction="column" gap="xl">
          <Typography variant="h1">Import from URL</Typography>

          <Box border="default" borderRadius="3" p="lg" bg="surface">
            <Stack direction="column" gap="md">
              <TextField
                label="Recipe URL"
                type="url"
                placeholder="https://example.com/recipe"
                value={recipeUrl}
                onChange={(e) => setRecipeUrl(e.target.value)}
              />

              <Button 
                variant="primary" 
                onClick={handleExtractFromUrl}
                disabled={extracting || !recipeUrl}
              >
                {extracting ? 'Extracting...' : 'Extract Recipe from URL'}
              </Button>
            </Stack>
          </Box>

          {title && (
            <RecipeForm 
              title={title}
              setTitle={setTitle}
              source={source}
              setSource={setSource}
              timeMins={timeMins}
              setTimeMins={setTimeMins}
              serves={serves}
              setServes={setServes}
              sourceUrl={sourceUrl}
              setSourceUrl={setSourceUrl}
              ingredients={ingredients}
              instructions={instructions}
              ingredientName={ingredientName}
              setIngredientName={setIngredientName}
              ingredientQty={ingredientQty}
              setIngredientQty={setIngredientQty}
              ingredientUnit={ingredientUnit}
              setIngredientUnit={setIngredientUnit}
              instructionInput={instructionInput}
              setInstructionInput={setInstructionInput}
              onAddIngredient={handleAddIngredient}
              onRemoveIngredient={handleRemoveIngredient}
              onAddInstruction={handleAddInstruction}
              onRemoveInstruction={handleRemoveInstruction}
              onSave={handleSaveRecipe}
              onBack={() => setMode('choice')}
              saving={saving}
            />
          )}
        </Stack>
      </Main>
    );
  }

  // Manual mode
  return (
    <Main maxWidth="md">
      <Stack direction="column" gap="xl">
        <Typography variant="h1">Add Recipe Manually</Typography>

        <RecipeForm 
          title={title}
          setTitle={setTitle}
          source={source}
          setSource={setSource}
          timeMins={timeMins}
          setTimeMins={setTimeMins}
          serves={serves}
          setServes={setServes}
          sourceUrl={sourceUrl}
          setSourceUrl={setSourceUrl}
          ingredients={ingredients}
          instructions={instructions}
          ingredientName={ingredientName}
          setIngredientName={setIngredientName}
          ingredientQty={ingredientQty}
          setIngredientQty={setIngredientQty}
          ingredientUnit={ingredientUnit}
          setIngredientUnit={setIngredientUnit}
          instructionInput={instructionInput}
          setInstructionInput={setInstructionInput}
          onAddIngredient={handleAddIngredient}
          onRemoveIngredient={handleRemoveIngredient}
          onAddInstruction={handleAddInstruction}
          onRemoveInstruction={handleRemoveInstruction}
          onSave={handleSaveRecipe}
          onBack={() => setMode('choice')}
          saving={saving}
        />
      </Stack>
    </Main>
  );
}

// Reusable form component
function RecipeForm({
  title,
  setTitle,
  source,
  setSource,
  timeMins,
  setTimeMins,
  serves,
  setServes,
  sourceUrl,
  setSourceUrl,
  ingredients,
  instructions,
  ingredientName,
  setIngredientName,
  ingredientQty,
  setIngredientQty,
  ingredientUnit,
  setIngredientUnit,
  instructionInput,
  setInstructionInput,
  onAddIngredient,
  onRemoveIngredient,
  onAddInstruction,
  onRemoveInstruction,
  onSave,
  onBack,
  saving,
}: {
  title: string;
  setTitle: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  timeMins: string;
  setTimeMins: (v: string) => void;
  serves: string;
  setServes: (v: string) => void;
  sourceUrl: string;
  setSourceUrl: (v: string) => void;
  ingredients: Ingredient[];
  instructions: string[];
  ingredientName: string;
  setIngredientName: (v: string) => void;
  ingredientQty: string;
  setIngredientQty: (v: string) => void;
  ingredientUnit: 'g'|'ml'|'tsp'|'tbsp'|'unit';
  setIngredientUnit: (v: 'g'|'ml'|'tsp'|'tbsp'|'unit') => void;
  instructionInput: string;
  setInstructionInput: (v: string) => void;
  onAddIngredient: () => void;
  onRemoveIngredient: (index: number) => void;
  onAddInstruction: () => void;
  onRemoveInstruction: (index: number) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <Stack direction="column" gap="lg">
      {/* Basic Info */}
      <Box border="subtle" borderRadius="4" p="lg" bg="default">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Recipe details</Typography>
          
          <TextField
            label="Recipe Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Spaghetti Bolognese"
          />

          <TextField
            label="Source / Attribution *"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g., Mum's Recipe, Jamie Oliver's 15-Minute Meals, RecipeTin Eats"
            helperText="Where did this recipe come from? This helps you identify it later."
          />

          <Stack direction="row" gap="md">
            <NumberInput
              label="Cooking Time (minutes)"
              value={timeMins ? parseInt(timeMins) : ''}
              onChange={(value) => setTimeMins(value.toString())}
              placeholder="30"
              style={{ flex: 1 }}
            />
            <NumberInput
              label="Servings"
              value={serves ? parseInt(serves) : ''}
              onChange={(value) => setServes(value.toString())}
              placeholder="4"
              style={{ flex: 1 }}
            />
          </Stack>

          <TextField
            label="Source URL (optional)"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://..."
          />
        </Stack>
      </Box>

      {/* Ingredients */}
      <Box border="subtle" borderRadius="4" p="lg" bg="default">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Ingredients</Typography>
          
          <Stack direction="row" gap="sm" alignItems="flex-end">
            <TextField
              label="Ingredient"
              value={ingredientName}
              onChange={(e) => setIngredientName(e.target.value)}
              placeholder="e.g., Tomatoes"
              style={{ flex: 2 }}
            />
            <NumberInput
              label="Qty"
              value={ingredientQty ? parseFloat(ingredientQty) : ''}
              onChange={(value) => setIngredientQty(value.toString())}
              placeholder="500"
            />
            <div style={{ width: '100px' }}>
              <Dropdown
                label="Unit"
                options={[
                  { id: 'g', label: 'g' },
                  { id: 'ml', label: 'ml' },
                  { id: 'tsp', label: 'tsp' },
                  { id: 'tbsp', label: 'tbsp' },
                  { id: 'unit', label: 'unit' },
                ]}
                value={ingredientUnit}
                onChange={(value) => setIngredientUnit(value as 'g'|'ml'|'tsp'|'tbsp'|'unit')}
              />
            </div>
            <Button variant="primary" size="large" iconName="add" onClick={onAddIngredient}>
              Add
            </Button>
          </Stack>

          {ingredients.length > 0 && (
            <List dividers spacing="comfortable">
              {ingredients.map((ing, index) => (
                <ListItem
                  key={index}
                  primary={`${ing.qty > 0 ? `${ing.qty} ` : ''}${ing.unit !== 'unit' ? `${ing.unit} ` : ''}${ing.name}`}
                  badge={
                    <IconButton
                      variant="naked"
                      iconName="trash"
                      size="small"
                      onClick={() => onRemoveIngredient(index)}
                      aria-label={`Remove ${ing.name}`}
                    />
                  }
                />
              ))}
            </List>
          )}
        </Stack>
      </Box>

      {/* Instructions */}
      <Box border="subtle" borderRadius="4" p="lg" bg="default">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Instructions</Typography>
          
          <Stack direction="column" gap="sm" alignItems="flex-start">
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                Cooking step
              </label>
              <textarea
                value={instructionInput}
                onChange={(e) => setInstructionInput(e.target.value)}
                placeholder="Enter a cooking step..."
                rows={3}
                style={{ 
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>
            <Button variant="primary" size="large" onClick={onAddInstruction}>
              Add step
            </Button>
          </Stack>

          {instructions.length > 0 && (
            <List dividers spacing="comfortable">
              {instructions.map((instruction, index) => (
                <ListItem
                  key={index}
                  icon={
                    <div style={{ 
                      minWidth: '24px', 
                      height: '24px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: tokens.semantic.color.background.emphasis,
                      font: tokens.semantic.typography.overline,
                      borderRadius: '999px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}>
                      {index + 1}
                    </div>
                  }
                  primary={instruction}
                  badge={
                    <IconButton
                      variant="naked"
                      iconName="trash"
                      size="small"
                      onClick={() => onRemoveInstruction(index)}
                      aria-label={`Remove step ${index + 1}`}
                    />
                  }
                />
              ))}
            </List>
          )}
        </Stack>
      </Box>

      {/* Save Button */}
      <ButtonGroup
        left={
          <Button variant="secondary" size="large" iconName="arrowLeft" onClick={onBack}>
            Back
          </Button>
        }
        right={
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save recipe'}
          </Button>
        }
      />
    </Stack>
  );
}
