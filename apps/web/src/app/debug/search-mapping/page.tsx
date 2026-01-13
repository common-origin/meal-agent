"use client";

import { useState } from "react";
import { Box, Button, Container, Dropdown, Icon, Stack, TextField, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { generateSearchTerm, generateSearchTermVariations, explainTransformation, calculateMatchScore } from "@/lib/ingredientSearchMapping";

export default function SearchMappingTestPage() {
  const [ingredient, setIngredient] = useState("fresh chicken breast fillets");
  const [category, setCategory] = useState<string>("protein");
  const [result, setResult] = useState<{
    enhanced: string;
    variations: string[];
    explanation: string | null;
  } | null>(null);
  
  const [testProduct, setTestProduct] = useState("Coles RSPCA Approved Chicken Breast Fillet");
  const [testBrand, setTestBrand] = useState("Coles");
  const [matchScore, setMatchScore] = useState<number | null>(null);

  const categories = [
    { id: 'protein', label: 'Protein' },
    { id: 'seafood', label: 'Seafood' },
    { id: 'vegetables', label: 'Vegetables' },
    { id: 'dairy', label: 'Dairy' },
    { id: 'pantry', label: 'Pantry' },
    { id: 'herbs', label: 'Herbs' },
    { id: 'spices', label: 'Spices' },
    { id: 'fruit', label: 'Fruit' },
    { id: 'bakery', label: 'Bakery' },
  ];

  const handleGenerate = () => {
    const enhanced = generateSearchTerm(ingredient, category);
    const variations = generateSearchTermVariations(ingredient, category);
    const explanation = explainTransformation(ingredient, enhanced);
    
    setResult({
      enhanced,
      variations,
      explanation
    });
  };

  const handleCalculateScore = () => {
    const score = calculateMatchScore(ingredient, testProduct, testBrand);
    setMatchScore(score);
  };

  const exampleIngredients = [
    "fresh chicken breast fillets",
    "chopped brown onion",
    "extra virgin olive oil",
    "crushed garlic cloves",
    "fresh coriander leaves",
    "diced roma tomatoes",
    "greek yoghurt",
    "ground black pepper",
    "chicken stock cubes",
    "grated parmesan cheese"
  ];

  return (
    <Main>
      <Container>
        <Box p="xl">
          <Stack direction="column" gap="xl">
            {/* Header */}
            <Stack direction="column" gap="xs">
              <Typography variant="h1">Search Term Mapping Test</Typography>
              <Typography variant="body" color="subdued">
                Test the enhanced ingredient search term generation
              </Typography>
            </Stack>

            {/* Search Term Generator */}
            <Box border="subtle" borderRadius="lg" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Generate Search Term</Typography>
                
                <TextField
                  label="Ingredient Name"
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="Enter ingredient name..."
                />
                
                <Dropdown
                  label="Category (optional)"
                  options={categories}
                  value={category}
                  onChange={(value) => setCategory(value)}
                />
                
                <Button variant="primary" onClick={handleGenerate}>
                  Generate Search Term
                </Button>
                
                {result && (
                  <Box bg="emphasis" borderRadius="sm" p="md" mt="sm">
                    <Stack direction="column" gap="sm">
                      <Stack direction="row" gap="sm" alignItems="center">
                        <Icon name="search" size="sm" />
                        <Typography variant="subtitle">Enhanced: &quot;{result.enhanced}&quot;</Typography>
                      </Stack>
                      
                      {result.explanation && (
                        <Typography variant="small" color="subdued">
                          {result.explanation}
                        </Typography>
                      )}
                      
                      <Stack direction="column" gap="xs">
                        <Typography variant="small" color="subdued">Search Variations:</Typography>
                        <Stack direction="column" gap="xs">
                          {result.variations.map((variation, index) => (
                            <Typography key={index} variant="small">
                              {index + 1}. &quot;{variation}&quot;
                            </Typography>
                          ))}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Match Score Calculator */}
            <Box border="subtle" borderRadius="lg" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Calculate Match Score</Typography>
                
                <TextField
                  label="Ingredient Name"
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  placeholder="e.g., chicken breast"
                />
                
                <TextField
                  label="Product Name"
                  value={testProduct}
                  onChange={(e) => setTestProduct(e.target.value)}
                  placeholder="e.g., Coles RSPCA Approved Chicken Breast"
                />
                
                <TextField
                  label="Product Brand"
                  value={testBrand}
                  onChange={(e) => setTestBrand(e.target.value)}
                  placeholder="e.g., Coles"
                />
                
                <Button variant="primary" onClick={handleCalculateScore}>
                  Calculate Match Score
                </Button>
                
                {matchScore !== null && (
                  <Box bg="emphasis" borderRadius="sm" p="md" mt="sm">
                    <Stack direction="column" gap="xs">
                      <Typography variant="h2">{matchScore.toFixed(0)}%</Typography>
                      <Typography variant="small" color="subdued">
                        {matchScore >= 80 && 'Excellent match'}
                        {matchScore >= 60 && matchScore < 80 && 'Good match'}
                        {matchScore >= 40 && matchScore < 60 && 'Fair match'}
                        {matchScore < 40 && 'Poor match'}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>

            {/* Example Ingredients */}
            <Box border="subtle" borderRadius="lg" p="lg" bg="surface">
              <Stack direction="column" gap="md">
                <Typography variant="h3">Example Transformations</Typography>
                <Typography variant="small" color="subdued">
                  Click an example to test it
                </Typography>
                
                <Stack direction="column" gap="xs">
                  {exampleIngredients.map((example, index) => {
                    const enhanced = generateSearchTerm(example, 'protein');
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          setIngredient(example);
                          const result = {
                            enhanced: generateSearchTerm(example, category),
                            variations: generateSearchTermVariations(example, category),
                            explanation: explainTransformation(example, enhanced)
                          };
                          setResult(result);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: 'none',
                          borderRadius: '4px',
                          backgroundColor: '#f5f5f5',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="small">&quot;{example}&quot;</Typography>
                          <Typography variant="small" color="subdued">→ &quot;{enhanced}&quot;</Typography>
                        </Stack>
                      </button>
                    );
                  })}
                </Stack>
              </Stack>
            </Box>

            {/* Tips */}
            <Box border="subtle" borderRadius="lg" p="lg" bg="surface">
              <Stack direction="column" gap="sm">
                <Typography variant="h3">How It Works</Typography>
                
                <Stack direction="column" gap="xs">
                  <Typography variant="small">
                    • <strong>Synonym Mapping:</strong> Converts recipe terms to common product names
                  </Typography>
                  <Typography variant="small">
                    • <strong>Descriptor Removal:</strong> Removes prep methods and quality descriptors
                  </Typography>
                  <Typography variant="small">
                    • <strong>Brand Filtering:</strong> Removes brand names for generic results
                  </Typography>
                  <Typography variant="small">
                    • <strong>Compound Simplification:</strong> Simplifies multi-ingredient items
                  </Typography>
                  <Typography variant="small">
                    • <strong>Category Keywords:</strong> Adds relevant category terms for specificity
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Main>
  );
}
