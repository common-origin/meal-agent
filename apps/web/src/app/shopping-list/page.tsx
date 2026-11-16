"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Box, Button, Chip, Container, EmptyState, Icon, List, ListItem, Stack, Tag, Typography, Divider } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { aggregateShoppingList, toLegacyFormat, type AggregatedIngredient } from "@/lib/shoppingListAggregator";
import { toColesListItems } from "@/lib/coles/extensionList";
import { ingredientKey } from "@/lib/ingredients/resolve";
import { generateShoppingListCSV, downloadCSV } from "@/lib/csv";
import { loadHousehold, getDefaultHousehold } from "@/lib/storage";
import { clearShoppingComplete, isShoppingComplete as isWeekShoppingComplete, markShoppingComplete } from "@/lib/shoppingCompletion";
import { loadCurrentWeekPlan, savePantryItems, loadPantryItems, hydrateRecencyFromSupabase, syncRecencyToSupabase, listPlannedWeeks, getFamilySettings, hydrateRecipesFromSupabase } from "@/lib/hybridStorage";
import { householdTimeZone, todayInTimeZone } from "@/lib/timeZones";
import { composeWeek } from "@/lib/compose";
import { defaultPlanningWeekISO, formatWeekRange, mondayOfWeekISO, parseWeekParam, shiftWeekISO, weekToOpen } from "@/lib/schedule";
import { track, type CostOptimizedMeta } from "@/lib/analytics";
import { estimateIngredientCost } from "@/lib/colesMapping";
import { RecipeLibrary } from "@/lib/library";
import PriceSourceBadge from "@/components/app/PriceSourceBadge";
import ApiQuotaWarning from "@/components/app/ApiQuotaWarning";

