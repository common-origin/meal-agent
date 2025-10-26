import { type MealCardProps } from "@/components/app/MealCard";
import { type Chef } from "@/components/app/ChefPicker";

export const MOCK_CHEFS: Chef[] = [
  {
    id: "gordon",
    name: "Gordon Ramsay",
    picture: "/chefs/gordon.jpg",
    specialties: ["British", "Fine Dining", "Comfort Food"]
  },
  {
    id: "jamie",
    name: "Jamie Oliver",
    picture: "/chefs/jamie.jpg", 
    specialties: ["Italian", "Healthy", "Quick Meals"]
  },
  {
    id: "nigella",
    name: "Nigella Lawson",
    picture: "/chefs/nigella.jpg",
    specialties: ["Comfort Food", "Baking", "Family Meals"]
  },
  {
    id: "yotam",
    name: "Yotam Ottolenghi",
    picture: "/chefs/yotam.jpg",
    specialties: ["Mediterranean", "Vegetarian", "Modern"]
  }
];

export const MOCK_MEALS: MealCardProps[] = [
  {
    title: "Spaghetti Bolognese",
    chef: "Jamie Oliver",
    timeMins: 45,
    kidsFriendly: true,
    conflicts: []
  },
  {
    title: "Beef Wellington",
    chef: "Gordon Ramsay", 
    timeMins: 120,
    kidsFriendly: false,
    conflicts: ["High cost", "Advanced technique"]
  },
  {
    title: "Chicken Tikka Masala",
    chef: "Gordon Ramsay",
    timeMins: 60,
    kidsFriendly: true,
    conflicts: []
  },
  {
    title: "Lemon Drizzle Cake",
    chef: "Nigella Lawson",
    timeMins: 90,
    kidsFriendly: true,
    conflicts: []
  },
  {
    title: "Shakshuka",
    chef: "Yotam Ottolenghi",
    timeMins: 30,
    kidsFriendly: false,
    conflicts: ["Spicy"]
  },
  {
    title: "Fish and Chips",
    chef: "Gordon Ramsay",
    timeMins: 40,
    kidsFriendly: true,
    conflicts: []
  },
  {
    title: "Veggie Pasta Primavera",
    chef: "Jamie Oliver",
    timeMins: 25,
    kidsFriendly: true,
    conflicts: []
  }
];

export const MOCK_WEEK_PLAN: (MealCardProps | null)[] = [
  MOCK_MEALS[0], // Monday - Spaghetti Bolognese
  MOCK_MEALS[2], // Tuesday - Chicken Tikka Masala  
  null,          // Wednesday - No meal planned
  MOCK_MEALS[4], // Thursday - Shakshuka
  MOCK_MEALS[5], // Friday - Fish and Chips
  MOCK_MEALS[6], // Saturday - Veggie Pasta Primavera
  null           // Sunday - No meal planned
];

export const MOCK_BUDGET = {
  current: 87.50,
  total: 120.00
};

export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  category: string;
};

export const MOCK_SHOPPING_LIST: Ingredient[] = [
  // Produce
  { name: "Onions", quantity: 3, unit: "items", category: "Produce" },
  { name: "Garlic", quantity: 1, unit: "bulb", category: "Produce" },
  { name: "Tomatoes", quantity: 6, unit: "items", category: "Produce" },
  { name: "Basil", quantity: 1, unit: "bunch", category: "Produce" },
  { name: "Lemons", quantity: 4, unit: "items", category: "Produce" },
  
  // Meat & Seafood
  { name: "Ground Beef", quantity: 500, unit: "g", category: "Meat & Seafood" },
  { name: "Chicken Thighs", quantity: 1, unit: "kg", category: "Meat & Seafood" },
  { name: "White Fish Fillets", quantity: 800, unit: "g", category: "Meat & Seafood" },
  
  // Pantry
  { name: "Spaghetti", quantity: 500, unit: "g", category: "Pantry" },
  { name: "Olive Oil", quantity: 1, unit: "bottle", category: "Pantry" },
  { name: "Flour", quantity: 1, unit: "kg", category: "Pantry" },
  { name: "Canned Tomatoes", quantity: 2, unit: "cans", category: "Pantry" },
  
  // Dairy
  { name: "Parmesan Cheese", quantity: 200, unit: "g", category: "Dairy" },
  { name: "Eggs", quantity: 12, unit: "items", category: "Dairy" },
  { name: "Butter", quantity: 250, unit: "g", category: "Dairy" },
  
  // Frozen
  { name: "Peas", quantity: 500, unit: "g", category: "Frozen" }
];