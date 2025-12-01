"use client";

import { useState, useEffect } from "react";
import { Alert, Box, Button, Chip, IconButton, Sheet, Stack, Typography } from "@common-origin/design-system";
import { estimateIngredientCost } from "@/lib/colesMapping";
import type { AggregatedIngredient } from "@/lib/shoppingListAggregator";
import type { ColesApiProduct } from "@/lib/colesApi";
import ColesProductCard from "./ColesProductCard";

interface ColesShoppingModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: AggregatedIngredient[];
  onShoppingComplete?: () => void;
}

interface ShoppingItem {
  ingredient: AggregatedIngredient;
  colesSearchUrl: string;
  isCompleted: boolean;
  products?: ColesApiProduct[];
  loadingProducts?: boolean;
}

export default function ColesShoppingModal({ isOpen, onClose, items, onShoppingComplete }: ColesShoppingModalProps) {
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => 
    items
      .filter(item => !item.isPantryStaple) // Exclude pantry staples
      .map(item => {
        const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
        const searchTerm = colesInfo.product?.name || item.name;
        
        return {
          ingredient: item,
          colesSearchUrl: `https://www.coles.com.au/search?q=${encodeURIComponent(searchTerm)}`,
          isCompleted: false,
        };
      })
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  // Update shopping items when items prop changes (e.g., when pantry items are marked)
  useEffect(() => {
    const newItems = items
      .filter(item => !item.isPantryStaple) // Exclude pantry staples
      .map(item => {
        const colesInfo = estimateIngredientCost(item.normalizedName, item.totalQty, item.unit);
        const searchTerm = colesInfo.product?.name || item.name;
        
        return {
          ingredient: item,
          colesSearchUrl: `https://www.coles.com.au/search?q=${encodeURIComponent(searchTerm)}`,
          isCompleted: false,
        };
      });
    
    setShoppingItems(newItems);
    // Reset to first item if current index is out of bounds
    if (currentIndex >= newItems.length) {
      setCurrentIndex(Math.max(0, newItems.length - 1));
    }
  }, [items]);

  // Load products for current item
  useEffect(() => {
    if (!hasStarted || !isOpen) return;
    
    const loadProducts = async () => {
      const item = shoppingItems[currentIndex];
      if (item.products || item.loadingProducts) return;
      
      // Mark as loading
      setShoppingItems(prev => {
        const updated = [...prev];
        updated[currentIndex] = { ...updated[currentIndex], loadingProducts: true };
        return updated;
      });
      
      try {
        const { searchColesProducts } = await import('@/lib/colesApi');
        const colesInfo = estimateIngredientCost(item.ingredient.normalizedName, item.ingredient.totalQty, item.ingredient.unit);
        const searchTerm = colesInfo.product?.name || item.ingredient.name;
        
        console.log('🔍 Loading products for:', searchTerm);
        // Pass category for enhanced search term generation
        const result = await searchColesProducts(searchTerm, 3, item.ingredient.category);
        console.log('📦 Loaded products:', result);
        
        setShoppingItems(prev => {
          const updated = [...prev];
          updated[currentIndex] = {
            ...updated[currentIndex],
            products: result?.results || [],
            loadingProducts: false
          };
          return updated;
        });
      } catch (error) {
        console.error('Failed to load products:', error);
        setShoppingItems(prev => {
          const updated = [...prev];
          updated[currentIndex] = { ...updated[currentIndex], loadingProducts: false };
          return updated;
        });
      }
    };
    
    loadProducts();
  }, [currentIndex, hasStarted, isOpen, shoppingItems]);

  const completedCount = shoppingItems.filter(item => item.isCompleted).length;
  const totalCount = shoppingItems.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStartShopping = () => {
    setHasStarted(true);
    openCurrentItem();
  };

  const openCurrentItem = () => {
    if (currentIndex < shoppingItems.length) {
      const item = shoppingItems[currentIndex];
      window.open(item.colesSearchUrl, '_blank');
    }
  };

  const handleNextItem = () => {
    // Mark current as completed
    const updatedItems = [...shoppingItems];
    updatedItems[currentIndex].isCompleted = true;
    setShoppingItems(updatedItems);

    // Move to next item
    if (currentIndex < shoppingItems.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      // Auto-open next item
      setTimeout(() => {
        const nextItem = updatedItems[nextIndex];
        window.open(nextItem.colesSearchUrl, '_blank');
      }, 300);
    }
  };

  const handlePreviousItem = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      openCurrentItem();
    }
  };

  const handleFinish = () => {
    // Mark last item as completed
    const updatedItems = [...shoppingItems];
    updatedItems[currentIndex].isCompleted = true;
    setShoppingItems(updatedItems);
    
    // Notify parent that shopping is complete
    if (onShoppingComplete) {
      onShoppingComplete();
    }
    
    // Show completion state briefly, then close
    setTimeout(() => {
      onClose();
      // Reset state for next time
      setHasStarted(false);
      setCurrentIndex(0);
      setShoppingItems(items => items.map(item => ({ ...item, isCompleted: false })));
    }, 2000);
  };

  const currentItem = shoppingItems[currentIndex];
  const isLastItem = currentIndex === shoppingItems.length - 1;
  const isFirstItem = currentIndex === 0;
  const allCompleted = completedCount === totalCount;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      position="right"
      width="500px"
    >
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="column" gap="lg">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h2">Shop at Coles</Typography>
          <IconButton
            iconName="close"
            variant="naked"
            size="medium"
            onClick={onClose}
            aria-label="Close"
          />
        </Stack>

        {!hasStarted ? (
          /* Instructions Screen */
          <Stack direction="column" gap="lg">
            {/* Instructions */}
            <Box bg="subtle" borderRadius="3" p="md">
              <Stack direction="column" gap="sm">
                <Typography variant="subtitle">How it works:</Typography>
                <Typography variant="body">
                  1. Add the item to your Coles cart<br />
                  2. Return to this window<br />
                  3. Click &quot;Next Item&quot; below to continue
                </Typography>
              </Stack>
            </Box>            <Stack direction="column" gap="md">
              <Typography variant="h4">Your Shopping List ({totalCount} items)</Typography>
              <Stack direction="column" gap="xs">
                {shoppingItems.map((item, index) => (
                  <Box
                    key={index}
                    bg="surface"
                    borderRadius="2"
                    p="sm"
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="column" gap="xs">
                        <Typography variant="body">{item.ingredient.name}</Typography>
                        <Typography variant="small" color="subdued">
                          {item.ingredient.totalQty} {item.ingredient.unit}
                        </Typography>
                      </Stack>
                      {estimateIngredientCost(item.ingredient.normalizedName, item.ingredient.totalQty, item.ingredient.unit).mapped && (
                        <Chip variant="dark" size="small">Mapped</Chip>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>

            <Button
              variant="primary"
              size="large"
              onClick={handleStartShopping}
            >
              Start Shopping at Coles
            </Button>
          </Stack>
        ) : allCompleted ? (
          /* Completion Screen */
          <Stack direction="column" gap="lg" alignItems="center" justifyContent="center">
            <Typography variant="h1">✓</Typography>
            <Typography variant="h2">All Done!</Typography>
            <Typography variant="body">
              You&apos;ve added all {totalCount} items to your Coles cart.
              <br />
              Head to Coles to complete your checkout.
            </Typography>
            <Button
              variant="primary"
              size="large"
              onClick={() => window.open('https://www.coles.com.au/cart', '_blank')}
            >
              Go to Coles Cart
            </Button>
          </Stack>
        ) : (
          /* Shopping Progress Screen */
          <Stack direction="column" gap="lg">
            {/* Progress Bar */}
            <Stack direction="column" gap="sm">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle">Progress</Typography>
                <Typography variant="body">
                  {completedCount + 1} of {totalCount}
                </Typography>
              </Stack>
              <Box
                bg="surface"
                borderRadius="2"
                style={{ height: '8px', overflow: 'hidden' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--color-primary)',
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
            </Stack>

            {/* Current Item */}
            <Box bg="surface" borderRadius="3" p="lg" border="default">
              <Stack direction="column" gap="md">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h3">Current Item</Typography>
                  {isLastItem && (
                    <Chip variant="dark">Last one!</Chip>
                  )}
                </Stack>
                
                <Stack direction="column" gap="sm">
                  <Typography variant="h2">{currentItem.ingredient.name}</Typography>
                  <Typography variant="body" color="subdued">
                    Quantity: {currentItem.ingredient.totalQty} {currentItem.ingredient.unit}
                  </Typography>
                </Stack>

                {/* Product Options */}
                {currentItem.loadingProducts ? (
                  <Box bg="subtle" borderRadius="2" p="md">
                    <Typography variant="body">Loading products from Coles...</Typography>
                  </Box>
                ) : currentItem.products && currentItem.products.length > 0 ? (
                  <Stack direction="column" gap="sm">
                    <Typography variant="subtitle">Available at Coles:</Typography>
                    {currentItem.products.slice(0, 3).map((product, index) => (
                      <ColesProductCard
                        key={index}
                        product={product}
                        quantity={currentItem.ingredient.totalQty}
                        unit={currentItem.ingredient.unit}
                        isRecommended={index === 0}
                        onSelect={() => window.open(product.url, '_blank')}
                      />
                    ))}
                  </Stack>
                ) : (
                  <>
                    <Alert variant="warning" inline>
                      No products found. Try searching manually at Coles.
                    </Alert>
                    <Button
                      variant="secondary"
                      onClick={openCurrentItem}
                    >
                      Search on Coles
                    </Button>
                  </>
                )}
              </Stack>
            </Box>

            {/* Instructions */}
            <Box bg="subtle" borderRadius="3" p="md">
              <Stack direction="column" gap="xs">
                <Typography variant="body">
                  <strong>Next steps:</strong>
                </Typography>
                <Typography variant="small">
                  1. Search for the item in the opened Coles tab
                  <br />
                  2. Add the correct quantity to your cart
                  <br />
                  3. Click &quot;Next Item&quot; below to continue
                </Typography>
              </Stack>
            </Box>

            {/* Completed Items List */}
            {completedCount > 0 && (
              <Stack direction="column" gap="sm">
                <Typography variant="subtitle">Added to Cart ({completedCount})</Typography>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  <Stack direction="column" gap="xs">
                  {shoppingItems
                    .filter(item => item.isCompleted)
                    .map((item, index) => (
                      <Box
                        key={index}
                        bg="subtle"
                        borderRadius="2"
                        p="sm"
                      >
                        <Stack direction="row" gap="sm" alignItems="center">
                          <Typography variant="body">✓</Typography>
                          <Typography variant="small">{item.ingredient.name}</Typography>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                </div>
              </Stack>
            )}

            {/* Navigation Buttons */}
            <Stack direction="row" gap="md">
              <Button
                variant="secondary"
                onClick={handlePreviousItem}
                disabled={isFirstItem}
              >
                ← Previous
              </Button>
              {isLastItem ? (
                <Button
                  variant="primary"
                  onClick={handleFinish}
                >
                  ✓ Finish Shopping
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleNextItem}
                >
                  Next Item →
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>
      </Box>
    </Sheet>
  );
}
