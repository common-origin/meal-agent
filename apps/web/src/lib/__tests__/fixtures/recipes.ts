import type { Recipe } from "../../types/recipe";

/**
 * Deterministic recipe set for tests. RecipeLibrary has no built-in seed
 * data of its own (see issue #5) — it only ever reflects whatever a user
 * has added or generated, which lives in localStorage/Supabase. These
 * fixtures stand in for that user data so library/compose tests have
 * something to search and rank.
 */
export const testRecipes: Recipe[] = [
  {
    id: "fixture-chicken-stirfry",
    title: "Chicken Stir Fry",
    source: {
      url: "https://example.com/recipes/chicken-stir-fry",
      domain: "example.com",
      chef: "Jamie Oliver",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 25,
    tags: ["kid_friendly", "chicken", "quick"],
    serves: 4,
    costPerServeEst: 3.5,
    ingredients: [
      { name: "chicken breast", qty: 500, unit: "g" },
      { name: "soy sauce", qty: 30, unit: "ml" },
      { name: "mixed vegetables", qty: 300, unit: "g" },
    ],
  },
  {
    id: "fixture-beef-tacos",
    title: "Beef Tacos",
    source: {
      url: "https://example.com/recipes/beef-tacos",
      domain: "example.com",
      chef: "Jamie Oliver",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 30,
    tags: ["kid_friendly", "beef"],
    serves: 4,
    costPerServeEst: 4.2,
    ingredients: [
      { name: "beef mince", qty: 400, unit: "g" },
      { name: "taco shells", qty: 8, unit: "unit" },
      { name: "cheddar cheese", qty: 100, unit: "g" },
    ],
  },
  {
    id: "fixture-veggie-pasta",
    title: "Veggie Pasta Bake",
    source: {
      url: "https://example.com/recipes/veggie-pasta",
      domain: "example.com",
      chef: "Nigella Lawson",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 35,
    tags: ["kid_friendly", "vegetarian", "bulk_cook"],
    serves: 4,
    costPerServeEst: 2.8,
    ingredients: [
      { name: "pasta", qty: 400, unit: "g" },
      { name: "tomato sauce", qty: 500, unit: "ml" },
      { name: "mozzarella", qty: 200, unit: "g" },
    ],
  },
  {
    id: "fixture-fish-traybake",
    title: "Fish Tray Bake",
    source: {
      url: "https://example.com/recipes/fish-traybake",
      domain: "example.com",
      chef: "Nigella Lawson",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 30,
    tags: ["kid_friendly", "fish"],
    serves: 4,
    costPerServeEst: 5.1,
    ingredients: [
      { name: "white fish fillets", qty: 500, unit: "g" },
      { name: "potatoes", qty: 600, unit: "g" },
      { name: "lemon", qty: 1, unit: "unit" },
    ],
  },
  {
    id: "fixture-pork-noodles",
    title: "Pork Noodles",
    source: {
      url: "https://example.com/recipes/pork-noodles",
      domain: "example.com",
      chef: "Ainsley Harriott",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 20,
    tags: ["kid_friendly", "pork"],
    serves: 4,
    costPerServeEst: 3.9,
    ingredients: [
      { name: "pork mince", qty: 400, unit: "g" },
      { name: "egg noodles", qty: 300, unit: "g" },
      { name: "spring onion", qty: 3, unit: "unit" },
    ],
  },
  {
    id: "fixture-lamb-curry",
    title: "Lamb Curry",
    source: {
      url: "https://example.com/recipes/lamb-curry",
      domain: "example.com",
      chef: "Ainsley Harriott",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 40,
    tags: ["kid_friendly", "lamb", "high_protein"],
    serves: 4,
    costPerServeEst: 6.0,
    ingredients: [
      { name: "lamb shoulder", qty: 600, unit: "g" },
      { name: "curry paste", qty: 60, unit: "g" },
      { name: "coconut milk", qty: 400, unit: "ml" },
    ],
  },
  {
    id: "fixture-sausage-bake",
    title: "Sausage Traybake",
    source: {
      url: "https://example.com/recipes/sausage-bake",
      domain: "example.com",
      chef: "AI Generated",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 30,
    tags: ["kid_friendly", "pork", "organic_ok"],
    serves: 4,
    costPerServeEst: 3.2,
    ingredients: [
      { name: "pork sausages", qty: 8, unit: "unit" },
      { name: "sweet potato", qty: 500, unit: "g" },
      { name: "red onion", qty: 2, unit: "unit" },
    ],
  },
  {
    id: "fixture-salmon-salad",
    title: "Salmon Salad",
    source: {
      url: "https://example.com/recipes/salmon-salad",
      domain: "example.com",
      chef: "AI Generated",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 25,
    tags: ["kid_friendly", "fish", "high_protein"],
    serves: 4,
    costPerServeEst: 7.4,
    ingredients: [
      { name: "salmon fillets", qty: 500, unit: "g" },
      { name: "mixed leaves", qty: 150, unit: "g" },
      { name: "cherry tomatoes", qty: 200, unit: "g" },
    ],
  },
  {
    id: "fixture-vegetarian-curry",
    title: "Vegetarian Curry",
    source: {
      url: "https://example.com/recipes/vegetarian-curry",
      domain: "example.com",
      chef: "Nigella Lawson",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    timeMins: 35,
    tags: ["kid_friendly", "vegetarian"],
    serves: 4,
    costPerServeEst: 3.0,
    ingredients: [
      { name: "chickpeas", qty: 400, unit: "g" },
      { name: "curry paste", qty: 60, unit: "g" },
      { name: "coconut milk", qty: 400, unit: "ml" },
    ],
  },
  {
    id: "fixture-weekend-roast",
    title: "Weekend Beef Roast",
    source: {
      url: "https://example.com/recipes/weekend-roast",
      domain: "example.com",
      chef: "Jamie Oliver",
      license: "permitted",
      fetchedAt: "2026-01-01T00:00:00.000Z",
    },
    // Deliberately over the weeknight time limit and not kid_friendly —
    // a weekend-only option so tests exercise recipes that get hard-filtered
    // on weeknights rather than every fixture being weeknight-eligible.
    timeMins: 75,
    tags: ["beef"],
    serves: 6,
    costPerServeEst: 8.0,
    ingredients: [
      { name: "beef roast", qty: 1500, unit: "g" },
      { name: "roast potatoes", qty: 800, unit: "g" },
      { name: "gravy", qty: 300, unit: "ml" },
    ],
  },
];
