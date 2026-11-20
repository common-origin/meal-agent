// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(__dirname, '..');
const files = readdirSync(dir).filter((name) => name.endsWith('.tsx'));

/**
 * The /admin UI is built from design-system parts and its layout grid, not
 * custom CSS (#270). The design system has no Table, so rows are List/ListItem.
 * If a part is genuinely missing, add it to the design system rather than here.
 */
describe('/admin uses the design system, not custom styling (#270)', () => {
  it('has components to check', () => {
    expect(files).toEqual(expect.arrayContaining(['AdminDashboard.tsx', 'sections.tsx', 'ui.tsx']));
  });

  it.each(files)('%s imports no styled-components and has no <table>, <details> or <style>', (name) => {
    const source = readFileSync(join(dir, name), 'utf8');
    expect(source).not.toMatch(/from ["']styled-components["']/);
    expect(source).not.toMatch(/<(table|details|style)[\s>]/);
  });

  it.each(files)('%s writes no raw layout or control elements: those come from the design system', (name) => {
    const source = readFileSync(join(dir, name), 'utf8');
    expect(source).not.toMatch(/<(div|span|p|ul|ol|li|section|nav|header|footer|button|input|select|textarea|img|svg|hr|h[1-6])[\s>/]/);
  });

  it('ARIA table roles live in one place: the DataGrid in ui.tsx, which stands in for the missing DataTable', () => {
    for (const name of files.filter((file) => file !== 'ui.tsx')) {
      expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(/role=["'](table|row|cell|columnheader|rowgroup)["']/);
    }
  });

  it.each(files)('%s has no hex or rgb colour: colours are design-system tokens', (name) => {
    const source = readFileSync(join(dir, name), 'utf8');
    expect(source).not.toMatch(/["'`]#[0-9a-fA-F]{3,8}["'`]/);
    expect(source).not.toMatch(/\brgba?\(/);
  });

  it.each(files)('%s has no hard-coded layout CSS in a style prop beyond the one flex weight of the uptime strip', (name) => {
    const source = readFileSync(join(dir, name), 'utf8');
    const styles = source.match(/style=\{\{[^}]*\}\}/g) ?? [];
    expect(styles.filter((s) => !/^style=\{\{ flex: `\$\{run\.length\} 1 0` \}\}$/.test(s))).toEqual([]);
  });
});