export default function ShoppingListPage() {
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [colesStatus, setColesStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [sendingToColes, setSendingToColes] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [apiPrices, setApiPrices] = useState<Map<string, { cost: number; source: 'api' | 'static' | 'category'; livePrice?: boolean }>>(new Map());
  const [isShoppingComplete, setIsShoppingComplete] = useState(false);
  // "Already in your pantry" starts collapsed: it's secondary to what to buy
  const [showAlreadyHave, setShowAlreadyHave] = useState(false);
  // The Monday of the plan this list is for (#194): the link's ?week=, else the week the plan page
  // would open (weekToOpen: the week ahead at the weekend, else today's), else the week you'd plan next.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const weekRef = useRef<string>(defaultPlanningWeekISO());

  // Serializes pantry-preference read-modify-write cycles so two quick
  // mark/unmark clicks can't interleave their loadPantryItems/savePantryItems
  // calls and silently drop one of the two updates.
  const pantryUpdateQueue = useRef<Promise<unknown>>(Promise.resolve());
  const updatePantryPreference = (normalizedName: string, addItem: boolean) => {
    pantryUpdateQueue.current = pantryUpdateQueue.current
      .then(() => loadPantryItems())
      .then(current => {
        const updated = addItem
          ? Array.from(new Set([...current, normalizedName]))
          // Also drop names saved before #183 that resolve to the same ingredient ("onions").
          : current.filter(name => name !== normalizedName && ingredientKey(name) !== normalizedName);
        return savePantryItems(updated);
      })
      .catch(err => console.error('Failed to update pantry preference:', err));
  };

  const loadApiPrices = async (items: AggregatedIngredient[]) => {
    const { estimateIngredientCostWithAPI } = await import('@/lib/colesMapping');
    const priceMap = new Map<string, { cost: number; source: 'api' | 'static' | 'category'; livePrice?: boolean }>();
    
    // Load prices for each item (cached results will be instant)
    for (const item of items) {
      try {
        const result = await estimateIngredientCostWithAPI(item.normalizedName, item.priceQty, item.priceUnit);
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
    const nextWeekISO = weekRef.current;
    
    // Check if user has a saved week plan (from AI generation or manual selection)
    const savedPlan = await loadCurrentWeekPlan(nextWeekISO);
    
    let plan;
    let weeklyPantryItems: Array<{ name: string; qty: number; unit: string }> = [];
    
    // The plan's recipes may not be in this browser yet: another device or member planned them (#233).
    if (savedPlan?.recipeIds.some((recipeId) => recipeId && !RecipeLibrary.getById(recipeId))) {
      await hydrateRecipesFromSupabase().catch(() => false);
    }

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
      // Pull in any recency history recorded on other devices first, so
      // variety enforcement below sees what's actually been cooked recently
      await hydrateRecencyFromSupabase();
      plan = composeWeek(household, { weekOfISO: nextWeekISO });
      // Push this week's picks to Supabase (fire-and-forget) so other
      // devices see them too
      syncRecencyToSupabase(nextWeekISO, plan.days.map(d => d.recipeId))
        .catch(err => console.warn('Failed to sync recency history to Supabase:', err));
      // Fall back to general household pantry if no saved plan (already in correct format)
      weeklyPantryItems = household.pantry;

      // Hydrate the local pantry-preferences cache from Supabase (for
      // authenticated users) so aggregateShoppingList's synchronous
      // isInPantryPreferences check below sees pantry staples marked on
      // other devices, not just this one. Not needed on the savedPlan
      // branch above — loadCurrentWeekPlan() already called
      // HybridStorage.loadPantryItems() internally, which hydrates the
      // same cache as a side effect.
      await loadPantryItems();
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
        const colesInfo = estimateIngredientCost(item.normalizedName, item.priceQty, item.priceUnit);
        // If we bought separately, might waste ~30% per pack
        return sum + (colesInfo.mapped ? colesInfo.estimatedCost * 0.3 * (item.sourceRecipes.length - 1) : 0);
      }, 0);
      
      const totalCost = items.reduce((sum, item) => {
        const colesInfo = estimateIngredientCost(item.normalizedName, item.priceQty, item.priceUnit);
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
    
    (async () => {
      const fromLink = parseWeekParam(new URLSearchParams(window.location.search).get('week'));
      // With no link, the same week the plan page opens: by the household's day (#232).
      const pickWeek = async () => {
        const [settings, weeks] = await Promise.all([
          getFamilySettings().catch(() => null),
          // From a week back: today here may still be yesterday in the household's zone.
          listPlannedWeeks(shiftWeekISO(mondayOfWeekISO(), -1)).catch(() => []),
        ]);
        const today = todayInTimeZone(householdTimeZone(settings?.location?.timeZone));
        return weekToOpen(weeks, today) ?? defaultPlanningWeekISO(today);
      };
      const week = fromLink ?? (await pickWeek());
      weekRef.current = week;
      setWeekStart(week);

      // Check if shopping is already complete for this week
      const isComplete = isWeekShoppingComplete(week);
      setIsShoppingComplete(isComplete);

      // Generate shopping list on mount (only if not complete)
      if (!isComplete) {
        await generateShoppingList();
      } else {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCSV = () => {
    track('export_csv', { itemCount: aggregatedItems.length });
    
    // Convert to legacy format for CSV
    const legacyFormat = toLegacyFormat(aggregatedItems);
    const csvContent = generateShoppingListCSV(legacyFormat);
    downloadCSV(csvContent, "coles-shopping-list.csv");
  };

  /**
   * Saves this list for the Coles side-panel extension (#184) and opens
   * coles.com.au, where the extension's panel fills the trolley from it.
   */
  const handleShopAtColes = async () => {
    // Opened before the await so the browser treats it as part of the click; closed again if sending fails.
    const colesTab = window.open('https://www.coles.com.au', '_blank');
    if (colesTab) colesTab.opener = null;
    setSendingToColes(true);
    try {
      const res = await fetch('/api/coles/list', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: weekRef.current, items: toColesListItems(aggregatedItems) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not send the list to Coles.');
      track('coles_list_sent', { itemCount: body.count ?? 0 });
      setColesStatus({
        tone: 'success',
        text: `Sent ${body.count} items. On coles.com.au, click the Meal Agent extension icon to open your list beside the site.`,
      });
    } catch (error) {
      colesTab?.close();
      setColesStatus({ tone: 'error', text: error instanceof Error ? error.message : 'Could not send the list to Coles.' });
    } finally {
      setSendingToColes(false);
    }
  };

  const handleMarkAsPantry = (item: AggregatedIngredient) => {
    // Add to pantry preferences (syncs to Supabase for authenticated users)
    updatePantryPreference(item.normalizedName, true);

    // Update UI immediately by moving item to pantry section
    setAggregatedItems(prevItems =>
      prevItems.map(i =>
        i.normalizedName === item.normalizedName
          ? { ...i, isPantryStaple: true }
          : i
      )
    );
  };

  const handleUnmarkAsPantry = (item: AggregatedIngredient) => {
    // Remove from pantry preferences (syncs to Supabase for authenticated users)
    updatePantryPreference(item.normalizedName, false);

    // Update UI immediately by moving item back to shopping list
    setAggregatedItems(prevItems =>
      prevItems.map(i =>
        i.normalizedName === item.normalizedName
          ? { ...i, isPantryStaple: false }
          : i
      )
    );
  };

  const handleShoppingComplete = () => {
    // Mark shopping as complete for this week
    const nextWeekISO = weekRef.current;
    markShoppingComplete(nextWeekISO);
    setIsShoppingComplete(true);
    
    track('shopping_completed', { 
      itemCount: aggregatedItems.length,
      weekStart: nextWeekISO 
    });
  };

  /** Reopens this week's list from the completed screen (#173). */
  const handleShowListAgain = async () => {
    clearShoppingComplete(weekRef.current);
    setIsShoppingComplete(false);
    setLoading(true);
    await generateShoppingList();
  };

  if (loading) {
    return (
      <Main maxWidth="md">
        <Typography variant="h1">Generating shopping list...</Typography>
      </Main>
    );
  }

  // If shopping is complete, show completion message
  if (isShoppingComplete) {
    return (
      <Main maxWidth="md">
        <Container>
          <Stack direction="column" gap="lg">
            <Stack direction="column" gap="xs">
              <Typography variant="h1">Shopping list</Typography>
              {weekStart && <Typography variant="small" color="subdued">{formatWeekRange(weekStart)}</Typography>}
            </Stack>
            <Alert variant="success" title="Shopping completed">
              Your shopping has been marked as complete. The list will show again when you confirm your next plan.
            </Alert>
            <Stack direction="row" gap="sm" wrap>
              <Link href="/plan">
                <Button variant="primary" size="large">
                  View your meal plan
                </Button>
              </Link>
              {/* Never a dead end: reopen this week's list (#173) */}
              <Button variant="secondary" size="large" onClick={handleShowListAgain}>
                Show the shopping list
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Main>
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

  // Each item's price, worked out once: the Coles price when there is one, else the static
  // estimate. The rows show it and the header's total sums it, so the two always agree.
  const priceFor = (item: AggregatedIngredient) => {
    const apiPrice = apiPrices.get(item.normalizedName);
    const staticPriceInfo = estimateIngredientCost(item.normalizedName, item.priceQty, item.priceUnit);
    return apiPrice ? {
      estimatedCost: apiPrice.cost,
      priceSource: apiPrice.source,
      livePrice: apiPrice.livePrice,
      confidence: apiPrice.source === 'api' ? 'high' as const : staticPriceInfo.confidence
    } : {
      estimatedCost: staticPriceInfo.estimatedCost,
      priceSource: staticPriceInfo.priceSource,
      livePrice: undefined,
      confidence: staticPriceInfo.confidence
    };
  };
  const priceByItem = new Map(needToBuy.map((item) => [item, priceFor(item)]));
  const estimatedTotal = [...priceByItem.values()].reduce((sum, price) => sum + price.estimatedCost, 0);

  return (
    <>
      <Main maxWidth="md">
        <Container>
          <Stack direction="column" gap="lg">
            {/* Header: title, then the week and the figures a shopper needs as tags, like the plan page */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap="md" wrap>
              <Stack direction="column" gap="xs">
                <Typography variant="h1">Shopping list</Typography>
                <Stack direction="row" gap="xs" alignItems="center" wrap>
                  {weekStart && <Typography variant="small" color="subdued">{formatWeekRange(weekStart)}</Typography>}
                  <Tag size="small">{`${totalItems} ${totalItems === 1 ? 'item' : 'items'}`}</Tag>
                  {estimatedTotal > 0 && <Tag size="small">{`~$${estimatedTotal.toFixed(2)}`}</Tag>}
                  <Tag size="small">{`${categories.length} ${categories.length === 1 ? 'aisle' : 'aisles'}`}</Tag>
                </Stack>
              </Stack>
              <Stack direction="row" gap="sm">
                {/* Naked: Shop at Coles is the page's one main action */}
                <Button variant="naked" size="large" iconName="download" onClick={handleExportCSV}>
                  Export CSV
                </Button>
                <Button variant="primary" size="large" iconName="shoppingCart" onClick={handleShopAtColes} disabled={sendingToColes}>
                  Shop at Coles
                </Button>
              </Stack>
            </Stack>

            {colesStatus && (
              <Alert variant={colesStatus.tone} title={colesStatus.tone === 'success' ? 'List sent to Coles' : 'Not sent'}>
                {colesStatus.text}
              </Alert>
            )}
            
            {/* API Quota Warning */}
            <ApiQuotaWarning />
          
            {/* Everything's already in the pantry: say so, rather than an empty page */}
            {totalItems === 0 && (
              <Box mt="2xl">
                <EmptyState
                  illustration="empty"
                  title="Nothing to buy this week"
                  description="Everything this plan needs is already in your pantry."
                />
              </Box>
            )}

            {/* Items to buy, by aisle: straight on the page, no card. One gap between aisles (the
                heading separates them, so no divider), compact rows to scan quickly. */}
            {totalItems > 0 && (
            <Box mt="2xl" data-co-density="compact">
              <Stack direction="column" gap="xl">
                {categories.map((category) => {
                  const items = groupedNeedToBuy[category];

                  return (
                    <Stack key={category} direction="column" gap="sm">
                      <Stack direction="row" alignItems="center" gap="sm">
                        <Typography variant="h4" as="h2">{category}</Typography>
                        <Tag size="small">{items.length}</Tag>
                      </Stack>

                      <List dividers>
                        {items.map((item, index) => {
                        const hasMultipleRecipes = item.sourceRecipes.length > 1;
                        const itemKey = `${category}-${index}`;
                        const isExpanded = expandedItems.has(itemKey);
                        
                        const priceInfo = priceByItem.get(item) ?? priceFor(item);
                        
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
                                {((item.shoppingLabel !== item.quantityLabel) || hasMultipleRecipes) && (
                                  <Typography variant="small" color="subdued">
                                    {[
                                      item.shoppingLabel !== item.quantityLabel ? item.quantityLabel : '',
                                      hasMultipleRecipes ? `${item.shoppingLabel !== item.quantityLabel ? 'across ' : ''}${item.sourceRecipes.length} recipes` : '',
                                    ].filter(Boolean).join(' ')}
                                  </Typography>
                                )}
                                {priceDisplay && (
                                  <Stack direction="row" gap="xs" alignItems="center">
                                    <Typography variant="small" color={priceInfo.confidence === 'high' ? 'default' : 'subdued'}>
                                      {priceDisplay}
                                    </Typography>
                                    {/* Flag a live Coles price, and a rough (category or cached) estimate. A mapped
                                        static price is the norm, so it goes untagged to keep rows quiet. */}
                                    {priceInfo.priceSource && priceInfo.priceSource !== 'static' && (
                                      <PriceSourceBadge source={priceInfo.priceSource} livePrice={priceInfo.livePrice} />
                                    )}
                                    {showConfidenceIcon && !priceInfo.priceSource && <Icon name="checkRing" iconColor="success" size="sm" />}
                                  </Stack>
                                )}
                              </Stack>
                            }
                            badge={
                              <Stack direction="row" gap="xs" alignItems="center">
                                <Chip>
                                  {item.shoppingLabel}
                                </Chip>
                                <Button
                                  size="small"
                                  variant="naked"
                                  iconName="close"
                                  onClick={() => handleMarkAsPantry(item)}
                                >
                                  Remove
                                </Button>
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
                                    • {recipe.recipeTitle}: {Math.round(recipe.qty * 10) / 10} {recipe.unit}
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
            )}

            {/* Already Have Section */}
            {alreadyHave.length > 0 && (
              // Collapsed by default, under a divider: secondary to the list above
              <Stack direction="column" gap="sm">
                <Divider size="small" />
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap="sm">
                  <Stack direction="row" alignItems="center" gap="sm">
                    <Typography variant="h4" as="h2">Already in your pantry</Typography>
                    <Tag size="small">{alreadyHave.length}</Tag>
                  </Stack>
                  <Button
                    variant="naked"
                    size="small"
                    iconName={showAlreadyHave ? 'arrowUp' : 'arrowDown'}
                    aria-expanded={showAlreadyHave}
                    aria-controls="already-have-list"
                    // The visible "Show"/"Hide" alone doesn't say what it shows
                    aria-label={`${showAlreadyHave ? 'Hide' : 'Show'} items already in your pantry`}
                    onClick={() => setShowAlreadyHave((shown) => !shown)}
                  >
                    {showAlreadyHave ? 'Hide' : 'Show'}
                  </Button>
                </Stack>

                {/* Always in the DOM, hidden when collapsed, so aria-controls has a target */}
                <div id="already-have-list" data-co-density="compact" hidden={!showAlreadyHave}>
                <Stack direction="column" gap="sm">
                  <Typography variant="small" color="subdued">
                    Left off your list because they&apos;re in your pantry or marked as always on hand. Add any you need more of.
                  </Typography>

                  <List dividers>
                    {alreadyHave.map((item, index) => (
                      <ListItem
                        key={index}
                        primary={item.name}
                        badge={
                          <Stack direction="row" gap="xs" alignItems="center">
                            <Chip>
                              {item.shoppingLabel}
                            </Chip>
                            <Button
                              size="small"
                              variant="naked"
                              onClick={() => handleUnmarkAsPantry(item)}
                              iconName="add"
                            >
                              Add to shopping list
                            </Button>
                          </Stack>
                        }
                      />
                    ))}
                  </List>
                </Stack>
                </div>
              </Stack>
            )}

            {/* Once the trolley is checked out on coles.com.au */}
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="secondary" size="large" onClick={handleShoppingComplete}>
                Mark shopping done
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Main>
    </>
  );
}
