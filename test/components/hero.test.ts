import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Hero from '../../src/components/TitleCardHero.astro';

describe('TitleCardHero', () => {
  it('renders the title-card composition (zone name, tagline, swoosh, pruned version)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: { label: 'v0.5.20260411', isPre: false } } });
    expect(html).toContain('OpenGGF');                       // zone name (wordmark)
    expect(html).toContain('Open-Source Sonic Engine');      // tagline
    expect(html).toContain('data-tc="red"');                 // red left block (toothed swoosh)
    expect(html).toContain('tc-ver');                        // version below the wordmark
    expect(html).toContain('>0.5<');                         // pruned to major.minor (v stripped)
    expect(html).not.toContain('20260411');                  // long suffix dropped
  });
  it('hides the version when it can not be parsed', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: { label: 'nightly', isPre: true } } });
    expect(html).not.toContain('tc-ver');
  });
  it('renders the video WITHOUT autoplay (poster shows until JS opts in)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: null, videoSrc: '/media/hero.mp4' } });
    expect(html).toContain('hero-video');
    expect(html).toContain('poster=');
    expect(html).not.toContain('autoplay');   // reduced-motion users get the poster
  });
});
