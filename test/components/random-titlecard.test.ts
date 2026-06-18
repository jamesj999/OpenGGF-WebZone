import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import RandomTitleCard from '../../src/components/RandomTitleCard.astro';

describe('RandomTitleCard', () => {
  it('renders all three title-card variants (the before-paint selector lives in BaseLayout)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(RandomTitleCard, { props: { version: { label: 'v0.5', isPre: false } } });
    // all three variant wrappers present
    expect(html).toContain('data-variant="s1"');
    expect(html).toContain('data-variant="s2"');
    expect(html).toContain('data-variant="s3k"');
    // each variant's hero
    expect(html).toContain('data-hero="s1"');
    expect(html).toContain('data-hero="s2"');
    expect(html).toContain('data-hero="s3k"');
  });
});
