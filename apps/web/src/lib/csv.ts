import { type Ingredient } from "./mockData";

export function groupIngredientsByCategory(ingredients: Ingredient[]): Record<string, Ingredient[]> {
  return ingredients.reduce((groups, ingredient) => {
    const category = ingredient.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(ingredient);
    return groups;
  }, {} as Record<string, Ingredient[]>);
}

export function generateShoppingListCSV(ingredients: Ingredient[]): string {
  const headers = ["Category", "Qty", "Unit", "Item"];
  const groupedIngredients = groupIngredientsByCategory(ingredients);
  
  const rows: string[] = [headers.join(",")];
  
  // Sort categories for consistent output
  const sortedCategories = Object.keys(groupedIngredients).sort();
  
  for (const category of sortedCategories) {
    const categoryIngredients = groupedIngredients[category];
    
    for (const ingredient of categoryIngredients) {
      const row = [
        `"${category}"`,
        ingredient.quantity.toString(),
        `"${ingredient.unit}"`,
        `"${ingredient.name}"`
      ];
      rows.push(row.join(","));
    }
  }
  
  return rows.join("\n");
}

export function downloadCSV(csvContent: string, filename: string = "shopping-list.csv"): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}