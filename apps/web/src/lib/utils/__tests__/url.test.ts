import { describe, it, expect } from 'vitest';
import { isSafeRedirectPath } from '../url';

describe('isSafeRedirectPath', () => {
  it('accepts a plain same-origin relative path', () => {
    expect(isSafeRedirectPath('/recipes/42')).toBe(true);
  });

  it('accepts the root path', () => {
    expect(isSafeRedirectPath('/')).toBe(true);
  });

  it.each([null, undefined, ''])('rejects %j', (value) => {
    expect(isSafeRedirectPath(value)).toBe(false);
  });

  it('rejects an absolute URL (open redirect via a different origin)', () => {
    expect(isSafeRedirectPath('https://evil.example.com')).toBe(false);
  });

  it('rejects a protocol-relative "//host/path" (browser-resolved cross-origin redirect)', () => {
    expect(isSafeRedirectPath('//evil.example.com')).toBe(false);
  });

  it('rejects a backslash-based "/\\\\host/path" variant some browsers also resolve cross-origin', () => {
    expect(isSafeRedirectPath('/\\evil.example.com')).toBe(false);
  });

  it('rejects a path with no leading slash', () => {
    expect(isSafeRedirectPath('recipes/42')).toBe(false);
  });
});
