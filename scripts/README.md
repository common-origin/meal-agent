# Chef Recipe Indexer

Fetches recipes from chef websites by parsing sitemaps and extracting JSON-LD schema.org/Recipe data.

## Usage

```bash
# From project root
pnpm index-chefs

# Or directly from scripts directory
cd scripts
pnpm index-chefs
```

## How It Works

1. **Fetches `robots.txt`** - Respects crawling rules and discovers sitemap URLs
2. **Parses sitemap XML** - Extracts all recipe URLs
3. **Scrapes recipe pages** - Extracts JSON-LD structured data
4. **Saves to JSON files** - Writes to `data/library/{chef}/{recipeId}.json`

## Features

- ✅ Respects `robots.txt` crawl delay and disallow rules
- ✅ Throttles requests to 1 per second (configurable via robots.txt)
- ✅ Extracts schema.org/Recipe JSON-LD metadata
- ✅ Handles sitemap indexes (nested sitemaps)
- ✅ Retry logic for failed requests
- ✅ Configurable chef list

## Configuration

Add chefs to the `CHEFS` array in `indexChefs.ts`:

\`\`\`typescript
const CHEFS: ChefConfig[] = [
  {
    name: "chef-slug",
    domain: "example.com",
    robotsTxtUrl: "https://example.com/robots.txt",
    sitemapUrl: "https://example.com/sitemap.xml" // Optional
  }
];
\`\`\`

## Output Structure

\`\`\`json
{
  "id": "nagi-butter-chicken",
  "sourceUrl": "https://www.recipetineats.com/butter-chicken/",
  "chef": "nagi",
  "domain": "recipetineats.com",
  "indexedAt": "2025-10-27T12:00:00.000Z",
  "recipe": {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": "Butter Chicken",
    "description": "...",
    "recipeIngredient": [...],
    "recipeInstructions": [...]
  }
}
\`\`\`

## Limitations

- **Demo mode**: Limited to 5 recipes per chef and 3 sub-sitemaps
- **No authentication**: Won't work for sites requiring login
- **JSON-LD only**: Doesn't parse microdata or RDFa formats
- **Simple URL filtering**: Looks for `/recipe` or `/recipes` in URL path

## Extending

To process more recipes, modify these constants in `indexChefs.ts`:

\`\`\`typescript
.slice(0, 5); // Limit to 5 recipes for demo
.slice(0, 3); // Limit to first 3 sub-sitemaps for demo
\`\`\`
