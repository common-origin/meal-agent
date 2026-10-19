import { describe, it, expect } from 'vitest';
import { buildPlanEditPrompt, buildPlanEditSystemPrompt } from '../planEdit';

describe('plan edit prompts (#38)', () => {
  it('lists every night by number and name, marking empty nights, then history and the instruction', () => {
    const text = buildPlanEditPrompt({
      instruction: 'no, lighter than that',
      plan: [
        { day: 0, title: 'Thai red curry', cuisine: 'thai', protein: 'lamb' },
        { day: 1, title: 'Polenta skillet' },
      ],
      history: [{ instruction: 'swap Tuesday', summary: 'Swapping Tuesday for something different.' }],
    });
    expect(text).toContain('0 Monday: Thai red curry (thai, lamb)');
    expect(text).toContain('1 Tuesday: Polenta skillet');
    expect(text).toContain('2 Wednesday: (no dinner planned)');
    expect(text).toContain('6 Sunday: (no dinner planned)');
    expect(text).toContain('- "swap Tuesday" → Swapping Tuesday for something different.');
    expect(text.trim().endsWith('INSTRUCTION\nno, lighter than that')).toBe(true);
  });

  it('leaves out the history section when there is none', () => {
    expect(buildPlanEditPrompt({ instruction: 'swap Friday', plan: [], history: [] })).not.toContain('RECENT EDITS');
  });

  it('tells the model to ask rather than guess, and never to mention AI', () => {
    const system = buildPlanEditSystemPrompt();
    expect(system).toContain('ask one short question');
    expect(system).toContain('Never mention AI');
    expect(system).toContain('0 = Monday to 6 = Sunday');
    // "Change this" then Enter sends just the night's name.
    expect(system).toContain('only a night\'s name (e.g. "Tuesday:" or "Tuesday") means replace that night');
  });
});
