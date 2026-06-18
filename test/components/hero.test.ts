import { describe, it, expect } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Hero from '../../src/components/TitleCardHero.astro';

describe('TitleCardHero', () => {
  it('renders the title-card composition (zone name, ZONE label, tagline, swoosh, version)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: { label: 'v0.5', isPre: false } } });
    expect(html).toContain('OpenGGF');                       // zone name
    expect(html).toContain('Open-Source Sonic Engine');      // yellow-bar tagline
    expect(html).toContain('>ZONE<');                        // ZONE label
    expect(html).toContain('data-tc="red"');                 // red left block (toothed swoosh)
    expect(html).toContain('data-tc="act"');                 // version slot present
    expect(html).toContain('v0.5');
  });
  it('hides the version slot when version is null', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: null } });
    expect(html).not.toContain('data-tc="act"');
  });
  it('renders the video WITHOUT autoplay (poster shows until JS opts in)', async () => {
    const c = await AstroContainer.create();
    const html = await c.renderToString(Hero, { props: { version: null, videoSrc: '/media/hero.mp4' } });
    expect(html).toContain('hero-video');
    expect(html).toContain('poster=');
    expect(html).not.toContain('autoplay');   // reduced-motion users get the poster
  });
});
