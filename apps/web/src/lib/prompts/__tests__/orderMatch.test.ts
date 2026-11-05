import { describe, it, expect } from 'vitest';
import { buildOrderMatchPrompt, buildOrderMatchSystemPrompt } from '../orderMatch';

describe('order match prompts (#185)', () => {
  it('lists ingredient keys and products by id', () => {
    const prompt = buildOrderMatchPrompt(
      [{ productId: '287609', name: 'Coles Dairy Cheese Tasty', size: '1kg' }, { productId: '1', name: 'Kombucha', size: null }],
      [{ key: 'cheese', name: 'Tasty cheese' }, { key: 'garlic', name: 'Garlic' }],
    );
    expect(prompt).toContain('cheese (Tasty cheese)\ngarlic\n');
    expect(prompt).toContain('287609: Coles Dairy Cheese Tasty, 1kg\n1: Kombucha');
  });

  it('tells the model to use only listed keys and null for non-ingredients', () => {
    const system = buildOrderMatchSystemPrompt();
    expect(system).toContain('Only use keys from the list');
    expect(system).toContain('null');
  });
});
