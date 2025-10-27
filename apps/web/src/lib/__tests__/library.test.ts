import { describe, it, expect } from 'vitest';
import { RecipeLibrary } from '../library';

describe('RecipeLibrary', () => {
  describe('getAll', () => {
    it('returns all recipes', () => {
      const recipes = RecipeLibrary.getAll();
      
      expect(Array.isArray(recipes)).toBe(true);
      expect(recipes.length).toBeGreaterThan(0);
    });

    it('returns recipes with required fields', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        expect(recipe.id).toBeDefined();
        expect(recipe.title).toBeDefined();
        expect(typeof recipe.id).toBe('string');
        expect(typeof recipe.title).toBe('string');
        expect(recipe.source).toBeDefined();
        expect(recipe.tags).toBeDefined();
        expect(recipe.ingredients).toBeDefined();
      });
    });
  });

  describe('getById', () => {
    it('returns recipe when found', () => {
      const allRecipes = RecipeLibrary.getAll();
      const firstRecipeId = allRecipes[0].id;
      
      const recipe = RecipeLibrary.getById(firstRecipeId);
      
      expect(recipe).toBeDefined();
      expect(recipe?.id).toBe(firstRecipeId);
    });

    it('returns undefined when not found', () => {
      const recipe = RecipeLibrary.getById('non-existent-id');
      
      expect(recipe).toBeUndefined();
    });

    it('is case sensitive', () => {
      const allRecipes = RecipeLibrary.getAll();
      const firstRecipeId = allRecipes[0].id;
      
      const recipe = RecipeLibrary.getById(firstRecipeId.toUpperCase());
      
      // Should not find if IDs are lowercase
      if (firstRecipeId === firstRecipeId.toLowerCase()) {
        expect(recipe).toBeUndefined();
      }
    });
  });

  describe('search', () => {
    it('returns all recipes for empty options', () => {
      const results = RecipeLibrary.search({});
      const allRecipes = RecipeLibrary.getAll();
      
      expect(results.length).toBe(allRecipes.length);
    });

    it('filters by chef', () => {
      const allRecipes = RecipeLibrary.getAll();
      const firstChef = allRecipes[0].source.chef;
      
      const results = RecipeLibrary.search({ chef: firstChef });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.source.chef === firstChef)).toBe(true);
    });

    it('filters by tags', () => {
      const allRecipes = RecipeLibrary.getAll();
      const recipeWithTags = allRecipes.find(r => r.tags && r.tags.length > 0);
      
      if (recipeWithTags && recipeWithTags.tags) {
        const firstTag = recipeWithTags.tags[0];
        const results = RecipeLibrary.search({ tags: [firstTag] });
        
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.tags.includes(firstTag))).toBe(true);
      }
    });

    it('filters by maxTime', () => {
      const maxTime = 30;
      const results = RecipeLibrary.search({ maxTime });
      
      results.forEach(recipe => {
        const time = recipe.timeMins || 30;
        expect(time).toBeLessThanOrEqual(maxTime);
      });
    });

    it('excludes specific IDs', () => {
      const allRecipes = RecipeLibrary.getAll();
      const firstTwoIds = allRecipes.slice(0, 2).map(r => r.id);
      
      const results = RecipeLibrary.search({ excludeIds: firstTwoIds });
      
      expect(results.every(r => !firstTwoIds.includes(r.id))).toBe(true);
    });

    it('limits results', () => {
      const limit = 5;
      const results = RecipeLibrary.search({ limit });
      
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('combines multiple filters', () => {
      const allRecipes = RecipeLibrary.getAll();
      const firstChef = allRecipes[0].source.chef;
      
      const results = RecipeLibrary.search({
        chef: firstChef,
        maxTime: 60,
        limit: 10
      });
      
      expect(results.length).toBeLessThanOrEqual(10);
      expect(results.every(r => r.source.chef === firstChef)).toBe(true);
      results.forEach(recipe => {
        const time = recipe.timeMins || 30;
        expect(time).toBeLessThanOrEqual(60);
      });
    });
  });

  describe('data integrity', () => {
    it('has unique recipe IDs', () => {
      const recipes = RecipeLibrary.getAll();
      const ids = recipes.map(r => r.id);
      const uniqueIds = new Set(ids);
      
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('has valid time estimates', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        if (recipe.timeMins !== undefined) {
          expect(recipe.timeMins).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('has valid servings', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        if (recipe.serves !== undefined) {
          expect(recipe.serves).toBeGreaterThan(0);
          expect(Number.isInteger(recipe.serves)).toBe(true);
        }
      });
    });

    it('has no empty titles', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        expect(recipe.title.trim().length).toBeGreaterThan(0);
      });
    });

    it('has valid URLs', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        expect(recipe.source.url).toMatch(/^https?:\/\/.+/);
      });
    });

    it('has valid tags arrays', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        expect(Array.isArray(recipe.tags)).toBe(true);
      });
    });

    it('has valid ingredients arrays', () => {
      const recipes = RecipeLibrary.getAll();
      
      recipes.forEach(recipe => {
        expect(Array.isArray(recipe.ingredients)).toBe(true);
        expect(recipe.ingredients.length).toBeGreaterThan(0);
      });
    });
  });
});
