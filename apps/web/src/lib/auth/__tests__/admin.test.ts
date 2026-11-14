import { describe, it, expect } from 'vitest';
import { adminEmails, isAdminEmail, isAdminPath } from '../admin';

describe('admin', () => {
  const env = { ADMIN_EMAILS: ' Owner@Example.com ,, partner@example.com' };

  it('reads ADMIN_EMAILS as a trimmed, lower-case list', () => {
    expect(adminEmails(env)).toEqual(['owner@example.com', 'partner@example.com']);
    expect(adminEmails({})).toEqual([]);
  });

  it('matches emails ignoring case, and fails closed', () => {
    expect(isAdminEmail('OWNER@example.com', env)).toBe(true);
    expect(isAdminEmail('guest@example.com', env)).toBe(false);
    expect(isAdminEmail(undefined, env)).toBe(false);
    expect(isAdminEmail('owner@example.com', {})).toBe(false);
  });

  it('covers /debug and /admin and nothing that merely starts with them', () => {
    expect(isAdminPath('/debug')).toBe(true);
    expect(isAdminPath('/debug/api-usage')).toBe(true);
    expect(isAdminPath('/admin/debug')).toBe(true);
    expect(isAdminPath('/debugger')).toBe(false);
    expect(isAdminPath('/plan')).toBe(false);
  });
});
