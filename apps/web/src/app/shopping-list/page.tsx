"use client";

import { useEffect, useState } from "react";
import { Box, Button, Chip, Container, Icon, IconButton, List, ListItem, ResponsiveGrid, Stack, Typography } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import ColesShoppingModal from "@/components/app/ColesShoppingModal";
import { aggregateShoppingList, toLegacyFormat, type AggregatedIngredient } from "@/lib/shoppingListAggregator";
import { generateShoppingListCSV, downloadCSV } from "@/lib/csv";
import { loadHousehold, getDefaultHousehold, loadWeeklyOverrides } from "@/lib/storage";
import { loadCurrentWeekPlan } from "@/lib/storageAsync";
import { composeWeek } from "@/lib/compose";
import { nextWeekMondayISO } from "@/lib/schedule";
import { track, type CostOptimizedMeta } from "@/lib/analytics";
import { estimateIngredientCost } from "@/lib/colesMapping";
import { RecipeLibrary } from "@/lib/library";
import PriceSourceBadge from "@/components/app/PriceSourceBadge";
import ApiQuotaWarning from "@/components/app/ApiQuotaWarning";
import { addToPantryPreferences, removeFromPantryPreferences } from "@/lib/pantryPreferences";

export default function ShoppingListPage() {
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColesModal, setShowColesModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [apiPrices, setApiPrices] = useState<Map<string, { cost: number; source: 'api' | 'static' | 'category'; livePrice?: boolean }>>(new Map());

  const loadApiPrices = async (items: AggregatedIngredient[]) => {
    const { estimateIngredientCostWithAPI } = await import('@/lib/colesMapping');
    const priceMap = new Map<string, { cost: number; source: 'api' | 'static' | 'category'; livePrice?: boolean }>();
    
    // Load prices for each item (cached results will be instant)
    for (const item of items) {
      try {
        const result = await estimateIngredientCostWithAPI(item.normalizedName, item.totalQty, item.unit);
        priceMap.set(item.normalizedName, {
          cost: result.estimatedCost,
          source: result.priceSource,
          livePrice: result.livePrice
        });
      } catch (error) {
        console.warn(`Failed to get API price for ${item.name}:`, error);
      }
    }
    
    setApiPrices(priceMap);
  };

  const generateShoppingList = async () => {
    setLoading(true);
    
    // Get current plan
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    
    // Check if user has a saved week plan (from AI generation or manual selection)
    const savedPlan = await loadCurrentWeekPlan(nextWeekISO);
    
    let plan;
    let weeklyPantryItems: Array<{ name: string; qty: number; unit: string }> = [];
    
    if (savedPlan) {
      // Use the saved plan - build PlanWeek from saved recipe IDs
      console.log('📋 Using saved week plan:', savedPlan.recipeIds);
      
      // Use week-specific pantry items if available (convert from string[] to required format)
      weeklyPantryItems = (savedPlan.pantryItems || []).map(item => ({
        name: item,
        qty: 1,
        unit: 'item'
      }));
      console.log('🥫 Using week-specific pantry items:', weeklyPantryItems.length, 'items');
      
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
      // Fall back to general household pantry if no saved plan (already in correct format)
      weeklyPantryItems = household.pantry;
    }
    
    // Aggregate ingredients using week-specific pantry items
    const items = aggregateShoppingList(plan, {
      userPantryItems: weeklyPantryItems
    });
    
    setAggregatedItems(items);
    setLoading(false);
    
    // Load API prices asynchronously (non-blocking)
    loadApiPrices(items);
    
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
      await generateShoppingList();
    };
    loadShoppingList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleMarkAsPantry = (item: AggregatedIngredient) => {
    // Add to pantry preferences
    addToPantryPreferences(item.normalizedName);
    
    // Regenerate shopping list to reflect change
    generateShoppingList();
  };

  const handleUnmarkAsPantry = (item: AggregatedIngredient) => {
    // Remove from pantry preferences
    removeFromPantryPreferences(item.normalizedName);
    
    // Regenerate shopping list to reflect change
    generateShoppingList();
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
    <>
      <Main maxWidth="md">
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
            
            {/* API Quota Warning */}
            <ApiQuotaWarning />
          
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
              <Box bg="emphasis" borderRadius="4" p="md">
                <Typography variant="subtitle" color="inverse">Items to buy</Typography>
                <Typography variant="h2" color="inverse">{totalItems}</Typography>
              </Box>
              <Box bg="emphasis" borderRadius="4" p="md">
                <Typography variant="subtitle" color="inverse">Already have</Typography>
                <Typography variant="h2" color="inverse">{alreadyHave.length}</Typography>
              </Box>
              <Box bg="emphasis" borderRadius="4" p="md">
                <Typography variant="subtitle" color="inverse">Categories</Typography>
                <Typography variant="h2" color="inverse">{categories.length}</Typography>
              </Box>
              <Box bg="emphasis" borderRadius="4" p="md">
                <Typography variant="subtitle" color="inverse">Estimated total</Typography>
                <Typography variant="h2" color="inverse">
                  ${needToBuy.reduce((sum, item) => {
                    const priceInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
                    // Debug logging to find the issue
                    if (priceInfo.estimatedCost > 100) {
                      console.log('⚠️ High price detected:', {
                        item: item.name,
                        normalized: item.normalizedName,
                        qty: item.totalQty,
                        unit: item.unit,
                        price: priceInfo.estimatedCost,
                        priceInfo
                      });
                    }
                    return sum + priceInfo.estimatedCost;
                  }, 0).toFixed(2)}
                </Typography>
              </Box>
            </ResponsiveGrid>

            {/* Items to Buy - Grouped by Category */}
            <Box 
              border="subtle"
              borderRadius="4"
              p="md"
              bg="default"
            >
              <Stack direction="column" gap="lg">
                {categories.map((category, categoryIndex) => {
                  const items = groupedNeedToBuy[category];
                  
                  return (
                    <Stack key={category} direction="column" gap="md">
                      {categoryIndex > 0 && (
                        <Box style={{ height: '1px', backgroundColor: '#e5e7eb' }} />
                      )}
                      <Box px="lg">
                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                          <Typography variant="caption">{category}</Typography>
                          <Chip variant="dark" size="small">{items.length} items</Chip>
                        </Stack>
                      </Box>
                      
                      <List dividers spacing="comfortable">
                        {items.map((item, index) => {
                        const hasMultipleRecipes = item.sourceRecipes.length > 1;
                        const itemKey = `${category}-${index}`;
                        const isExpanded = expandedItems.has(itemKey);
                        
                        // Get price estimate - use API price if available, otherwise static
                        const apiPrice = apiPrices.get(item.normalizedName);
                        const staticPriceInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
                        
                        const priceInfo = apiPrice ? {
                          estimatedCost: apiPrice.cost,
                          priceSource: apiPrice.source,
                          livePrice: apiPrice.livePrice,
                          confidence: apiPrice.source === 'api' ? 'high' as const : staticPriceInfo.confidence
                        } : {
                          estimatedCost: staticPriceInfo.estimatedCost,
                          priceSource: staticPriceInfo.priceSource,
                          confidence: staticPriceInfo.confidence
                        };
                        
                        const priceDisplay = priceInfo.estimatedCost > 0 
                          ? `$${priceInfo.estimatedCost.toFixed(2)}` 
                          : '';
                        const showConfidenceIcon = priceInfo.confidence === 'high';
                        
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
                            primary={item.name}
                            secondary={
                              <Stack direction="row" gap="sm" alignItems="center">
                                {hasMultipleRecipes && (
                                  <Typography variant="small" color="subdued">
                                    {item.sourceRecipes.length} recipes
                                  </Typography>
                                )}
                                {priceDisplay && (
                                  <Stack direction="row" gap="xs" alignItems="center">
                                    <Typography variant="small" color={priceInfo.confidence === 'high' ? 'default' : 'subdued'}>
                                      {priceDisplay}
                                    </Typography>
                                    {priceInfo.priceSource && (
                                      <PriceSourceBadge source={priceInfo.priceSource} livePrice={priceInfo.livePrice} />
                                    )}
                                    {showConfidenceIcon && !priceInfo.priceSource && <Icon name="checkRing" iconColor="success" size="sm" />}
                                  </Stack>
                                )}
                              </Stack>
                            }
                            badge={
                              <Stack direction="row" gap="xs" alignItems="center">
                                <Chip variant="light" size="small">
                                  {item.totalQty.toFixed(1)} {item.unit}
                                </Chip>
                                <IconButton
                                  iconName="check"
                                  size="small"
                                  variant="naked"
                                  onClick={() => handleMarkAsPantry(item)}
                                  aria-label="Mark as pantry item"
                                />
                              </Stack>
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
                );
              })}
            </Stack>
          </Box>

            {/* Already Have Section */}
            {alreadyHave.length > 0 && (
              <Box 
                border="subtle"
                borderRadius="4"
                p="md"
                bg="default"
              >
                <Stack direction="column" gap="md">
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h3">Already in your pantry</Typography>
                    <Chip variant="light">{alreadyHave.length} items</Chip>
                  </Stack>
                  
                  <Typography variant="small" color="subdued">
                    These ingredients are in your pantry inventory or marked as items you always have. They&apos;re excluded from your shopping list. Click ✕ to move back to the shopping list.
                  </Typography>
                  
                  <List dividers spacing="compact">
                    {alreadyHave.map((item, index) => (
                      <ListItem
                        key={index}
                        primary={item.name}
                        badge={
                          <Stack direction="row" gap="xs" alignItems="center">
                            <Chip variant="light" size="small">
                              {item.totalQty.toFixed(1)} {item.unit}
                            </Chip>
                            <IconButton
                              iconName="close"
                              size="small"
                              variant="naked"
                              onClick={() => handleUnmarkAsPantry(item)}
                              aria-label="Remove from pantry"
                            />
                          </Stack>
                        }
                      />
                    ))}
                  </List>
                </Stack>
              </Box>
            )}
          </Stack>
        </Container>
      </Main>
      
      {/* Coles Shopping Modal */}
      <ColesShoppingModal
        isOpen={showColesModal}
        onClose={() => setShowColesModal(false)}
        items={needToBuy}
      />
    </>
  );
}
