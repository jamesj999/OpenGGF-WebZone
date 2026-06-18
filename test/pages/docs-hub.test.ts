import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('docs hub', () => {
  it('shows Play / Contribute / Cross-reference cards', () => {
    const result = spawnSync('npm run build:astro', { shell: true, encoding: 'utf8' });
    expect(result.status).toBe(0);
    const html = readFileSync('dist/docs/index.html', 'utf8');
    for (const t of ['Play', 'Contribute', 'Cross-reference']) expect(html).toContain(t);
  });
});
