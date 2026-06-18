import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

describe('astro build', () => {
  it('produces dist/index.html', () => {
    const result = spawnSync('npm', ['run', 'build:astro'], {
      stdio: 'inherit',
      shell: true,
    });
    expect(result.status).toBe(0);
    expect(existsSync('dist/index.html')).toBe(true);
  });
});
