import { NextResponse } from "next/server";
import { RecipeLibrary } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Debug endpoint to view custom recipes in library
 * GET /api/debug/custom-recipes
 */
export async function GET() {
  try {
    const customRecipes = RecipeLibrary.getCustomRecipes();
    const allRecipes = RecipeLibrary.getAll();
    const builtInCount = allRecipes.length - customRecipes.length;
    
    return NextResponse.json({
      success: true,
      counts: {
        custom: customRecipes.length,
        builtIn: builtInCount,
        total: allRecipes.length,
      },
      customRecipes: customRecipes.map(r => ({
        id: r.id,
        title: r.title,
        chef: r.source.chef,
        cuisine: r.tags.find(t => ["mexican", "italian", "asian", "indian"].includes(t)),
        timeMins: r.timeMins,
        serves: r.serves,
        costPerServe: r.costPerServeEst,
      })),
    });
  } catch (error) {
    console.error("Error fetching custom recipes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch custom recipes",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
