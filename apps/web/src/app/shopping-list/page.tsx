"use client";

import { useEffect } from "react";
import { Button, Stack, Typography } from "@common-origin/design-system";
import { MOCK_SHOPPING_LIST } from "@/lib/mockData";
import { generateShoppingListCSV, downloadCSV, groupIngredientsByCategory } from "@/lib/csv";
import { sortCategoriesByAisle, getCategoryInfo } from "@/lib/categories";
import { track } from "@/lib/analytics";

export default function ShoppingListPage() {
  useEffect(() => {
    track('page_view', { page: '/shopping-list' });
  }, []);

  const handleExportCSV = () => {
    track('export_csv', { itemCount: MOCK_SHOPPING_LIST.length });
    const csvContent = generateShoppingListCSV(MOCK_SHOPPING_LIST);
    downloadCSV(csvContent, "coles-shopping-list.csv");
  };

  const groupedItems = groupIngredientsByCategory(MOCK_SHOPPING_LIST);
  const sortedCategories = sortCategoriesByAisle(Object.keys(groupedItems));

  return (
    <main style={{ padding: 24 }}>
      <Stack direction="column" gap="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h1">Shopping List</Typography>
          <Button variant="primary" onClick={handleExportCSV}>
            📁 Export CSV
          </Button>
        </Stack>
        
        <Typography variant="body">
          Organized by Coles store aisles for efficient shopping.
        </Typography>

        {sortedCategories.map((category) => {
          const categoryInfo = getCategoryInfo(category);
          const items = groupedItems[category];
          
          return (
            <div key={category} style={{
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "16px",
              backgroundColor: "#f8f9fa"
            }}>
              <Stack direction="column" gap="md">
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h3">{categoryInfo.displayName}</Typography>
                  <Typography variant="small">Aisle {categoryInfo.aisleNumber}</Typography>
                </Stack>
                
                <Stack direction="column" gap="sm">
                  {items.map((item, index) => (
                    <Stack key={index} direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body">{item.name}</Typography>
                      <Typography variant="small">
                        {item.quantity} {item.unit}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </div>
          );
        })}
        
        <Typography variant="small">
          Total items: {MOCK_SHOPPING_LIST.length} • 
          Ready for Coles pickup or delivery
        </Typography>
      </Stack>
    </main>
  );
}