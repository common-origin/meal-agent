import { Storage } from "../../storage";
import { CUSTOM_RECIPES_KEY } from "../../library";
import { testRecipes } from "./recipes";

/**
 * Seeds localStorage with the fixture recipes so RecipeLibrary (which has
 * no built-in seed data — see issue #5) has something to return. Must run
 * before the first RecipeLibrary call in a test file, since RecipeLibrary
 * caches whatever it loads first for the lifetime of the module.
 */
export function seedRecipeLibrary(): void {
  Storage.set(CUSTOM_RECIPES_KEY, testRecipes);
}
