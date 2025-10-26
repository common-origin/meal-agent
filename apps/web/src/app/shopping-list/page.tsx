"use client";

import { Stack, Typography } from "@common-origin/design-system";
import { MOCK_SHOPPING_LIST } from "@/lib/mockData";
import { generateShoppingListCSV, downloadCSV, groupIngredientsByCategory } from "@/lib/csv";
import { sortCategoriesByAisle, getCategoryInfo } from "@/lib/categories";

export default function ShoppingListPage() {
  const handleExportCSV = () => {
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
          <button
            onClick={handleExportCSV}
            style={{
              padding: "12px 24px",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px"
            }}
          >
            📁 Export CSV
          </button>
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