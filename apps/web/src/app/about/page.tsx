"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Stack, Typography, Button, Box, Divider, Alert } from "@common-origin/design-system";
import Main from "@/components/app/Main";
import { track } from "@/lib/analytics";

export default function AboutPage() {
  useEffect(() => {
    track('page_view', { page: '/about' });
  }, []);

  return (
    <Main maxWidth="md">
      <Stack direction="column" gap="2xl">
        {/* Header */}
        <Stack direction="column" gap="xs">
          <Typography variant="h1">About Meal Agent</Typography>
          <Typography variant="h3" color="subdued">
            Your AI-powered weekly meal planning assistant
          </Typography>
        </Stack>

        {/* What is it? */}
        <Box border="subtle" borderRadius="4" p="xl" bg="default">
          <Stack direction="column" gap="lg">
            <Typography variant="h2">What is Meal Agent?</Typography>
            <Typography variant="body">
              Meal Agent is an intelligent meal planning system that helps busy families plan their weekly dinners, 
              generate smart shopping lists, and reduce food waste. It combines AI-powered recipe suggestions with 
              real-world grocery pricing to create practical, cost-effective meal plans.
            </Typography>
            <Typography variant="body">
              The app learns your preferences, dietary requirements, and cooking constraints to suggest recipes that 
              actually work for your family—not just what looks good in a cookbook.
            </Typography>
          </Stack>
        </Box>

        {/* Key Features */}
        <Box border="subtle" borderRadius="4" p="xl" bg="default">
          <Stack direction="column" gap="lg">
            <Typography variant="h2">Key Features</Typography>
            
            <Stack direction="column" gap="md">
              <Box>
                <Typography variant="h4">🤖 AI-Powered Meal Plans</Typography>
                <Typography variant="body" color="subdued">
                  Generate complete weekly meal plans using Google's Gemini AI, tailored to your family size, 
                  dietary preferences, and time constraints. The AI considers your cooking skill level, 
                  available time, and ingredient preferences.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🛒 Smart Shopping Lists</Typography>
                <Typography variant="body" color="subdued">
                  Automatically aggregates ingredients across all meals, deduplicates items, converts units, 
                  and tracks what you already have in your pantry. Get accurate pricing estimates based on 
                  real Coles supermarket data (179+ ingredients mapped).
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">👨‍🍳 Recipe Library</Typography>
                <Typography variant="body" color="subdued">
                  Access curated recipes from popular food creators (Nagi, Marion, Adam Liaw) with detailed 
                  instructions, ingredient lists, and nutritional information. Save your own recipes and 
                  AI-generated ones too.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">💰 Cost Optimization</Typography>
                <Typography variant="body" color="subdued">
                  See estimated costs for each meal and your entire week. The system prioritizes ingredient 
                  reuse to minimize waste and reduce your grocery bill. Track price confidence levels for 
                  better budgeting.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">⚡ Quick & Easy Filters</Typography>
                <Typography variant="body" color="subdued">
                  Filter by cooking time (quick 25-min meals), dietary requirements (vegetarian, gluten-free), 
                  kid-friendly options, bulk cooking for leftovers, and cuisine preferences (Thai, Italian, 
                  Mexican, and more).
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🔄 Flexible Planning</Typography>
                <Typography variant="body" color="subdued">
                  Don't like a suggestion? Swap any meal with AI-generated alternatives or your saved recipes. 
                  Add meals manually, delete days you're eating out, or regenerate suggestions with different 
                  constraints.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">☁️ Cloud Sync with Supabase</Typography>
                <Typography variant="body" color="subdued">
                  Your recipes, meal plans, and settings are automatically synced to Supabase 
                  for backup and cross-device access. Sign in with Google to get started.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* How to Use */}
        <Box border="subtle" borderRadius="4" p="xl" bg="default">
          <Stack direction="column" gap="lg">
            <Typography variant="h2">How to Use</Typography>
            
            <Stack direction="column" gap="md">
              <Box>
                <Typography variant="h4">Step 1: Configure Your Settings</Typography>
                <Typography variant="body" color="subdued">
                  Go to <strong>Settings</strong> and tell us about your family: number of adults and children, 
                  dietary preferences (gluten-free, vegetarian), cuisine preferences, and budget constraints. 
                  You can also set up your pantry inventory to exclude items you already have.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">Step 2: Generate Your Meal Plan</Typography>
                <Typography variant="body" color="subdued">
                  Click <strong>"Plan your week"</strong> from the home page. The wizard will ask about this 
                  week's pantry items and preferred cuisines, then generate a complete 7-day meal plan optimized 
                  for variety, nutrition, and cost.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">Step 3: Review & Customize</Typography>
                <Typography variant="body" color="subdued">
                  Review your plan on the <strong>Plan</strong> page. Click any meal card to see the full recipe. 
                  Use the swap icon to get AI-suggested alternatives or select from your saved recipes. Delete 
                  meals for days you're eating out.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">Step 4: Get Your Shopping List</Typography>
                <Typography variant="body" color="subdued">
                  Go to <strong>Shopping List</strong> to see all ingredients aggregated and deduplicated. 
                  Items are organized by supermarket aisle with estimated prices. Export to CSV or shop 
                  directly at Coles online.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">Step 5: Cook & Enjoy!</Typography>
                <Typography variant="body" color="subdued">
                  Click any recipe to see detailed cooking instructions with step-by-step directions. 
                  Mark favorites to see them suggested more often in future plans.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* POC Status & Future Extensions */}
        <Box border="subtle" borderRadius="4" p="xl" bg="surface">
          <Stack direction="column" gap="lg">
            <Typography variant="h2">Proof of Concept Status</Typography>
            
            <Alert variant="info" inline>
              This is a proof-of-concept demonstrating the potential of AI-powered meal planning. 
              Several features use hardcoded data or simplified implementations that could be 
              significantly enhanced with production APIs and services.
            </Alert>

            <Stack direction="column" gap="md">
              <Box>
                <Typography variant="h4">🏷️ Current: Hardcoded Price Database</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> 179 manually-entered Coles products with verified prices<br/>
                  <strong>Future:</strong> Real-time pricing via Coles API, automatic price updates, 
                  support for multiple supermarkets (Woolworths, IGA, Aldi), price comparison across stores, 
                  and personalized recommendations based on your purchase history.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">📦 Current: Simple Pantry Management</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Manual pantry inventory entry per week<br/>
                  <strong>Future:</strong> Smart pantry tracking with expiry date alerts, barcode scanning 
                  for quick entry, automatic depletion based on meal plans, inventory sync across devices, 
                  and AI suggestions for using up ingredients before they expire.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🍳 Current: Curated Recipe Library</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> ~50 manually curated recipes from popular creators<br/>
                  <strong>Future:</strong> Integration with recipe APIs (Spoonacular, Edamam, Recipe Puppy), 
                  web scraping from popular cooking sites, community recipe submissions with ratings, 
                  nutritional analysis APIs, and automatic recipe extraction from any URL.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🤖 Current: Basic AI Generation</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Gemini AI generates recipes with retry logic<br/>
                  <strong>Future:</strong> Fine-tuned models on food domain data, personalized suggestions 
                  based on your cooking history and ratings, seasonal ingredient awareness, multi-week planning 
                  with variety optimization, and meal prep suggestions for batch cooking.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🛒 Current: Manual Shopping Export</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> CSV export and manual Coles website shopping<br/>
                  <strong>Future:</strong> Direct integration with Coles/Woolworths cart APIs, one-click 
                  add-to-cart functionality, scheduled delivery booking, automatic reordering of staples, 
                  and price alert notifications when ingredients go on sale.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">📊 Current: Basic Analytics</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Simple event tracking with Hotjar<br/>
                  <strong>Future:</strong> Detailed nutritional analytics, cost trends over time, waste 
                  tracking (ingredients bought but not used), cooking time vs. actual time analysis, 
                  recipe success ratings, and personalized insights on your eating patterns.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">👥 Multi-User Support</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Supabase authentication with Google OAuth<br/>
                  <strong>Future:</strong> Multi-user accounts with authentication, family sharing 
                  (assign cooking duties), meal plan collaboration, shopping list delegation, 
                  shared recipe collections, and social features to share plans with friends.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🔔 Current: No Notifications</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Manual check-ins required<br/>
                  <strong>Future:</strong> Push notifications for meal prep reminders, grocery delivery 
                  confirmations, recipe suggestions based on pantry contents, expiring ingredient alerts, 
                  and weekly planning prompts.
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">🌍 Current: Australia/Coles Only</Typography>
                <Typography variant="body" color="subdued">
                  <strong>Now:</strong> Coles pricing in AUD<br/>
                  <strong>Future:</strong> Multi-country support with local supermarkets (US: Walmart/Target, 
                  UK: Tesco/Sainsbury's, etc.), currency conversion, regional cuisine preferences, 
                  and localized recipe suggestions.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Technical Details */}
        <Box border="subtle" borderRadius="4" p="xl" bg="default">
          <Stack direction="column" gap="lg">
            <Typography variant="h2">Technical Details</Typography>
            
            <Stack direction="column" gap="md">
              <Box>
                <Typography variant="h4">Technology Stack</Typography>
                <Typography variant="body" color="subdued">
                  • <strong>Framework:</strong> Next.js 16 (React 19, App Router)<br/>
                  • <strong>UI:</strong> Custom design system with styled-components<br/>
                  • <strong>AI:</strong> Google Gemini 2.5 Flash via API<br/>
                  • <strong>Database:</strong> Supabase PostgreSQL with row-level security<br/>
                  • <strong>Authentication:</strong> Supabase Auth (Google OAuth + Magic Link)<br/>
                  • <strong>Pricing Data:</strong> Manually curated Coles product database (179 items)<br/>
                  • <strong>Analytics:</strong> Hotjar for user behavior tracking
                </Typography>
              </Box>

              <Box>
                <Typography variant="h4">Data Privacy</Typography>
                <Typography variant="body" color="subdued">
                  Your data is securely stored in Supabase with row-level security, ensuring household 
                  isolation. Only you and your household members can access your data. AI recipe generation 
                  uses the Gemini API. You have full control over your data and can delete it at any time.
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Call to Action */}
        <Box border="subtle" borderRadius="4" p="xl" bg="emphasis">
          <Stack direction="column" gap="lg" alignItems="center">
            <Typography variant="h2" color="inverse">Ready to get started?</Typography>
            <Typography variant="body" color="inverse">
              Set up your family preferences and generate your first AI-powered meal plan in minutes.
            </Typography>
            <Stack direction="row" gap="md">
              <Link href="/settings" style={{ textDecoration: 'none' }}>
                <Button variant="secondary" size="large">
                  Configure Settings
                </Button>
              </Link>
              <Link href="/plan" style={{ textDecoration: 'none' }}>
                <Button variant="primary" size="large">
                  Plan Your Week
                </Button>
              </Link>
            </Stack>
          </Stack>
        </Box>

        {/* Footer Links */}
        <Box pb="2xl">
          <Stack direction="row" gap="lg" justifyContent="center">
            <Link href="/recipes" style={{ textDecoration: 'none' }}>
              <Typography variant="body" color="subdued">Browse Recipes</Typography>
            </Link>
            <Typography variant="body" color="subdued">•</Typography>
            <Link href="/shopping-list" style={{ textDecoration: 'none' }}>
              <Typography variant="body" color="subdued">Shopping List</Typography>
            </Link>
            <Typography variant="body" color="subdued">•</Typography>
            <Link href="/settings" style={{ textDecoration: 'none' }}>
              <Typography variant="body" color="subdued">Settings</Typography>
            </Link>
            <Typography variant="body" color="subdued">•</Typography>
            <Link href="/analytics" style={{ textDecoration: 'none' }}>
              <Typography variant="body" color="subdued">Analytics</Typography>
            </Link>
          </Stack>
        </Box>
      </Stack>
    </Main>
  );
}
