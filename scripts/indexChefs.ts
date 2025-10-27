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
}

// Configuration for chefs to index
const CHEFS: ChefConfig[] = [
  {
    name: "nagi",
    domain: "recipetineats.com",
    robotsTxtUrl: "https://www.recipetineats.com/robots.txt",
    sitemapUrl: "https://www.recipetineats.com/sitemap_index.xml"
  },
  {
    name: "adam-ragusea",
    domain: "adamragusea.com",
    robotsTxtUrl: "https://www.adamragusea.com/robots.txt"
  }
];

const OUTPUT_DIR = join(process.cwd(), "data", "library");
const THROTTLE_MS = 1000; // 1 second between requests

// Helper: Sleep for throttling
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    for (const subsitemapUrl of recipeUrls.slice(0, 3)) { // Limit to first 3 for demo
      console.log(`    Fetching sub-sitemap: ${subsitemapUrl}`);
      const subsitemapXml = await fetchWithRetry(subsitemapUrl);
      const urls = parseSitemapXml(subsitemapXml);
      allUrls.push(...urls);
      await sleep(THROTTLE_MS);
    }

    recipeUrls = allUrls;
  }

  // 4. Filter for recipe URLs and respect robots.txt
  const filteredUrls = recipeUrls
    .filter(url => {
      const urlLower = url.toLowerCase();
      // Check if URL contains recipe-related keywords
      return (
        urlLower.includes("/recipe") ||
        urlLower.includes("/recipes") ||
        urlLower.includes(chef.domain) // Include all URLs from the chef's domain
      );
    })
    .filter(url => isUrlAllowed(url, robots))
    .slice(0, 5); // Limit to 5 recipes for demo

  console.log(`  ✓ Found ${filteredUrls.length} recipe URLs to index`);

  // 5. Create output directory
  const chefDir = join(OUTPUT_DIR, chef.name);
  if (!existsSync(chefDir)) {
    mkdirSync(chefDir, { recursive: true });
  }

  // 6. Fetch and parse each recipe
  let successCount = 0;
  for (const url of filteredUrls) {
    try {
      console.log(`  🍳 Fetching recipe: ${url}`);
      const html = await fetchWithRetry(url);
      const recipe = extractRecipeJsonLd(html);

      if (recipe) {
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
