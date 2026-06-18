import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { rmSync, existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const FIX = join(process.cwd(), 'test/scripts/fixtures/engine');
let OUT: string;   // temp output dir per test — never the tracked src/content/docs

describe('sync-docs', () => {
  beforeEach(() => { OUT = mkdtempSync(join(tmpdir(), 'docs-out-')); });
  afterEach(() => { rmSync(OUT, { recursive: true, force: true }); });

  it('copies allowlisted guide docs and adds frontmatter', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    const out = join(OUT, 'guide/playing/getting-started.md');
    expect(existsSync(out)).toBe(true);
    const txt = readFileSync(out, 'utf8');
    expect(txt).toMatch(/^---/);              // frontmatter added
    expect(txt).toContain('title:');
    expect(txt).toContain('/docs/guide/playing/controls');  // link rewritten
  });

  it('exits non-zero with a clear message when path is invalid', () => {
    const bad = mkdtempSync(join(tmpdir(), 'empty-'));
    let code = 0, msg = '';
    try { execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', bad, '--out-dir', OUT], { encoding: 'utf8' }); }
    catch (e: any) { code = e.status; msg = (e.stderr || '') + (e.stdout || ''); }
    expect(code).not.toBe(0);
    expect(msg).toContain('engine repo not found');
  });

  it('prunes stale output that is no longer in the source', () => {
    // Seed a stale file that the fixture does NOT produce.
    mkdirSync(join(OUT, 'guide/old'), { recursive: true });
    writeFileSync(join(OUT, 'guide/old/removed.md'), '---\ntitle: "Old"\n---\nstale');
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    expect(existsSync(join(OUT, 'guide/old/removed.md'))).toBe(false);   // pruned
    expect(existsSync(join(OUT, 'guide/playing/getting-started.md'))).toBe(true); // re-synced
  });

  it('rewrites bare relative links (no leading dot) to /docs/... slugs', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    const txt = readFileSync(join(OUT, 'guide/playing/getting-started.md'), 'utf8');
    expect(txt).toContain('/docs/guide/playing/game-status');
    expect(txt).not.toMatch(/\]\(game-status\.md\)/);
  });

  it('rewrites dotted relative links to /docs/... slugs', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    const txt = readFileSync(join(OUT, 'guide/playing/getting-started.md'), 'utf8');
    expect(txt).toContain('/docs/guide/playing/controls');
    expect(txt).not.toMatch(/\]\(\.\/controls\.md\)/);
  });

  it('rewrites non-synced targets to GitHub blob URL (not bare .md)', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    const txt = readFileSync(join(OUT, 'guide/playing/getting-started.md'), 'utf8');
    expect(txt).toContain('https://github.com/jamesj999/OpenGGF/blob/develop/');
    expect(txt).not.toMatch(/\]\([^)]*\.md\)/);  // no bare .md site link remains
  });

  it('excludes PLAN.md (denylist) from output', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    expect(existsSync(join(OUT, 'guide/PLAN.md'))).toBe(false);
    expect(existsSync(join(OUT, 'guide/PLAN'))).toBe(false);
  });

  it('rewrites relative directory links (trailing /) to a GitHub tree URL', () => {
    execFileSync('node', ['scripts/sync-docs.mjs', '--engine-path', FIX, '--out-dir', OUT], { encoding: 'utf8' });
    const txt = readFileSync(join(OUT, 'guide/playing/dir-link.md'), 'utf8');
    expect(txt).toContain('https://github.com/jamesj999/OpenGGF/tree/develop/');
    expect(txt).not.toContain('](sub/)');
  });
});
