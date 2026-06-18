import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

describe('refresh-on-release workflow', () => {
  const wf = yaml.load(readFileSync('.github/workflows/refresh-on-release.yml', 'utf8')) as any;
  it('triggers on dispatch + schedule, never on push', () => {
    const on = wf.on || wf[true];   // js-yaml may parse `on:` as boolean key
    expect(on.repository_dispatch).toBeTruthy();
    expect(on.workflow_dispatch !== undefined).toBe(true);
    expect(on.schedule).toBeTruthy();
    expect(on.push).toBeUndefined();
  });
  it('grants contents: write', () => {
    expect(wf.permissions.contents).toBe('write');
  });
  it('commit step uses a message with no CI-skip directive', () => {
    const text = readFileSync('.github/workflows/refresh-on-release.yml', 'utf8');
    expect(text).not.toMatch(/\[skip ci\]|\[ci skip\]|\[skip pages\]/i);
    expect(text).toContain('chore: refresh releases cache');
  });
});
