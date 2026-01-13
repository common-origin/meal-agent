/**
 * ColesProductCard Component
 * Displays a Coles product with details and add to cart action
 */

import { Box, Button, Stack, Typography, Chip } from "@common-origin/design-system";
import type { ColesApiProduct } from "@/lib/colesApi";

interface ColesProductCardProps {
  product: ColesApiProduct;
  quantity: number;
  unit: string;
  isRecommended?: boolean;
  onSelect: () => void;
}

export default function ColesProductCard({ 
  product, 
  quantity, 
  unit, 
  isRecommended,
  onSelect 
}: ColesProductCardProps) {
  // Log full product data for debugging
  console.log('ColesProductCard full product object:', JSON.stringify(product, null, 2));
  
  return (
    <Box 
      bg="surface" 
      borderRadius="sm" 
      p="md"
      style={{ 
        border: isRecommended ? '2px solid #10b981' : '1px solid #e5e7eb',
        position: 'relative'
      }}
    >
      {isRecommended && (
        <Box style={{ position: 'absolute', top: 8, right: 8 }}>
          <Chip size="small">Best Match</Chip>
        </Box>
      )}
      
      <Stack direction="column" gap="sm">
        <Stack direction="column" gap="xs">
          <Typography variant="subtitle">
            {product.productName || 'Product name unavailable'}
          </Typography>
          {product.brand && (
            <Typography variant="small" color="subdued">{product.brand}</Typography>
          )}
        </Stack>
        
        <Stack direction="row" gap="md" alignItems="center">
          <Box>
            <Stack direction="column" gap="xs">
              <Typography variant="h4">
                {product.currentPrice || 'Price unavailable'}
              </Typography>
              {product.size && (
                <Typography variant="small" color="subdued">
                  {product.size}
                </Typography>
              )}
            </Stack>
          </Box>
          
          <Box>
            <Typography variant="small" color="subdued">
              You need: {quantity} {unit}
            </Typography>
          </Box>
        </Stack>
        
        <Stack direction="row" gap="sm">
          <Button 
            onClick={onSelect}
            variant="primary"
            size="small"
            style={{ flex: 1 }}
          >
            View on Coles
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
