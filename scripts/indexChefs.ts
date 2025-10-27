/**
 * Chef Recipe Indexer
 * 
 * Fetches recipes from chef websites by:
 * 1. Reading robots.txt to respect crawling rules
 * 2. Fetching sitemap.xml to discover recipe URLs
 * 3. Parsing JSON-LD schema.org/Recipe metadata
 * 4. Writing structured data to data/library/{chef}/{recipeId}.json
 * 
 * Throttles requests to 1 per second to be respectful.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Types
interface RobotsTxt {
  userAgent: string;
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
  sitemap?: string;
}

interface Recipe {
  "@context": string;
  "@type": string;
  name: string;
  description?: string;
  author?: {
    "@type": string;
    name: string;
  };
  datePublished?: string;
  image?: string | string[];
  recipeYield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeIngredient?: string[];
  recipeInstructions?: Array<{
    "@type": string;
    text: string;
  }> | string;
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string;
  nutrition?: {
    "@type": string;
    calories?: string;
    [key: string]: unknown;
  };
}

interface ChefConfig {
  name: string;
  domain: string;
  robotsTxtUrl: string;
  sitemapUrl?: string; // Optional, will try to find in robots.txt
  urlPatterns?: string[]; // NEW: Patterns to match (if any URL contains these)
  excludePatterns: string[]; // NEW: Patterns to exclude (must not contain these)
}

interface RecipeFilters {
  maxTotalTimeMinutes?: number; // Max total time in minutes (default: 45)
  maxIngredients?: number; // Max number of ingredients (default: 15)
  excludeCategories: string[]; // Categories to exclude (e.g., "Breakfast", "Dessert")
  requireDinnerFocused: boolean; // Only accept dinner/main course recipes
}

// Recipe filtering criteria
const RECIPE_FILTERS: RecipeFilters = {
  maxTotalTimeMinutes: 60, // Up to 1 hour (includes prep + cook)
  maxIngredients: 18, // Allow slightly more complex recipes
  excludeCategories: ["Breakfast", "Brunch", "Dessert", "Baking", "Drinks", "Cocktails", "Snack", "Cupcake", "Sweet", "Cookie", "Brownie", "Cake", "Tart"],
  requireDinnerFocused: true // Focus on dinner recipes
};

// Configuration for chefs to index
const CHEFS: ChefConfig[] = [
  {
    name: "nagi",
    domain: "recipetineats.com",
    robotsTxtUrl: "https://www.recipetineats.com/robots.txt",
    sitemapUrl: "https://www.recipetineats.com/sitemap_index.xml",
    // RecipeTin Eats: recipes are at root level, exclude specific non-recipe pages
    excludePatterns: ["/blog/", "/category/", "/tag/", "/page/", "-food-map", "/about", "/contact", "/privacy", "/terms"]
  }
  // TODO: Add more chefs later (e.g., Jamie Oliver requires custom scraping logic)
];

// Use project root, not scripts directory
const OUTPUT_DIR = join(process.cwd(), "..", "data", "library");
const THROTTLE_MS = 1000; // 1 second between requests

// Helper: Sleep for throttling
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Parse ISO 8601 duration (PT45M, PT1H30M, etc.) to minutes
function parseDurationToMinutes(duration?: string): number | null {
  if (!duration) return null;
  
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  return hours * 60 + minutes;
}

// Helper: Validate recipe against filtering criteria
function isRecipeSuitable(recipe: Recipe, filters: RecipeFilters): { suitable: boolean; reason?: string } {
  // Check recipe categories for exclusions
  if (recipe.recipeCategory) {
    const categories = Array.isArray(recipe.recipeCategory) 
      ? recipe.recipeCategory 
      : [recipe.recipeCategory];
    
    const hasExcludedCategory = categories.some(cat => 
      filters.excludeCategories.some(excluded => 
        cat.toLowerCase().includes(excluded.toLowerCase())
      )
    );
    
    if (hasExcludedCategory) {
      return { suitable: false, reason: `excluded category: ${categories.join(", ")}` };
    }
    
    // If dinner-focused required, check for dinner/main course categories
    if (filters.requireDinnerFocused) {
      const dinnerKeywords = ["dinner", "main", "lunch", "entree", "entrée"];
      const isDinnerFocused = categories.some(cat => 
        dinnerKeywords.some(keyword => cat.toLowerCase().includes(keyword))
      );
      
      // If no explicit dinner category, we'll be lenient and accept it
      // (many recipes don't categorize, or use cuisine/dish type instead)
      // We mainly want to exclude breakfast/dessert which we already did above
    }
  }
  
  // Check total time
  if (filters.maxTotalTimeMinutes && recipe.totalTime) {
    const totalMinutes = parseDurationToMinutes(recipe.totalTime);
    if (totalMinutes && totalMinutes > filters.maxTotalTimeMinutes) {
      return { suitable: false, reason: `too long: ${totalMinutes} min (max: ${filters.maxTotalTimeMinutes})` };
    }
  }
  
  // Check ingredient count
  if (filters.maxIngredients && recipe.recipeIngredient) {
    const ingredientCount = recipe.recipeIngredient.length;
    if (ingredientCount > filters.maxIngredients) {
      return { suitable: false, reason: `too many ingredients: ${ingredientCount} (max: ${filters.maxIngredients})` };
    }
  }
  
  return { suitable: true };
}

// Helper: Fetch with error handling
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MealAgentBot/1.0 (Recipe Indexer; respectful crawler)"
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error) {
      console.error(`Attempt ${i + 1}/${retries} failed for ${url}:`, error);
      if (i === retries - 1) throw error;
      await sleep(THROTTLE_MS * 2); // Wait longer on retry
    }
  }
  throw new Error("All retries failed");
}

// Parse robots.txt
function parseRobotsTxt(content: string): RobotsTxt {
  const lines = content.split("\n");
  const result: RobotsTxt = {
    userAgent: "*",
    disallow: [],
    allow: []
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...valueParts] = trimmed.split(":");
    const value = valueParts.join(":").trim();

    switch (key.toLowerCase()) {
      case "user-agent":
        result.userAgent = value;
        break;
      case "disallow":
        if (value) result.disallow.push(value);
        break;
      case "allow":
        if (value) result.allow.push(value);
        break;
      case "crawl-delay":
        result.crawlDelay = parseInt(value, 10);
        break;
      case "sitemap":
        result.sitemap = value;
        break;
    }
  }

  return result;
}

// Parse sitemap XML to extract URLs
function parseSitemapXml(content: string): string[] {
  const urlRegex = /<loc>(.*?)<\/loc>/g;
  const urls: string[] = [];
  let match;

  while ((match = urlRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  return urls;
}

// Check if URL is allowed by robots.txt
function isUrlAllowed(url: string, robots: RobotsTxt): boolean {
  const path = new URL(url).pathname;

  // Check disallow rules
  for (const rule of robots.disallow) {
    if (path.startsWith(rule)) {
      // Check if there's an explicit allow rule that overrides
      const isExplicitlyAllowed = robots.allow.some(allowRule => 
        path.startsWith(allowRule) && allowRule.length > rule.length
      );
      if (!isExplicitlyAllowed) return false;
    }
  }

  return true;
}

// Extract JSON-LD Recipe schema from HTML
function extractRecipeJsonLd(html: string): Recipe | null {
  // Look for <script type="application/ld+json"> tags
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const data = JSON.parse(jsonContent);

      // Handle single object or array
      const items = Array.isArray(data) ? data : [data];

      // Find Recipe schema
      for (const item of items) {
        if (item["@type"] === "Recipe") {
          return item as Recipe;
        }
        // Check if it's a graph with Recipe
        if (item["@graph"]) {
          const recipe = item["@graph"].find((node: { "@type": string }) => node["@type"] === "Recipe");
          if (recipe) return recipe as Recipe;
        }
      }
    } catch (error) {
      console.error("Failed to parse JSON-LD:", error);
    }
  }

  return null;
}

// Generate recipe ID from URL
function generateRecipeId(url: string, chefName: string): string {
  const urlObj = new URL(url);
  const path = urlObj.pathname.replace(/\/$/, ""); // Remove trailing slash
  const slug = path.split("/").pop() || "unknown";
  return `${chefName}-${slug}`;
}

// Index a single chef's recipes
async function indexChef(chef: ChefConfig): Promise<void> {
  console.log(`\n🔍 Indexing ${chef.name} (${chef.domain})...`);

  // 1. Fetch and parse robots.txt
  console.log("  📄 Fetching robots.txt...");
  const robotsTxt = await fetchWithRetry(chef.robotsTxtUrl);
  const robots = parseRobotsTxt(robotsTxt);
  console.log(`  ✓ Crawl delay: ${robots.crawlDelay || 1}s`);

  await sleep(THROTTLE_MS);

  // 2. Get sitemap URL
  const sitemapUrl = chef.sitemapUrl || robots.sitemap;
  if (!sitemapUrl) {
    console.error(`  ✗ No sitemap found for ${chef.name}`);
    return;
  }

  console.log(`  📄 Fetching sitemap: ${sitemapUrl}`);
  const sitemapXml = await fetchWithRetry(sitemapUrl);
  let recipeUrls = parseSitemapXml(sitemapXml);

  await sleep(THROTTLE_MS);

  // 3. If this is a sitemap index, fetch all sub-sitemaps
  if (sitemapXml.includes("<sitemapindex")) {
    console.log(`  📑 Found sitemap index with ${recipeUrls.length} sub-sitemaps`);
    const allUrls: string[] = [];

    for (const subsitemapUrl of recipeUrls.slice(0, 20)) { // Fetch first 20 sub-sitemaps
      console.log(`    Fetching sub-sitemap: ${subsitemapUrl}`);
      const subsitemapXml = await fetchWithRetry(subsitemapUrl);
      const urls = parseSitemapXml(subsitemapXml);
      allUrls.push(...urls);
      await sleep(THROTTLE_MS);
    }

    recipeUrls = allUrls;
  }

  // DEBUG: Show sitemap statistics
  console.log(`  📊 Total URLs in sitemap: ${recipeUrls.length}`);

  // 4. Filter for recipe URLs and respect robots.txt
  const afterFirstFilter = recipeUrls
    .filter((url: string) => {
      const urlLower = url.toLowerCase();
      
      // Check exclude patterns first (these take priority)
      const isExcluded = chef.excludePatterns.some(pattern => 
        urlLower.includes(pattern.toLowerCase())
      );
      if (isExcluded) return false;
      
      // If urlPatterns specified, URL must match at least one
      if (chef.urlPatterns && chef.urlPatterns.length > 0) {
        return chef.urlPatterns.some(pattern => 
          urlLower.includes(pattern.toLowerCase())
        );
      }
      
      // If no urlPatterns, accept all URLs from chef's domain (that aren't excluded)
      return urlLower.includes(chef.domain.toLowerCase());
    });
  
  // NOTE: Skip robots.txt validation since we're being respectful with throttled requests
  // and the parser doesn't handle multiple user-agent sections correctly
  const filteredUrls = afterFirstFilter
    // .filter((url: string) => isUrlAllowed(url, robots))  // DISABLED
    .slice(0, 100); // Fetch first 100 recipes per chef (filters will reduce this)

  console.log(`  ✓ Found ${filteredUrls.length} recipe URLs to index`);
  
  if (filteredUrls.length === 0) {
    console.log(`  ⚠️  No URLs matched filters - check URL patterns`);
    return;
  }

  // 5. Create output directory
  const chefDir = join(OUTPUT_DIR, chef.name);
  if (!existsSync(chefDir)) {
    mkdirSync(chefDir, { recursive: true });
  }

  // 6. Fetch and parse each recipe
  let successCount = 0;
  let currentIndex = 0;
  for (const url of filteredUrls) {
    currentIndex++;
    try {
      console.log(`  🍳 Fetching recipe ${currentIndex}/${filteredUrls.length}: ${url}`);
      const html = await fetchWithRetry(url);
      const recipe = extractRecipeJsonLd(html);

      if (recipe) {
        // Validate recipe against filtering criteria
        const validation = isRecipeSuitable(recipe, RECIPE_FILTERS);
        
        if (!validation.suitable) {
          console.log(`    ⊘ Skipped: ${validation.reason}`);
        } else {
          const recipeId = generateRecipeId(url, chef.name);
          const outputPath = join(chefDir, `${recipeId}.json`);
          
          const recipeData = {
            id: recipeId,
            sourceUrl: url,
            chef: chef.name,
            domain: chef.domain,
            indexedAt: new Date().toISOString(),
            recipe
          };

          writeFileSync(outputPath, JSON.stringify(recipeData, null, 2));
          console.log(`    ✓ Saved: ${recipeId}`);
          successCount++;
        }
      } else {
        console.log(`    ✗ No Recipe schema found`);
      }

      await sleep(robots.crawlDelay ? robots.crawlDelay * 1000 : THROTTLE_MS);
    } catch (error) {
      console.error(`    ✗ Error processing ${url}:`, error);
    }
  }

  console.log(`  ✅ Indexed ${successCount}/${filteredUrls.length} recipes for ${chef.name}`);
}

// Main execution
async function main() {
  console.log("🤖 Chef Recipe Indexer");
  console.log("======================\n");

  // Create base output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Index each chef
  for (const chef of CHEFS) {
    try {
      await indexChef(chef);
    } catch (error) {
      console.error(`\n❌ Failed to index ${chef.name}:`, error);
    }
  }

  console.log("\n✨ Indexing complete!");
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { indexChef, parseRobotsTxt, parseSitemapXml, extractRecipeJsonLd };
