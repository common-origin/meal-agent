import { describe, it, expect } from 'vitest';

// Import the functions we want to test
// Since buildRecipeLibrary.ts is a script, we'll need to extract testable functions
// For now, we'll test the key parsing logic

describe('buildRecipeLibrary parsing', () => {
  describe('duration parsing', () => {
    // ISO 8601 duration parsing logic
    const parseDuration = (duration: string | undefined): number | undefined => {
      if (!duration) return undefined;
      
      // PT1H30M -> 90 minutes
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
      if (!match) return undefined;
      
      const hours = parseInt(match[1] || '0');
      const minutes = parseInt(match[2] || '0');
      
      return hours * 60 + minutes;
    };

    it('parses hours and minutes correctly', () => {
      expect(parseDuration('PT1H30M')).toBe(90);
      expect(parseDuration('PT2H15M')).toBe(135);
    });

    it('parses minutes only', () => {
      expect(parseDuration('PT45M')).toBe(45);
      expect(parseDuration('PT15M')).toBe(15);
    });

    it('parses hours only', () => {
      expect(parseDuration('PT1H')).toBe(60);
      expect(parseDuration('PT2H')).toBe(120);
    });

    it('handles undefined duration', () => {
      expect(parseDuration(undefined)).toBeUndefined();
    });

    it('handles invalid format', () => {
      expect(parseDuration('invalid')).toBeUndefined();
      expect(parseDuration('45 minutes')).toBeUndefined();
    });

    it('handles edge case: PT0M', () => {
      expect(parseDuration('PT0M')).toBe(0);
    });
  });

  describe('servings parsing', () => {
    // recipeYield can be string, number, or array
    const parseServings = (recipeYield: string | number | string[] | undefined): number => {
      if (!recipeYield) return 4; // default
      
      if (typeof recipeYield === 'number') return recipeYield;
      if (typeof recipeYield === 'string') {
        const num = parseInt(recipeYield);
        return isNaN(num) ? 4 : num;
      }
      if (Array.isArray(recipeYield) && recipeYield.length > 0) {
        const num = parseInt(recipeYield[0]);
        return isNaN(num) ? 4 : num;
      }
      
      return 4;
    };

    it('handles number input', () => {
      expect(parseServings(4)).toBe(4);
      expect(parseServings(6)).toBe(6);
    });

    it('handles string input', () => {
      expect(parseServings('4')).toBe(4);
      expect(parseServings('6 servings')).toBe(6);
    });

    it('handles array input', () => {
      expect(parseServings(['4'])).toBe(4);
      expect(parseServings(['6 servings'])).toBe(6);
    });

    it('returns default for invalid input', () => {
      expect(parseServings(undefined)).toBe(4);
      expect(parseServings('invalid')).toBe(4);
      expect(parseServings([])).toBe(4);
    });

    it('uses first element of array', () => {
      expect(parseServings(['4', '8'])).toBe(4);
    });
  });

  describe('tag extraction', () => {
    // Extract tags from recipe keywords
    const extractTags = (keywords: string | string[] | undefined): string[] => {
      if (!keywords) return [];
      
      const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
      
      return keywordArray
        .map(k => k.toLowerCase().trim())
        .filter(k => k.length > 0);
    };

    it('handles string input', () => {
      expect(extractTags('vegetarian')).toEqual(['vegetarian']);
    });

    it('handles array input', () => {
      expect(extractTags(['vegetarian', 'quick', 'easy'])).toEqual(['vegetarian', 'quick', 'easy']);
    });

    it('normalizes case', () => {
      expect(extractTags(['VEGETARIAN', 'Quick'])).toEqual(['vegetarian', 'quick']);
    });

    it('trims whitespace', () => {
      expect(extractTags([' vegetarian ', '  quick  '])).toEqual(['vegetarian', 'quick']);
    });

    it('filters empty strings', () => {
      expect(extractTags(['vegetarian', '', '  ', 'quick'])).toEqual(['vegetarian', 'quick']);
    });

    it('handles undefined', () => {
      expect(extractTags(undefined)).toEqual([]);
    });
  });

  describe('protein extraction', () => {
    // Extract primary protein from recipe name or ingredients
    const extractProtein = (name: string, keywords: string[] = []): string | undefined => {
      const text = (name + ' ' + keywords.join(' ')).toLowerCase();
      
      if (text.includes('chicken')) return 'chicken';
      if (text.includes('beef')) return 'beef';
      if (text.includes('pork')) return 'pork';
      if (text.includes('lamb')) return 'lamb';
      if (text.includes('fish') || text.includes('salmon') || text.includes('tuna')) return 'fish';
      if (text.includes('prawn') || text.includes('shrimp')) return 'seafood';
      if (text.includes('tofu') || text.includes('vegetarian') || text.includes('vegan')) return 'vegetarian';
      
      return undefined;
    };

    it('detects chicken', () => {
      expect(extractProtein('Crispy Chicken Thighs')).toBe('chicken');
    });

    it('detects beef', () => {
      expect(extractProtein('Beef Stroganoff')).toBe('beef');
    });

    it('detects fish', () => {
      expect(extractProtein('Baked Salmon')).toBe('fish');
      expect(extractProtein('Tuna Pasta')).toBe('fish');
    });

    it('detects seafood', () => {
      expect(extractProtein('Garlic Prawns')).toBe('seafood');
      expect(extractProtein('Shrimp Scampi')).toBe('seafood');
    });

    it('detects vegetarian', () => {
      expect(extractProtein('Tofu Stir Fry')).toBe('vegetarian');
      expect(extractProtein('Pasta', ['vegetarian'])).toBe('vegetarian');
    });

    it('checks keywords when not in name', () => {
      expect(extractProtein('Thai Curry', ['chicken'])).toBe('chicken');
    });

    it('returns undefined for unknown proteins', () => {
      expect(extractProtein('Pasta Salad')).toBeUndefined();
    });

    it('is case insensitive', () => {
      expect(extractProtein('CHICKEN WINGS')).toBe('chicken');
      expect(extractProtein('Beef TACOS')).toBe('beef');
    });
  });
});
