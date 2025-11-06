"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { Box, Button, Chip, Container, ResponsiveGrid, Stack, Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import ShoppingListItem from "@/components/app/ShoppingListItem";
import ColesShoppingModal from "@/components/app/ColesShoppingModal";
import { aggregateShoppingList, toLegacyFormat, type AggregatedIngredient } from "@/lib/shoppingListAggregator";
import { generateShoppingListCSV, downloadCSV } from "@/lib/csv";
import { loadHousehold, getDefaultHousehold, loadWeeklyOverrides, loadCurrentWeekPlan } from "@/lib/storage";
import { composeWeek } from "@/lib/compose";
import { nextWeekMondayISO } from "@/lib/schedule";
import { track, type CostOptimizedMeta } from "@/lib/analytics";
import { estimateIngredientCost } from "@/lib/colesMapping";
import { RecipeLibrary } from "@/lib/library";

const PageLayout = styled.div`
 max-width: ${tokens.base.breakpoint.md};
 margin: 0 auto;
`

export default function ShoppingListPage() {
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedIngredient[]>([]);
  const [excludePantry, setExcludePantry] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showColesModal, setShowColesModal] = useState(false);

  const generateShoppingList = (excludePantryParam: boolean = false) => {
    setLoading(true);
    
    // Get current plan
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    
    // Check if user has a saved week plan (from AI generation or manual selection)
    const savedPlan = loadCurrentWeekPlan(nextWeekISO);
    
    let plan;
    if (savedPlan) {
      // Use the saved plan - build PlanWeek from saved recipe IDs
      console.log('📋 Using saved week plan:', savedPlan.recipeIds);
      
      // Calculate dates for the week (Monday through Sunday)
      const startDate = new Date(nextWeekISO);
      
      const days = savedPlan.recipeIds.map((recipeId, index) => {
        if (!recipeId) return null;
        
        const recipe = RecipeLibrary.getById(recipeId);
        if (!recipe) {
          console.warn(`Recipe ${recipeId} not found in library`);
          return null;
        }
        
        // Calculate date for this day
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + index);
        
        return {
          dateISO: dayDate.toISOString().split('T')[0],
          recipeId: recipe.id,
          scaledServings: recipe.serves || 4,
        };
      }).filter((day): day is { dateISO: string; recipeId: string; scaledServings: number } => day !== null);
      
      // Calculate cost estimate
      const costEstimate = days.reduce((sum, day) => {
        const recipe = RecipeLibrary.getById(day.recipeId);
        return sum + ((recipe?.costPerServeEst || 0) * day.scaledServings);
      }, 0);
      
      plan = {
        startISO: nextWeekISO,
        days,
        costEstimate,
        conflicts: [],
      };
      
      console.log('✅ Built plan from saved recipe IDs:', days.length, 'meals');
    } else {
      // Fall back to auto-composition from library
      console.log('🔄 No saved plan found, composing from library...');
      const overrides = loadWeeklyOverrides(nextWeekISO);
      plan = composeWeek(household, overrides || undefined);
    }
    
    // Aggregate ingredients
    const items = aggregateShoppingList(plan, {
      excludePantryStaples: excludePantryParam,
      pantryItems: household.pantry
    });
    
    setAggregatedItems(items);
    setLoading(false);
    
    // Track cost optimization from ingredient reuse
    const reusedItems = items.filter(item => item.sourceRecipes.length >= 2);
    if (reusedItems.length > 0) {
      // Estimate savings from reuse (rough calculation)
      const potentialWaste = reusedItems.reduce((sum, item) => {
        const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
        // If we bought separately, might waste ~30% per pack
        return sum + (colesInfo.mapped ? colesInfo.estimatedCost * 0.3 * (item.sourceRecipes.length - 1) : 0);
      }, 0);
      
      const totalCost = items.reduce((sum, item) => {
        const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
        return sum + (colesInfo.mapped ? colesInfo.estimatedCost : 0);
      }, 0);
      
      if (potentialWaste > 0) {
        const costMeta: CostOptimizedMeta = {
          originalCost: totalCost + potentialWaste,
          optimizedCost: totalCost,
          savingsPercent: (potentialWaste / (totalCost + potentialWaste)) * 100,
          method: 'ingredient_reuse'
        };
        track('cost_optimized', costMeta);
      }
    }
  };

  useEffect(() => {
    track('page_view', { page: '/shopping-list' });
    generateShoppingList(excludePantry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTogglePantry = () => {
    const newValue = !excludePantry;
    setExcludePantry(newValue);
    generateShoppingList(newValue);
  };

  const handleExportCSV = () => {
    track('export_csv', { itemCount: aggregatedItems.length });
    
    // Convert to legacy format for CSV
    const legacyFormat = toLegacyFormat(aggregatedItems);
    const csvContent = generateShoppingListCSV(legacyFormat);
    downloadCSV(csvContent, "coles-shopping-list.csv");
  };

  const handleShopAtColes = () => {
    setShowColesModal(true);
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        <Typography variant="h1">Generating shopping list...</Typography>
      </main>
    );
  }

  // Group by category
  const grouped = aggregatedItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, AggregatedIngredient[]>);

  const categories = Object.keys(grouped).sort();
  const totalItems = aggregatedItems.length;
  const pantryItems = aggregatedItems.filter(i => i.isPantryStaple).length;
  
  // Calculate Coles estimates
  const mappedItems = aggregatedItems.filter(item => {
    const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
    return colesInfo.mapped;
  });
  const totalEstimatedCost = aggregatedItems.reduce((sum, item) => {
    const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
    return sum + (colesInfo.mapped ? colesInfo.estimatedCost : 0);
  }, 0);
  const mappingCoverage = totalItems > 0 ? Math.round((mappedItems.length / totalItems) * 100) : 0;

  return (
    <main style={{ padding: 24 }}>
      <PageLayout>
      <Container>
        <Stack direction="column" gap="lg">
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h1">Shopping List</Typography>
            <Stack direction="row" gap="md">
              <Button 
                variant="secondary" 
                size="medium"
                onClick={handleTogglePantry}
              >
                {excludePantry ? "Show Pantry Items" : "Hide Pantry Items"}
              </Button>
              <Button variant="secondary" size="medium" onClick={handleExportCSV}>
                Export CSV
              </Button>
              <Button variant="primary" size="medium" onClick={handleShopAtColes}>
                Shop at Coles
              </Button>
            </Stack>
          </Stack>
        
          <Typography variant="body">
            Aggregated from your meal plan with de-duplicated ingredients.
          </Typography>

        {/* Summary Stats */}
        <ResponsiveGrid 
          cols={1} 
          colsSm={2} 
          colsMd={4} 
          gap={2}
        >
          <Box bg="surface" borderRadius="3" p="md">
            <Typography variant="subtitle" color="subdued">Total Items</Typography>
            <Typography variant="h2">{totalItems}</Typography>
          </Box>
          <Box bg="surface" borderRadius="3" p="md">
            <Typography variant="subtitle" color="subdued">Pantry Staples</Typography>
            <Typography variant="h2">{pantryItems}</Typography>
          </Box>
          <Box bg="surface" borderRadius="3" p="md">
            <Typography variant="subtitle" color="subdued">Categories</Typography>
            <Typography variant="h2">{categories.length}</Typography>
          </Box>
          <Box bg="surface" borderRadius="3" p="md">
            <Typography variant="subtitle" color="subdued">Est. Coles Cost</Typography>
            <Typography variant="h2">${totalEstimatedCost.toFixed(2)}</Typography>
            <Typography variant="small">{mappingCoverage}% mapped</Typography>
          </Box>
        </ResponsiveGrid>

        {/* Items by Category */}
        {categories.map((category) => {
          const items = grouped[category];
          
          return (
            <Box 
              key={category}
              border="default"
              borderRadius="4"
              p="md"
              bg="subtle"
            >
              <Stack direction="column" gap="md">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h3">{category}</Typography>
                  <Chip variant="dark">{items.length} items</Chip>
                </Stack>
                
                <Stack direction="column" gap="xs">
                  {items.map((item, index) => (
                    <ShoppingListItem 
                      key={index} 
                      item={item}
                      showPantryBadge={!excludePantry}
                    />
                  ))}
                </Stack>
              </Stack>
            </Box>
          );
        })}
        
        <Typography variant="small">
          💡 Click items with multiple recipes to see breakdown • 
          ✓ Green badges show Coles mapped items with estimated prices • 
          Ready for Coles pickup or delivery
        </Typography>
      </Stack>
      </Container>
      </PageLayout>
      
      {/* Coles Shopping Modal */}
      <ColesShoppingModal
        isOpen={showColesModal}
        onClose={() => setShowColesModal(false)}
        items={aggregatedItems}
      />
    </main>
  );
}
