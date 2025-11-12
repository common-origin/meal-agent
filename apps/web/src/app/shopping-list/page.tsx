"use client";

import { useEffect, useState } from "react";
import styled from "styled-components";
import { Box, Button, Chip, Container, List, ListItem, ResponsiveGrid, Stack, Typography } from "@common-origin/design-system";
import { tokens } from "@common-origin/design-system";
import ColesShoppingModal from "@/components/app/ColesShoppingModal";
import ReportPriceModal from "@/components/app/ReportPriceModal";
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
  const [loading, setLoading] = useState(true);
  const [showColesModal, setShowColesModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [reportPriceItem, setReportPriceItem] = useState<AggregatedIngredient | null>(null);

  const generateShoppingList = () => {
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
      userPantryItems: household.pantry
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
    
    // Generate shopping list on mount
    const loadShoppingList = async () => {
      generateShoppingList();
    };
    loadShoppingList();
  }, []);

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

  // Separate items: what user needs to buy vs. what they already have
  const needToBuy = aggregatedItems.filter(item => !item.isPantryStaple);
  const alreadyHave = aggregatedItems.filter(item => item.isPantryStaple);
  
  // Group by category
  const groupedNeedToBuy = needToBuy.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, AggregatedIngredient[]>);

  const categories = Object.keys(groupedNeedToBuy).sort();
  const totalItems = needToBuy.length;

  return (
    <main style={{ padding: 24 }}>
      <PageLayout>
          <Container>
            <Stack direction="column" gap="lg">
              {/* Header */}
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h1">Shopping list</Typography>
                <Stack direction="row" gap="md">
                  <Button variant="secondary" size="large" onClick={handleExportCSV}>
                    Export CSV
                  </Button>
                  <Button variant="primary" size="large" onClick={handleShopAtColes}>
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
                  <Typography variant="subtitle" color="subdued">Items to buy</Typography>
                  <Typography variant="h2">{totalItems}</Typography>
                </Box>
                <Box bg="surface" borderRadius="3" p="md">
                  <Typography variant="subtitle" color="subdued">Already have</Typography>
                  <Typography variant="h2">{alreadyHave.length}</Typography>
                </Box>
                <Box bg="surface" borderRadius="3" p="md">
                  <Typography variant="subtitle" color="subdued">Categories</Typography>
                  <Typography variant="h2">{categories.length}</Typography>
                </Box>
                <Box bg="surface" borderRadius="3" p="md">
                  <Typography variant="subtitle" color="subdued">Estimated total</Typography>
                  <Typography variant="h2">
                    ${needToBuy.reduce((sum, item) => {
                      const priceInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
                      return sum + priceInfo.estimatedCost;
                    }, 0).toFixed(2)}
                  </Typography>
                </Box>
              </ResponsiveGrid>

              {/* Price confidence legend */}
              <Box bg="subtle" borderRadius="3" p="sm">
                <Stack direction="row" gap="lg" alignItems="center">
                  <Typography variant="small" color="subdued">
                    Price indicators:
                  </Typography>
                  <Typography variant="small">
                    ✓ = Verified price
                  </Typography>
                  <Typography variant="small">
                    ~ = Estimated price
                  </Typography>
                </Stack>
              </Box>

              {/* Items to Buy - Grouped by Category */}
              {categories.map((category) => {
                const items = groupedNeedToBuy[category];
                
                return (
                  <Box 
                    key={category}
                    border="default"
                    borderRadius="4"
                    p="md"
                    bg="subtle"
                  >
                    <Stack direction="column" gap="md">
                      <Stack direction="row"  alignItems="center">
                        <Typography variant="h3">{category}</Typography>
                        <Chip variant="dark">{items.length} items</Chip>
                      </Stack>
                      
                      <List dividers spacing="comfortable">
                        {items.map((item, index) => {
                          const hasMultipleRecipes = item.sourceRecipes.length > 1;
                          const itemKey = `${category}-${index}`;
                          const isExpanded = expandedItems.has(itemKey);
                          
                          // Get price estimate with confidence
                          const priceInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
                          const priceDisplay = priceInfo.estimatedCost > 0 
                            ? `$${priceInfo.estimatedCost.toFixed(2)}` 
                            : '';
                          const confidenceIcon = priceInfo.confidence === 'high' ? '✓' : '~';
                          
                          const handleToggle = () => {
                            setExpandedItems(prev => {
                              const next = new Set(prev);
                              if (next.has(itemKey)) {
                                next.delete(itemKey);
                              } else {
                                next.add(itemKey);
                              }
                              return next;
                            });
                          };
                          
                          return (
                            <ListItem
                              key={index}
                              primary={
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                  <Typography variant="body">{item.name}</Typography>
                                  <Button
                                    variant="naked"
                                    size="small"
                                    onClick={() => setReportPriceItem(item)}
                                  >
                                    Report price
                                  </Button>
                                </Stack>
                              }
                              secondary={
                                <Stack direction="row" gap="sm" alignItems="center">
                                  {hasMultipleRecipes && (
                                    <Typography variant="small" color="subdued">
                                      {item.sourceRecipes.length} recipes
                                    </Typography>
                                  )}
                                  {priceDisplay && (
                                    <Typography variant="small" color={priceInfo.confidence === 'high' ? 'default' : 'subdued'}>
                                      {confidenceIcon} {priceDisplay}
                                    </Typography>
                                  )}
                                </Stack>
                              }
                              badge={
                                <Chip variant="light" size="small">
                                  {item.totalQty.toFixed(1)} {item.unit}
                                </Chip>
                              }
                              expandable={hasMultipleRecipes}
                              expanded={isExpanded}
                              onToggle={handleToggle}
                            >
                              {hasMultipleRecipes && (
                                <Stack direction="column" gap="xs">
                                  <Typography variant="small" color="subdued">
                                    Used in:
                                  </Typography>
                                  {item.sourceRecipes.map((recipe, idx) => (
                                    <Typography key={idx} variant="small">
                                      • {recipe.recipeTitle}: {recipe.qty.toFixed(1)} {item.unit}
                                    </Typography>
                                  ))}
                                </Stack>
                              )}
                            </ListItem>
                          );
                        })}
                      </List>
                    </Stack>
                  </Box>
                );
              })}

              {/* Already Have Section */}
              {alreadyHave.length > 0 && (
                <Box 
                  border="default"
                  borderRadius="4"
                  p="md"
                  bg="subtle"
                >
                  <Stack direction="column" gap="md">
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h3">Already in your pantry</Typography>
                      <Chip variant="light">{alreadyHave.length} items</Chip>
                    </Stack>
                    
                    <Typography variant="small" color="subdued">
                      These ingredients were in your pantry inventory, so they&apos;re excluded from your shopping list.
                    </Typography>
                    
                    <List dividers spacing="compact">
                      {alreadyHave.map((item, index) => (
                        <ListItem
                          key={index}
                          primary={item.name}
                          badge={
                            <Chip variant="light" size="small">
                              {item.totalQty.toFixed(1)} {item.unit}
                            </Chip>
                          }
                        />
                      ))}
                    </List>
                  </Stack>
                </Box>
              )}
          </Stack>
        </Container>
      </PageLayout>
      
      {/* Coles Shopping Modal */}
      <ColesShoppingModal
        isOpen={showColesModal}
        onClose={() => setShowColesModal(false)}
        items={needToBuy}
      />

      {/* Report Price Modal */}
      {reportPriceItem && (
        <ReportPriceModal
          isOpen={!!reportPriceItem}
          onClose={() => setReportPriceItem(null)}
          ingredientName={reportPriceItem.name}
          normalizedName={reportPriceItem.normalizedName}
          suggestedQuantity={reportPriceItem.totalQty}
          suggestedUnit={reportPriceItem.unit}
        />
      )}
    </main>
  );
}
