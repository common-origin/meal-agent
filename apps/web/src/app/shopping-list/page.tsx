"use client";

import { useEffect, useState } from "react";
import { Button, Stack, Typography } from "@common-origin/design-system";
import ShoppingListItem from "@/components/app/ShoppingListItem";
import { aggregateShoppingList, toLegacyFormat, type AggregatedIngredient } from "@/lib/shoppingListAggregator";
import { generateShoppingListCSV, downloadCSV } from "@/lib/csv";
import { loadHousehold, getDefaultHousehold, loadWeeklyOverrides } from "@/lib/storage";
import { composeWeek } from "@/lib/compose";
import { nextWeekMondayISO } from "@/lib/schedule";
import { track, type CostOptimizedMeta } from "@/lib/analytics";
import { estimateIngredientCost } from "@/lib/colesMapping";

export default function ShoppingListPage() {
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedIngredient[]>([]);
  const [excludePantry, setExcludePantry] = useState(false);
  const [loading, setLoading] = useState(true);

  const generateShoppingList = (excludePantryParam: boolean = false) => {
    setLoading(true);
    
    // Get current plan
    const household = loadHousehold() || getDefaultHousehold();
    const nextWeekISO = nextWeekMondayISO();
    const overrides = loadWeeklyOverrides(nextWeekISO);
    const plan = composeWeek(household, overrides || undefined);
    
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
            <Button variant="primary" size="medium" onClick={handleExportCSV}>
              📁 Export CSV
            </Button>
          </Stack>
        </Stack>
        
        <Typography variant="body">
          Aggregated from your meal plan with de-duplicated ingredients.
        </Typography>

        {/* Summary Stats */}
        <div style={{
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #dee2e6"
        }}>
          <Stack direction="row" gap="xl">
            <div>
              <Typography variant="h4">Total Items</Typography>
              <Typography variant="h2">{totalItems}</Typography>
            </div>
            <div>
              <Typography variant="h4">Pantry Staples</Typography>
              <Typography variant="h2">{pantryItems}</Typography>
            </div>
            <div>
              <Typography variant="h4">Categories</Typography>
              <Typography variant="h2">{categories.length}</Typography>
            </div>
            <div>
              <Typography variant="h4">Est. Coles Cost</Typography>
              <Typography variant="h2">${totalEstimatedCost.toFixed(2)}</Typography>
              <Typography variant="small">{mappingCoverage}% mapped</Typography>
            </div>
          </Stack>
        </div>

        {/* Items by Category */}
        {categories.map((category) => {
          const items = grouped[category];
          
          return (
            <div key={category} style={{
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "16px",
              backgroundColor: "#ffffff"
            }}>
              <Stack direction="column" gap="md">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h3">{category}</Typography>
                  <Typography variant="small">{items.length} items</Typography>
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
            </div>
          );
        })}
        
        <Typography variant="small">
          💡 Click items with multiple recipes to see breakdown • 
          ✓ Green badges show Coles mapped items with estimated prices • 
          Ready for Coles pickup or delivery
        </Typography>
      </Stack>
    </main>
  );
}
