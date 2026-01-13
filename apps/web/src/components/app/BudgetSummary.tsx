/**
 * Enhanced Budget Summary Component
 * Shows weekly cost with daily breakdown, price sources, and API-enhanced estimates
 */

import { useState, useEffect } from "react";
import { Box, Stack, Typography, ProgressBar, Chip, Button, Divider } from "@common-origin/design-system";
import { RecipeLibrary } from "@/lib/library";
import { estimateIngredientCostWithAPI } from "@/lib/colesMapping";
import type { MealCardProps } from "./MealCard";

export interface BudgetSummaryProps {
  weekPlan: (MealCardProps | null)[];
  budget: {
    current: number;
    total: number;
  };
  dayNames: string[];
}

interface DailyCost {
  day: string;
  cost: number;
  recipeTitle: string;
  priceSource: 'static' | 'api' | 'category';
  livePrice: boolean;
}

export default function BudgetSummary({ weekPlan, budget, dayNames }: BudgetSummaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [dailyCosts, setDailyCosts] = useState<DailyCost[]>([]);
  const [loadingApiPrices, setLoadingApiPrices] = useState(false);
  const [apiEnhancedCost, setApiEnhancedCost] = useState<number | null>(null);

  const percentage = Math.min((budget.current / budget.total) * 100, 100);
  const isOverBudget = budget.current > budget.total;
  
  // Calculate daily costs with static prices initially
  useEffect(() => {
    const costs: DailyCost[] = weekPlan.map((meal, index) => {
      if (!meal) {
        return {
          day: dayNames[index],
          cost: 0,
          recipeTitle: 'No meal planned',
          priceSource: 'static' as const,
          livePrice: false
        };
      }
      
      const recipe = RecipeLibrary.getById(meal.recipeId);
      const cost = recipe ? (recipe.costPerServeEst || 0) * (recipe.serves || 4) : 0;
      
      return {
        day: dayNames[index],
        cost,
        recipeTitle: meal.title,
        priceSource: 'static' as const,
        livePrice: false
      };
    });
    
    setDailyCosts(costs);
  }, [weekPlan, dayNames]);
  
  // Load API-enhanced prices asynchronously
  const loadApiEnhancedPrices = async () => {
    setLoadingApiPrices(true);
    
    try {
      const costs: DailyCost[] = [];
      let totalApiCost = 0;
      
      for (let i = 0; i < weekPlan.length; i++) {
        const meal = weekPlan[i];
        
        if (!meal) {
          costs.push({
            day: dayNames[i],
            cost: 0,
            recipeTitle: 'No meal planned',
            priceSource: 'static',
            livePrice: false
          });
          continue;
        }
        
        const recipe = RecipeLibrary.getById(meal.recipeId);
        if (!recipe) {
          costs.push({
            day: dayNames[i],
            cost: 0,
            recipeTitle: meal.title,
            priceSource: 'static',
            livePrice: false
          });
          continue;
        }
        
        // Calculate cost using API pricing for each ingredient
        let recipeCost = 0;
        let hasApiPrice = false;
        let priceSource: 'static' | 'api' | 'category' = 'static';
        
        for (const ingredient of recipe.ingredients) {
          try {
            const result = await estimateIngredientCostWithAPI(
              ingredient.name,
              ingredient.qty,
              ingredient.unit
            );
            recipeCost += result.estimatedCost;
            
            if (result.priceSource === 'api' && result.livePrice) {
              hasApiPrice = true;
              priceSource = 'api';
            } else if (priceSource !== 'api' && result.priceSource === 'static') {
              priceSource = 'static';
            } else if (priceSource === 'static' && result.priceSource === 'category') {
              priceSource = 'category';
            }
          } catch (error) {
            console.warn(`Failed to get API price for ${ingredient.name}:`, error);
            // Fall back to static estimate
            recipeCost += (recipe.costPerServeEst || 0) * (recipe.serves || 4) / recipe.ingredients.length;
          }
        }
        
        costs.push({
          day: dayNames[i],
          cost: recipeCost,
          recipeTitle: meal.title,
          priceSource,
          livePrice: hasApiPrice
        });
        
        totalApiCost += recipeCost;
      }
      
      setDailyCosts(costs);
      setApiEnhancedCost(totalApiCost);
    } catch (error) {
      console.error('Failed to load API-enhanced prices:', error);
    } finally {
      setLoadingApiPrices(false);
    }
  };
  
  const livePriceCount = dailyCosts.filter(d => d.livePrice).length;
  const staticPriceCount = dailyCosts.filter(d => d.priceSource === 'static' && d.cost > 0).length;
  const estimatedPriceCount = dailyCosts.filter(d => d.priceSource === 'category').length;
  
  return (
    <Stack direction="column" gap="md">
      {/* Main Budget Bar */}
      <Divider size="small" />
      <Box bg="surface" borderRadius="md" border="default">
        <Stack direction="column" gap="md">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h3">Weekly budget</Typography>
            <Stack direction="row" gap="sm" alignItems="center">
              <Typography variant="body">
                ${(apiEnhancedCost || budget.current).toFixed(2)} / ${budget.total.toFixed(2)}
              </Typography>
              {apiEnhancedCost && apiEnhancedCost !== budget.current && (
                <Chip size="small" variant="emphasis">Live pricing</Chip>
              )}
            </Stack>
          </Stack>
          
          <ProgressBar
            value={percentage}
            color={isOverBudget ? "error" : "success"}
            height="md"
          />
          
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            {isOverBudget ? (
              <Typography variant="small">
                Over budget by ${((apiEnhancedCost || budget.current) - budget.total).toFixed(2)}
              </Typography>
            ) : (
              <Typography variant="small" color="subdued">
                Remaining: ${(budget.total - (apiEnhancedCost || budget.current)).toFixed(2)}
              </Typography>
            )}
            
            <Stack direction="row" gap="sm">
              {!apiEnhancedCost && !loadingApiPrices && (
                <Button 
                  onClick={loadApiEnhancedPrices}
                  variant="secondary"
                  size="small"
                >
                  Get live prices
                </Button>
              )}
              <Button 
                onClick={() => setShowDetails(!showDetails)}
                variant="secondary"
                size="small"
              >
                {showDetails ? 'Hide' : 'Show'} details
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Box>
      <Divider size="small" />
      
      {/* Detailed Breakdown */}
      {showDetails && (
        <Box bg="subtle" borderRadius="md" p="lg" border="default">
          <Stack direction="column" gap="md">
            <Box style={{ marginBottom: '8px' }}>
              <Typography variant="h4">Daily cost breakdown</Typography>
            </Box>
            
            {loadingApiPrices && (
              <Box bg="subtle" borderRadius="sm" p="md">
                <Typography variant="small">Loading live prices from Coles API...</Typography>
              </Box>
            )}
            
            <Stack direction="column" gap="sm">
              {dailyCosts.map((dayCost, index) => (
                <Box 
                  key={index}
                  style={{ 
                    padding: '8px 0',
                    borderBottom: index < dailyCosts.length - 1 ? '1px solid #e5e7eb' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <Stack direction="column" gap="xs">
                    <Stack direction="row" gap="sm" alignItems="center">
                      <Typography variant="subtitle">{dayCost.day}</Typography>
                      {dayCost.livePrice && (
                        <Chip size="small">Live</Chip>
                      )}
                      {!dayCost.livePrice && dayCost.priceSource === 'static' && dayCost.cost > 0 && (
                        <Chip size="small">Static</Chip>
                      )}
                      {dayCost.priceSource === 'category' && (
                        <Chip size="small">Estimated</Chip>
                      )}
                    </Stack>
                    <Typography variant="small" color="subdued">
                      {dayCost.recipeTitle}
                    </Typography>
                  </Stack>
                  <Typography variant="body">
                    ${dayCost.cost.toFixed(2)}
                  </Typography>
                </Box>
              ))}
            </Stack>
            
            {/* Price Source Summary */}
            {(livePriceCount > 0 || staticPriceCount > 0 || estimatedPriceCount > 0) && (
              <Box bg="default" borderRadius="sm" p="md" style={{ marginTop: '8px' }}>
                <Stack direction="column" gap="xs">
                  <Typography variant="small">Price sources:</Typography>
                  <Box style={{ display: 'flex', flexDirection: 'row', gap: '12px', flexWrap: 'wrap' }}>
                    {livePriceCount > 0 && (
                      <Typography variant="small" color="subdued">
                        {livePriceCount} meal{livePriceCount !== 1 ? 's' : ''} with live Coles pricing
                      </Typography>
                    )}
                    {staticPriceCount > 0 && (
                      <Typography variant="small" color="subdued">
                        {staticPriceCount} with static prices
                      </Typography>
                    )}
                    {estimatedPriceCount > 0 && (
                      <Typography variant="small" color="subdued">
                        {estimatedPriceCount} estimated
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
