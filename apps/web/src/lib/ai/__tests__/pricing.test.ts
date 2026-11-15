import { describe, it, expect } from 'vitest';
import { AI_TASKS, MODEL_PRICING } from '../models';

describe('MODEL_PRICING covers every configured model (#215)', () => {
  it.each(Object.entries(AI_TASKS))('%s has a rate, so its calls count against the spend ceiling', (_task, config) => {
    expect(MODEL_PRICING[config.model]?.length ?? 0).toBeGreaterThan(0);
  });
});
