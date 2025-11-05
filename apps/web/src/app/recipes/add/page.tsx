"use client";

import { useState } from "react";
import { Stack, Typography, Button, Box } from "@common-origin/design-system";
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
        throw new Error(data.error || 'Failed to extract recipe');
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

    setSaving(true);

    try {
      const recipe: Recipe = {
        id: `custom-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        source: {
          url: sourceUrl || '',
          domain: 'user-added',
          chef: 'recipe_tin_eats',
          license: 'unknown',
          fetchedAt: new Date().toISOString(),
        },
        timeMins: parseInt(timeMins) || undefined,
        serves: parseInt(serves) || 4,
        tags: [],
        ingredients,
        instructions: instructions.length > 0 ? instructions : undefined,
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

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ddd',
    fontSize: '14px',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: 500,
  };

  if (mode === 'choice') {
    return (
      <main style={{ padding: 24, maxWidth: '600px', margin: '0 auto' }}>
        <Stack direction="column" gap="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Add Recipe</Typography>
            <Link href="/plan" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="small">Cancel</Button>
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
      </main>
    );
  }

  if (mode === 'image') {
    return (
      <main style={{ padding: 24, maxWidth: '800px', margin: '0 auto' }}>
        <Stack direction="column" gap="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Upload Recipe Photo</Typography>
            <Button variant="secondary" size="small" onClick={() => setMode('choice')}>
              Back
            </Button>
          </Stack>

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
                  {extracting ? 'Extracting...' : '🤖 Extract Recipe with AI'}
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => setImagePreview('')}
                >
                  Choose Different Image
                </Button>
              </Stack>

              {title && (
                <RecipeForm 
                  title={title}
                  setTitle={setTitle}
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
                  saving={saving}
                  inputStyle={inputStyle}
                  labelStyle={labelStyle}
                />
              )}
            </Stack>
          )}
        </Stack>
      </main>
    );
  }

  if (mode === 'url') {
    return (
      <main style={{ padding: 24, maxWidth: '800px', margin: '0 auto' }}>
        <Stack direction="column" gap="xl">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Import from URL</Typography>
            <Button variant="secondary" size="small" onClick={() => setMode('choice')}>
              Back
            </Button>
          </Stack>

          <Box border="default" borderRadius="3" p="lg" bg="surface">
            <Stack direction="column" gap="md">
              <div>
                <label style={labelStyle}>Recipe URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/recipe"
                  value={recipeUrl}
                  onChange={(e) => setRecipeUrl(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <Button 
                variant="primary" 
                onClick={handleExtractFromUrl}
                disabled={extracting || !recipeUrl}
              >
                {extracting ? 'Extracting...' : '🤖 Extract Recipe from URL'}
              </Button>
            </Stack>
          </Box>

          {title && (
            <RecipeForm 
              title={title}
              setTitle={setTitle}
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
              saving={saving}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
          )}
        </Stack>
      </main>
    );
  }

  // Manual mode
  return (
    <main style={{ padding: 24, maxWidth: '800px', margin: '0 auto' }}>
      <Stack direction="column" gap="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h1">Add Recipe Manually</Typography>
          <Button variant="secondary" size="small" onClick={() => setMode('choice')}>
            Back
          </Button>
        </Stack>

        <RecipeForm 
          title={title}
          setTitle={setTitle}
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
          saving={saving}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
        />
      </Stack>
    </main>
  );
}

// Reusable form component
function RecipeForm({
  title,
  setTitle,
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
  saving,
  inputStyle,
  labelStyle,
}: {
  title: string;
  setTitle: (v: string) => void;
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
  saving: boolean;
  inputStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  return (
    <Stack direction="column" gap="lg">
      {/* Basic Info */}
      <Box border="default" borderRadius="3" p="lg" bg="surface">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Recipe Details</Typography>
          
          <div>
            <label style={labelStyle}>Recipe Title</label>
            <input
              style={inputStyle}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Spaghetti Bolognese"
            />
          </div>

          <Stack direction="row" gap="md">
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Cooking Time (minutes)</label>
              <input
                style={inputStyle}
                type="number"
                value={timeMins}
                onChange={(e) => setTimeMins(e.target.value)}
                placeholder="30"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Servings</label>
              <input
                style={inputStyle}
                type="number"
                value={serves}
                onChange={(e) => setServes(e.target.value)}
                placeholder="4"
              />
            </div>
          </Stack>

          <div>
            <label style={labelStyle}>Source URL (optional)</label>
            <input
              style={inputStyle}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </Stack>
      </Box>

      {/* Ingredients */}
      <Box border="default" borderRadius="3" p="lg" bg="surface">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Ingredients</Typography>
          
          <Stack direction="row" gap="sm" alignItems="flex-end">
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Ingredient</label>
              <input
                style={inputStyle}
                value={ingredientName}
                onChange={(e) => setIngredientName(e.target.value)}
                placeholder="e.g., Tomatoes"
              />
            </div>
            <div style={{ width: '100px' }}>
              <label style={labelStyle}>Qty</label>
              <input
                style={inputStyle}
                type="number"
                value={ingredientQty}
                onChange={(e) => setIngredientQty(e.target.value)}
                placeholder="500"
              />
            </div>
            <div style={{ width: '80px' }}>
              <label style={labelStyle}>Unit</label>
              <select
                value={ingredientUnit}
                onChange={(e) => setIngredientUnit(e.target.value as 'g'|'ml'|'tsp'|'tbsp'|'unit')}
                style={inputStyle}
              >
                <option value="g">g</option>
                <option value="ml">ml</option>
                <option value="tsp">tsp</option>
                <option value="tbsp">tbsp</option>
                <option value="unit">unit</option>
              </select>
            </div>
            <Button variant="primary" size="small" onClick={onAddIngredient}>
              Add
            </Button>
          </Stack>

          {ingredients.length > 0 && (
            <Stack direction="column" gap="sm">
              {ingredients.map((ing, index) => (
                <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body">
                    {ing.qty > 0 && `${ing.qty} `}
                    {ing.unit !== 'unit' && `${ing.unit} `}
                    {ing.name}
                  </Typography>
                  <Button variant="secondary" size="small" onClick={() => onRemoveIngredient(index)}>
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Instructions */}
      <Box border="default" borderRadius="3" p="lg" bg="surface">
        <Stack direction="column" gap="md">
          <Typography variant="h3">Instructions</Typography>
          
          <Stack direction="column" gap="sm">
            <textarea
              value={instructionInput}
              onChange={(e) => setInstructionInput(e.target.value)}
              placeholder="Enter a cooking step..."
              rows={3}
              style={{ 
                ...inputStyle,
                resize: 'vertical',
              }}
            />
            <Button variant="primary" size="small" onClick={onAddInstruction}>
              Add Step
            </Button>
          </Stack>

          {instructions.length > 0 && (
            <Stack direction="column" gap="sm">
              {instructions.map((instruction, index) => (
                <Stack key={index} direction="row" gap="md" alignItems="flex-start">
                  <div style={{ 
                    minWidth: '24px', 
                    height: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    backgroundColor: '#007bff',
                    borderRadius: '999px',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}>
                    {index + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <Typography variant="body">{instruction}</Typography>
                  </div>
                  <Button variant="secondary" size="small" onClick={() => onRemoveInstruction(index)}>
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Save Button */}
      <Stack direction="row" gap="md" justifyContent="flex-end">
        <Button variant="primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Recipe'}
        </Button>
      </Stack>
    </Stack>
  );
}
